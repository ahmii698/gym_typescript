<?php

namespace App\Http\Controllers;

use App\Models\Member;
use App\Models\Payment;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    // GET /api/dashboard/stats
    public function stats()
    {
        $today = Carbon::today();

        // 1. Total Members
        $totalMembers = Member::count();

        // 2. Active Members
        $activeMembers = Member::where('is_active', true)->count();

        // 3. Pending Due (This Month)
        $pendingDue = Member::whereDoesntHave('payments', function ($q) use ($today) {
            $q->where('status', 'paid')
              ->whereMonth('paid_on', $today->month)
              ->whereYear('paid_on', $today->year);
        })->count();

        // 4. Fees Collected (This Month)
        $monthlyPayments = Payment::where('status', 'paid')
            ->whereMonth('paid_on', $today->month)
            ->whereYear('paid_on', $today->year);

        $feesCollected = (float) (clone $monthlyPayments)->sum('amount');

        // 5. Method-wise breakdown
        $byMethodRaw = (clone $monthlyPayments)
            ->selectRaw('LOWER(TRIM(method)) as method_lower, SUM(amount) as total')
            ->groupBy('method_lower')
            ->pluck('total', 'method_lower')
            ->toArray();

        $cash = 0; $bankTransfer = 0; $online = 0; $card = 0;
        foreach ($byMethodRaw as $method => $total) {
            $total = (float) $total;
            $m = strtolower(trim($method));
            if ($m === 'cash') {
                $cash += $total;
            } elseif (in_array($m, ['bank_transfer', 'bank', 'bank transfer', 'banktransfer'])) {
                $bankTransfer += $total;
            } elseif (in_array($m, ['online', 'jazzcash', 'easypaisa', 'jazz_cash', 'easy_paisa'])) {
                $online += $total;
            } elseif (in_array($m, ['card', 'credit_card', 'debit_card'])) {
                $card += $total;
            }
        }

        // 6. Fees Trend
        $lastMonth = $today->copy()->subMonth();
        $lastMonthCollected = (float) Payment::where('status', 'paid')
            ->whereMonth('paid_on', $lastMonth->month)
            ->whereYear('paid_on', $lastMonth->year)
            ->sum('amount');

        $feesTrend = $lastMonthCollected > 0
            ? (int) round((($feesCollected - $lastMonthCollected) / $lastMonthCollected) * 100)
            : 0;

        // 7. Members Trend
        $lastMonthTotal = Member::whereDate('created_at', '<', $today->copy()->startOfMonth())->count();
        $membersTrend = $lastMonthTotal > 0
            ? (int) round((($totalMembers - $lastMonthTotal) / $lastMonthTotal) * 100)
            : 0;

        // 8. LAST 6 MONTHS CHART DATA
        $chartLabels = [];
        $chartTotal = [];
        $chartActive = [];

        for ($i = 5; $i >= 0; $i--) {
            $monthStart = $today->copy()->subMonths($i)->startOfMonth();
            $monthEnd   = $today->copy()->subMonths($i)->endOfMonth();

            $chartLabels[] = $monthStart->format('M');

            $chartTotal[] = Member::whereBetween('created_at', [
                $monthStart->copy()->startOfDay(),
                $monthEnd->copy()->endOfDay(),
            ])->count();

            $chartActive[] = Member::whereBetween('created_at', [
                $monthStart->copy()->startOfDay(),
                $monthEnd->copy()->endOfDay(),
            ])->where('is_active', true)->count();
        }

        // 9. UPCOMING FEE DUES
        $todayStr = $today->toDateString();
        $sevenDaysLater = $today->copy()->addDays(7)->toDateString();

        $upcomingDues = Member::with('package')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '>=', $todayStr)
            ->whereDate('end_date', '<=', $sevenDaysLater)
            ->orderBy('end_date', 'asc')
            ->limit(5)
            ->get()
            ->map(function ($member) use ($today) {
                $daysLeft = (int) $today->diffInDays(Carbon::parse($member->end_date), false);

                return [
                    'id'       => $member->id,
                    'name'     => $member->full_name,
                    'package'  => $member->package->name ?? '-',
                    'due_date' => $member->end_date,
                    'days_left'=> max(0, $daysLeft),
                    'amount'   => $member->package->price ?? 0,
                ];
            })
            ->toArray();

        // 10. RECENT MEMBERS (latest 5 registered)
        $recentMembers = Member::with('package')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($member) {
                return [
                    'id'        => $member->id,
                    'name'      => $member->full_name,
                    'package'   => $member->package->name ?? '-',
                    'join_date' => $member->created_at
                        ? $member->created_at->format('M d, Y')
                        : ($member->start_date ?? '-'),
                    'status'    => $member->is_active ? 'Active' : 'Inactive',
                ];
            })
            ->toArray();

        return response()->json([
            'total_members'   => $totalMembers,
            'active_members'  => $activeMembers,
            'pending_due'     => $pendingDue,
            'fees_collected'  => $feesCollected,
            'fees_trend'      => $feesTrend,
            'members_trend'   => $membersTrend,
            'fees_by_method'  => [
                'cash'          => $cash,
                'bank_transfer' => $bankTransfer,
                'online'        => $online,
                'card'          => $card,
            ],
            'chart' => [
                'labels' => $chartLabels,
                'total'  => $chartTotal,
                'active' => $chartActive,
            ],
            'upcoming_dues'  => $upcomingDues,
            'recent_members' => $recentMembers,   // <-- NAYA
        ]);
    }
}