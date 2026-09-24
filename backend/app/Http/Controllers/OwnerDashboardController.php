<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Accessory;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class OwnerDashboardController extends Controller
{
    // GET /api/owner/dashboard/stats?year=2025
    public function stats(Request $request)
    {
        $today = Carbon::today();

        // Selected year (default: current year)
        $selectedYear = (int) $request->input('year', $today->year);
        // Safe range
        if ($selectedYear < 2020 || $selectedYear > $today->year + 1) {
            $selectedYear = $today->year;
        }

        $startOfMonth = $today->copy()->startOfMonth();
        $startOfLastMonth = $today->copy()->subMonth()->startOfMonth();
        $endOfLastMonth = $today->copy()->subMonth()->endOfMonth();

        // 1. Active Members
        $activeMembers = Member::where('is_active', true)->count();

        // 2. New Members (This Month)
        $newMembers = Member::whereBetween('created_at', [
            $startOfMonth->copy()->startOfDay(),
            $today->copy()->endOfDay(),
        ])->count();

        // 3. Overdue Payments
        $overdueAmount = 0;
        $overdueMembers = Member::whereDoesntHave('payments', function ($q) use ($today) {
            $q->where('status', 'paid')
              ->whereMonth('paid_on', $today->month)
              ->whereYear('paid_on', $today->year);
        })->with('package')->get();

        foreach ($overdueMembers as $m) {
            $overdueAmount += (float) ($m->package->price ?? 0);
        }

        // 4. Revenue
        $revenue = (float) Payment::where('status', 'paid')
            ->whereMonth('paid_on', $today->month)
            ->whereYear('paid_on', $today->year)
            ->sum('amount');

        // 5. Trends
        $lastMonthActive = Member::where('is_active', true)
            ->whereDate('created_at', '<=', $endOfLastMonth->toDateString())
            ->count();
        $activeTrend = $lastMonthActive > 0
            ? (int) round((($activeMembers - $lastMonthActive) / $lastMonthActive) * 100)
            : 0;

        $lastMonthNew = Member::whereBetween('created_at', [
            $startOfLastMonth->copy()->startOfDay(),
            $endOfLastMonth->copy()->endOfDay(),
        ])->count();
        $newMembersTrend = $lastMonthNew > 0
            ? (int) round((($newMembers - $lastMonthNew) / $lastMonthNew) * 100)
            : 0;

        $lastMonthOverdueMembers = Member::whereDoesntHave('payments', function ($q) use ($startOfLastMonth, $endOfLastMonth) {
            $q->where('status', 'paid')
              ->whereBetween('paid_on', [
                  $startOfLastMonth->toDateString(),
                  $endOfLastMonth->toDateString(),
              ]);
        })->with('package')->get();

        $lastMonthOverdueAmount = 0;
        foreach ($lastMonthOverdueMembers as $m) {
            $lastMonthOverdueAmount += (float) ($m->package->price ?? 0);
        }
        $overdueTrend = $lastMonthOverdueAmount > 0
            ? (int) round((($overdueAmount - $lastMonthOverdueAmount) / $lastMonthOverdueAmount) * 100)
            : 0;

        $lastMonthRevenue = (float) Payment::where('status', 'paid')
            ->whereMonth('paid_on', $startOfLastMonth->month)
            ->whereYear('paid_on', $startOfLastMonth->year)
            ->sum('amount');
        $revenueTrend = $lastMonthRevenue > 0
            ? (int) round((($revenue - $lastMonthRevenue) / $lastMonthRevenue) * 100)
            : 0;

        // 6. LAST 5 RECENT ACCESSORIES
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

        // 7. MONTHLY REVENUE (12 months of selected year)
        $monthlyRevenue = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthStart = Carbon::create($selectedYear, $m, 1)->startOfMonth();
            $monthEnd   = Carbon::create($selectedYear, $m, 1)->endOfMonth();

            // Future month ho to skip (0 amount)
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

        // 8. MONTHLY MEMBER GROWTH (12 months of selected year, cumulative total)
        // Future months ke liye 0, past months ke liye cumulative total
        $monthlyGrowth = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthStart = Carbon::create($selectedYear, $m, 1)->startOfMonth();
            $monthEnd   = Carbon::create($selectedYear, $m, 1)->endOfMonth();

            // Agar month ka start aaj se aage hai → future month, 0
            if ($monthStart->gt($today)) {
                $monthlyGrowth[] = [
                    'label' => $monthStart->format('M'),
                    'month' => $m,
                    'total' => 0,
                ];
                continue;
            }

            // Past month → us month ka end
            // Current month → aaj ka cutoff
            $cutoff = $monthEnd->gt($today) ? $today->copy()->endOfDay() : $monthEnd;

            $totalAtMonth = Member::whereDate('created_at', '<=', $cutoff->toDateString())
                ->count();

            $monthlyGrowth[] = [
                'label' => $monthStart->format('M'),
                'month' => $m,
                'total' => $totalAtMonth,
            ];
        }

        // 9. MEMBERSHIPS EXPIRING SOON (next 7 days)
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

        // 10. RECENT STAFF
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

        $recentFrontdesk = User::where('role', 'frontdesk')
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

        // 11. AVAILABLE YEARS (last 5 years — hamesha, chahe data ho ya na ho)
        $availableYears = [];
        for ($i = 0; $i < 5; $i++) {
            $availableYears[] = $today->year - $i;
        }
        sort($availableYears); // Ascending order: [2022, 2023, 2024, 2025, 2026]

        return response()->json([
            'active_members'       => $activeMembers,
            'active_trend'         => $activeTrend,
            'new_members'          => $newMembers,
            'new_members_trend'    => $newMembersTrend,
            'overdue_amount'       => $overdueAmount,
            'overdue_trend'        => $overdueTrend,
            'revenue'              => $revenue,
            'revenue_trend'        => $revenueTrend,
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