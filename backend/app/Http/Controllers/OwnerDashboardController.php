<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Accessory;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OwnerDashboardController extends Controller
{
    /** Logged-in user's company id (raw DB::table queries need this manually). */
    private function companyId(): int
    {
        return (int) request()->user()->company_id;
    }

    /**
     * Work out the selected period and the previous period to compare against.
     * Returns [from, to, prevFrom, prevTo] (all Carbon, start of day).
     *
     * today  -> today              vs yesterday
     * week   -> this week to date  vs last week
     * month  -> this month to date vs last month
     * year   -> this year to date  vs last year
     * custom -> from..to           vs the same number of days right before it
     */
    private function resolveRange(Request $request, Carbon $today): array
    {
        $period = $request->input('period', 'month');

        if ($period === 'today') {
            $from = $today->copy();
            $to = $today->copy();
            $prevFrom = $today->copy()->subDay();
            $prevTo = $prevFrom->copy();
            return [$from, $to, $prevFrom, $prevTo];
        }

        if ($period === 'week') {
            $from = $today->copy()->startOfWeek();
            $to = $today->copy();
            $prevFrom = $from->copy()->subWeek();
            $prevTo = $from->copy()->subDay();
            return [$from, $to, $prevFrom, $prevTo];
        }

        if ($period === 'year') {
            $from = $today->copy()->startOfYear();
            $to = $today->copy();
            $prevFrom = $from->copy()->subYear();
            $prevTo = $from->copy()->subDay();
            return [$from, $to, $prevFrom, $prevTo];
        }

        if ($period === 'custom' && $request->filled('from')) {
            try {
                $from = Carbon::parse($request->input('from'))->startOfDay();
                $to = Carbon::parse($request->input('to', $request->input('from')))->startOfDay();

                if ($to->lt($from)) {
                    [$from, $to] = [$to, $from];
                }

                $days = $from->diffInDays($to) + 1;
                $prevTo = $from->copy()->subDay();
                $prevFrom = $prevTo->copy()->subDays($days - 1);
                return [$from, $to, $prevFrom, $prevTo];
            } catch (\Throwable $e) {
                // Invalid dates: fall back to "this month" below
            }
        }

        // Default: this month
        $from = $today->copy()->startOfMonth();
        $to = $today->copy();
        $prevFrom = $today->copy()->subMonthNoOverflow()->startOfMonth();
        $prevTo = $today->copy()->subMonthNoOverflow()->endOfMonth()->startOfDay();
        return [$from, $to, $prevFrom, $prevTo];
    }

    /**
     * Total real expense between two dates (inclusive).
     * Only counts money actually spent:
     *   1. Paid salary payments (salary + commission)
     *   2. Fixed expenses
     *   3. Extra expenses
     */
    private function totalExpense(Carbon $from, Carbon $to): float
    {
        $f = $from->toDateString();
        $t = $to->toDateString();
        $cid = $this->companyId();

        // 1. Salary payments (paid only, by payment date)
        $salary = DB::table('salary_payments')
            ->where('company_id', $cid)
            ->where('status', 'paid')
            ->whereDate('paid_on', '>=', $f)
            ->whereDate('paid_on', '<=', $t)
            ->selectRaw('COALESCE(SUM(amount), 0) + COALESCE(SUM(commission), 0) AS total')
            ->value('total');

        // 2. Fixed expenses
        $fixed = DB::table('fixed_expenses')
            ->where('company_id', $cid)
            ->whereDate('date', '>=', $f)
            ->whereDate('date', '<=', $t)
            ->sum('amount');

        // 3. Extra expenses
        $extra = DB::table('extra_expenses')
            ->where('company_id', $cid)
            ->whereDate('date', '>=', $f)
            ->whereDate('date', '<=', $t)
            ->sum('amount');

        return (float) $salary + (float) $fixed + (float) $extra;
    }

    /** Revenue (paid member payments) between two dates, inclusive. */
    private function revenueBetween(Carbon $from, Carbon $to): float
    {
        return (float) Payment::where('status', 'paid')
            ->whereDate('paid_on', '>=', $from->toDateString())
            ->whereDate('paid_on', '<=', $to->toDateString())
            ->sum('amount');
    }

    /**
     * Profit from drink sales between two dates, inclusive.
     * Only the margin counts: selling total - cost total.
     * Example: Coca-Cola sells for 50, cost 30 -> profit 20.
     * The cost price is saved on every sale (snapshot), so old sales stay correct.
     */
    private function drinkProfitBetween(Carbon $from, Carbon $to): float
    {
        return (float) DB::table('drink_sales')
            ->where('company_id', $this->companyId())
            ->whereDate('created_at', '>=', $from->toDateString())
            ->whereDate('created_at', '<=', $to->toDateString())
            ->selectRaw('COALESCE(SUM(total_price - (cost_price * quantity)), 0) AS p')
            ->value('p');
    }

    /** Total package price of members who have no paid payment in the range. */
    private function overdueBetween(Carbon $from, Carbon $to): float
    {
        $members = Member::whereDoesntHave('payments', function ($q) use ($from, $to) {
            $q->where('status', 'paid')
              ->whereDate('paid_on', '>=', $from->toDateString())
              ->whereDate('paid_on', '<=', $to->toDateString());
        })->with('package')->get();

        $total = 0;
        foreach ($members as $m) {
            $total += (float) ($m->package->price ?? 0);
        }
        return $total;
    }

    /** Percent change from $previous to $current (0 when there is nothing to compare). */
    private function trend(float $current, float $previous): int
    {
        return $previous > 0
            ? (int) round((($current - $previous) / $previous) * 100)
            : 0;
    }

    // GET /api/owner/dashboard/stats?year=2025&period=month&from=...&to=...
    public function stats(Request $request)
    {
        $today = Carbon::today();

        // Selected year for the charts (default: current year)
        $selectedYear = (int) $request->input('year', $today->year);
        // Safe range
        if ($selectedYear < 2020 || $selectedYear > $today->year + 1) {
            $selectedYear = $today->year;
        }

        // Selected period for the stat cards
        [$from, $to, $prevFrom, $prevTo] = $this->resolveRange($request, $today);
        $period = $request->input('period', 'month');

        // 1. Active Members (right now)
        $activeMembers = Member::where('is_active', true)->count();
        $lastActive = Member::where('is_active', true)
            ->whereDate('created_at', '<=', $prevTo->toDateString())
            ->count();
        $activeTrend = $this->trend($activeMembers, $lastActive);

        // 2. New Members (selected period)
        $newMembers = Member::whereBetween('created_at', [
            $from->copy()->startOfDay(),
            $to->copy()->endOfDay(),
        ])->count();
        $lastNew = Member::whereBetween('created_at', [
            $prevFrom->copy()->startOfDay(),
            $prevTo->copy()->endOfDay(),
        ])->count();
        $newMembersTrend = $this->trend($newMembers, $lastNew);

        // 3. Overdue Payments
        // Fees are monthly, so for "today" and "this week" we check the current month instead.
        if ($period === 'today' || $period === 'week') {
            $ovFrom = $today->copy()->startOfMonth();
            $ovTo = $today->copy();
            $ovPrevFrom = $today->copy()->subMonthNoOverflow()->startOfMonth();
            $ovPrevTo = $today->copy()->subMonthNoOverflow()->endOfMonth()->startOfDay();
        } else {
            $ovFrom = $from;
            $ovTo = $to;
            $ovPrevFrom = $prevFrom;
            $ovPrevTo = $prevTo;
        }
        $overdueAmount = $this->overdueBetween($ovFrom, $ovTo);
        $overdueTrend = $this->trend($overdueAmount, $this->overdueBetween($ovPrevFrom, $ovPrevTo));

        // 4. Revenue
        $revenue = $this->revenueBetween($from, $to);
        $lastRevenue = $this->revenueBetween($prevFrom, $prevTo);
        $revenueTrend = $this->trend($revenue, $lastRevenue);

        // 5. Expense = paid salary + fixed + extra (nothing else)
        $totalExpense = $this->totalExpense($from, $to);
        $lastExpense = $this->totalExpense($prevFrom, $prevTo);
        $expenseTrend = $this->trend($totalExpense, $lastExpense);

        // 6. Profit = fees/admission collected + drinks profit (margin only) - expense
        $drinkProfit = $this->drinkProfitBetween($from, $to);
        $lastDrinkProfit = $this->drinkProfitBetween($prevFrom, $prevTo);

        $profit = $revenue + $drinkProfit - $totalExpense;
        $lastProfit = $lastRevenue + $lastDrinkProfit - $lastExpense;
        // abs() so a negative previous profit still gives a sensible percentage
        $profitTrend = $lastProfit != 0
            ? (int) round((($profit - $lastProfit) / abs($lastProfit)) * 100)
            : 0;

        // 7. LAST 5 RECENT ACCESSORIES
        $recentAccessories = Accessory::orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'id'       => $item->id,
                    'name'     => $item->name,
                    'category' => $item->category ?? '-',
                    'quantity' => $item->quantity ?? 0,
                ];
            })
            ->toArray();

        // 8. MONTHLY REVENUE (12 months of selected year)
        $monthlyRevenue = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthStart = Carbon::create($selectedYear, $m, 1)->startOfMonth();
            $monthEnd   = Carbon::create($selectedYear, $m, 1)->endOfMonth();

            // Future month: amount is 0
            if ($monthStart->gt($today)) {
                $monthlyRevenue[] = [
                    'label'  => $monthStart->format('M'),
                    'month'  => $monthStart->format('Y-m'),
                    'amount' => 0,
                ];
                continue;
            }

            $amount = (float) Payment::where('status', 'paid')
                ->whereBetween('paid_on', [
                    $monthStart->toDateString(),
                    $monthEnd->toDateString(),
                ])
                ->sum('amount');

            $monthlyRevenue[] = [
                'label'  => $monthStart->format('M'),
                'month'  => $monthStart->format('Y-m'),
                'amount' => $amount,
            ];
        }

        // 9. MONTHLY MEMBER GROWTH (12 months of selected year, cumulative total)
        // Future months get 0, past months get the cumulative total
        $monthlyGrowth = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthStart = Carbon::create($selectedYear, $m, 1)->startOfMonth();
            $monthEnd   = Carbon::create($selectedYear, $m, 1)->endOfMonth();

            // Month starts after today: future month, 0
            if ($monthStart->gt($today)) {
                $monthlyGrowth[] = [
                    'label' => $monthStart->format('M'),
                    'month' => $m,
                    'total' => 0,
                ];
                continue;
            }

            // Past month: use the month end. Current month: use today as the cutoff.
            $cutoff = $monthEnd->gt($today) ? $today->copy()->endOfDay() : $monthEnd;

            $totalAtMonth = Member::whereDate('created_at', '<=', $cutoff->toDateString())
                ->count();

            $monthlyGrowth[] = [
                'label' => $monthStart->format('M'),
                'month' => $m,
                'total' => $totalAtMonth,
            ];
        }

        // 10. MEMBERSHIPS EXPIRING SOON (next 7 days)
        $sevenDaysLater = $today->copy()->addDays(7);
        $expiringMembers = Member::with('package')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '>=', $today->toDateString())
            ->whereDate('end_date', '<=', $sevenDaysLater->toDateString())
            ->orderBy('end_date', 'asc')
            ->limit(10)
            ->get()
            ->map(function ($m) use ($today) {
                $daysLeft = (int) $today->diffInDays(Carbon::parse($m->end_date), false);
                return [
                    'id'        => $m->id,
                    'name'      => $m->full_name,
                    'plan'      => $m->package->name ?? '-',
                    'expiry'    => Carbon::parse($m->end_date)->format('d M Y'),
                    'days_left' => max(0, $daysLeft),
                ];
            })
            ->toArray();

        // 11. RECENT STAFF
        $recentTrainers = Trainer::orderBy('created_at', 'desc')
            ->limit(4)
            ->get()
            ->map(function ($t) {
                return [
                    'id'             => $t->id,
                    'name'           => $t->name,
                    'role'           => $t->role ?? 'Fitness Trainer',
                    'specialization' => $t->specialization ?? '-',
                    'experience'     => $t->experience_years
                        ? $t->experience_years . ' yrs'
                        : '-',
                    'status'         => $t->is_active ? 'Active' : 'Inactive',
                ];
            })
            ->toArray();

        $recentFrontdesk = User::where('company_id', $this->companyId())
            ->where('role', 'frontdesk')
            ->orderBy('created_at', 'desc')
            ->limit(1)
            ->get()
            ->map(function ($u) {
                return [
                    'id'             => $u->id,
                    'name'           => $u->name,
                    'role'           => 'Front Desk',
                    'specialization' => '-',
                    'experience'     => '-',
                    'status'         => 'Active',
                ];
            })
            ->toArray();

        $recentStaff = array_merge($recentTrainers, $recentFrontdesk);

        // 12. AVAILABLE YEARS (always the last 5 years, whether or not there is data)
        $availableYears = [];
        for ($i = 0; $i < 5; $i++) {
            $availableYears[] = $today->year - $i;
        }
        sort($availableYears); // Ascending order

        return response()->json([
            'active_members'       => $activeMembers,
            'active_trend'         => $activeTrend,
            'new_members'          => $newMembers,
            'new_members_trend'    => $newMembersTrend,
            'overdue_amount'       => $overdueAmount,
            'overdue_trend'        => $overdueTrend,
            'revenue'              => $revenue,
            'revenue_trend'        => $revenueTrend,
            'total_expense'        => $totalExpense,   // the dashboard reads this key
            'expense'              => $totalExpense,   // alias, kept for safety
            'expense_trend'        => $expenseTrend,
            'profit'               => $profit,
            'profit_trend'         => $profitTrend,
            'recent_accessories'   => $recentAccessories,
            'monthly_revenue'      => $monthlyRevenue,
            'monthly_growth'       => $monthlyGrowth,
            'expiring_members'     => $expiringMembers,
            'recent_staff'         => $recentStaff,
            'selected_year'        => $selectedYear,
            'available_years'      => $availableYears,
        ]);
    }
}