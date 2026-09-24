<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class AttendanceController extends Controller
{
    private const TYPE_LABELS = [
        'normal_user'      => 'Normal',
        'normal_trainer'   => 'Normal + Trainer',
        'package_trainer'  => 'Package + Trainer',
        'package_only'     => 'Package Only',
    ];

    // GET /api/attendance?date=2026-09-22
    public function index(Request $request)
    {
        $date = $request->filled('date') ? $request->date : Carbon::today()->toDateString();

        $members = Member::with(['package', 'trainer', 'latestPayment'])->get();

        $data = $members->map(function ($member) use ($date) {
            $attendance = Attendance::where('member_id', $member->id)
                ->where('date', $date)
                ->first();

            return [
                'id'             => $member->id,
                'name'           => $member->full_name,
                'phone'          => $member->contact_number,
                'cnic'           => $member->cnic,
                'package'        => $member->package->name ?? '-',
                'type'           => self::TYPE_LABELS[$member->member_type] ?? $member->member_type,
                'trainer'        => $member->trainer->name ?? null,
                'status'         => $attendance->status ?? 'Absent',
                'check_in'       => $attendance->check_in ?? null,
                'payment_status' => $member->latestPayment && $member->latestPayment->status === 'paid'
                    ? 'Paid'
                    : 'Unpaid',
                'fees_paid_on'   => $member->latestPayment->paid_on ?? $member->start_date,
                'fees_expiry_on' => $member->end_date,
                'joined_on'      => $member->start_date,
                'email'          => $member->email,
                'avatar'         => null,

                // CNIC Images — full URL banake bhej rahe hain
                'cnic_front_url' => $member->cnic_front_path
                    ? Storage::disk('public')->url($member->cnic_front_path)
                    : null,
                'cnic_back_url'  => $member->cnic_back_path
                    ? Storage::disk('public')->url($member->cnic_back_path)
                    : null,
            ];
        });

        return response()->json($data);
    }

    // POST /api/attendance/{member}/toggle   { date }
    public function toggle(Request $request, Member $member)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $attendance = Attendance::firstOrNew([
            'member_id' => $member->id,
            'date'      => $request->date,
        ]);

        if ($attendance->status === 'Present') {
            $attendance->status = 'Absent';
            $attendance->check_in = null;
        } else {
            $attendance->status = 'Present';
            $attendance->check_in = now()->format('H:i:s');
        }

        $attendance->save();

        return response()->json($attendance);
    }

    // GET /api/attendance/{member}/history?month=2026-09
    // Member ka poora record: registration date se aaj tak, month-wise
    public function history(Request $request, Member $member)
    {
        $request->validate([
            'month' => 'nullable|date_format:Y-m',
        ]);

        $today = Carbon::today();

        // Record kab se shuru: start_date (na ho to created_at)
        $joined = Carbon::parse($member->start_date ?: $member->created_at)->startOfDay();

        // Agar is se pehle ka koi attendance record maujood ho to wahan se shuru karo
        $firstRecord = Attendance::where('member_id', $member->id)->min('date');
        if ($firstRecord && Carbon::parse($firstRecord)->startOfDay()->lt($joined)) {
            $joined = Carbon::parse($firstRecord)->startOfDay();
        }

        // Future start date ho to aaj se shuru maano
        if ($joined->gt($today)) {
            $joined = $today->copy();
        }

        $records = Attendance::where('member_id', $member->id)
            ->whereDate('date', '>=', $joined->toDateString())
            ->whereDate('date', '<=', $today->toDateString())
            ->get()
            ->keyBy(fn ($a) => $a->date->toDateString());

        $presentByMonth = $records
            ->filter(fn ($a) => $a->status === 'Present')
            ->groupBy(fn ($a) => $a->date->format('Y-m'))
            ->map(fn ($group) => $group->count());

        $firstMonth = $joined->copy()->startOfMonth();
        $lastMonth  = $today->copy()->startOfMonth();

        // Selected month (joined month se pehle ya aaj ke mahine se aage nahi ja sakta)
        $selected = $request->filled('month')
            ? Carbon::createFromFormat('Y-m-d', $request->month . '-01')->startOfDay()
            : $lastMonth->copy();

        if ($selected->lt($firstMonth)) {
            $selected = $firstMonth->copy();
        }
        if ($selected->gt($lastMonth)) {
            $selected = $lastMonth->copy();
        }

        // Har month ki summary + overall
        $months = [];
        $overallPresent = 0;
        $overallTotal   = 0;

        $cursor = $firstMonth->copy();
        while ($cursor->lte($lastMonth)) {
            $rangeStart = $cursor->copy()->max($joined);
            $rangeEnd   = $cursor->copy()->endOfMonth()->startOfDay()->min($today);

            $totalDays = (int) $rangeStart->diffInDays($rangeEnd) + 1;
            $present   = (int) ($presentByMonth[$cursor->format('Y-m')] ?? 0);
            $absent    = max(0, $totalDays - $present);

            $months[] = [
                'month'      => $cursor->format('Y-m'),
                'label'      => $cursor->format('F Y'),
                'present'    => $present,
                'absent'     => $absent,
                'total_days' => $totalDays,
                'percentage' => $totalDays > 0 ? (int) round($present / $totalDays * 100) : 0,
            ];

            $overallPresent += $present;
            $overallTotal   += $totalDays;

            $cursor->addMonthNoOverflow();
        }

        // Selected month ke daily records (jin din record nahi = Absent)
        $dayStart = $selected->copy()->max($joined);
        $dayEnd   = $selected->copy()->endOfMonth()->startOfDay()->min($today);

        $days = [];
        for ($d = $dayStart->copy(); $d->lte($dayEnd); $d->addDay()) {
            $key = $d->toDateString();
            $rec = $records->get($key);

            $days[] = [
                'date'     => $key,
                'day'      => $d->format('D'),
                'status'   => ($rec && $rec->status === 'Present') ? 'Present' : 'Absent',
                'check_in' => $rec?->check_in,
            ];
        }

        $selectedSummary = collect($months)->firstWhere('month', $selected->format('Y-m'));

        return response()->json([
            'member' => [
                'id'            => $member->id,
                'name'          => $member->full_name,
                'tracking_from' => $joined->toDateString(),
            ],
            'selected_month' => $selected->format('Y-m'),
            'months'         => $months,
            'summary'        => [
                'present'    => $selectedSummary['present'] ?? 0,
                'absent'     => $selectedSummary['absent'] ?? 0,
                'total_days' => $selectedSummary['total_days'] ?? 0,
                'percentage' => $selectedSummary['percentage'] ?? 0,
            ],
            'overall' => [
                'present'    => $overallPresent,
                'absent'     => max(0, $overallTotal - $overallPresent),
                'total_days' => $overallTotal,
                'percentage' => $overallTotal > 0 ? (int) round($overallPresent / $overallTotal * 100) : 0,
            ],
            'days' => $days,
        ]);
    }

    // GET /api/attendance/stats?date=2026-09-22
    public function stats(Request $request)
    {
        $date = $request->filled('date') ? $request->date : Carbon::today()->toDateString();

        $totalMembers = Member::count();

        $todayAttendance = Attendance::where('date', $date)->get();
        $present = $todayAttendance->where('status', 'Present')->count();
        $absent  = $totalMembers - $present;
        $totalCheckIns = $todayAttendance->whereNotNull('check_in')->count();

        $sevenDaysAgo = Carbon::today()->subDays(7)->toDateString();
        $noCheckIn = Member::whereDoesntHave('attendance', function ($q) use ($sevenDaysAgo) {
            $q->where('date', '>=', $sevenDaysAgo)->whereNotNull('check_in');
        })->count();

        return response()->json([
            'total_check_ins' => $totalCheckIns,
            'present'         => $present,
            'absent'          => $absent,
            'no_check_in'     => $noCheckIn,
        ]);
    }

    // GET /api/attendance/checkins?from=2026-09-01&to=2026-09-24&search=Ali&page=1
    // Admin panel ke liye: date-range ke andar sab members ke real check-ins (Present + check_in wala) list
    public function checkins(Request $request)
    {
        $request->validate([
            'from'   => 'nullable|date',
            'to'     => 'nullable|date',
            'search' => 'nullable|string',
            'page'   => 'nullable|integer|min:1',
        ]);

        $from = $request->filled('from') ? $request->from : Carbon::today()->toDateString();
        $to   = $request->filled('to') ? $request->to : Carbon::today()->toDateString();

        $query = Attendance::with('member.package')
            ->where('status', 'Present')
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('member', function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('contact_number', 'like', "%{$search}%")
                  ->orWhere('cnic', 'like', "%{$search}%");
            });
        }

        $paginated = $query->orderByDesc('date')->orderByDesc('check_in')
            ->paginate(10, ['*'], 'page', $request->integer('page', 1));

        $data = collect($paginated->items())->map(function ($attendance) {
            $member = $attendance->member;
            return [
                'id'       => $attendance->id,
                'name'     => $member->full_name ?? '-',
                'phone'    => $member->contact_number ?? '-',
                'cnic'     => $member->cnic ?? '-',
                'package'  => $member->package->name ?? '-',
                'date'     => $attendance->date->toDateString(),
                'check_in' => $attendance->check_in,
            ];
        });

        return response()->json([
            'data'         => $data,
            'total'        => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
        ]);
    }

    // GET /api/attendance/checkin-stats
    // Admin panel ke stat cards ke liye: total present check-ins today/week/month/all-time
    public function checkinStats()
    {
        $today      = Carbon::today();
        $weekStart  = $today->copy()->subDays(6);
        $monthStart = $today->copy()->startOfMonth();

        return response()->json([
            'today' => Attendance::where('status', 'Present')->whereDate('date', $today)->count(),
            'week'  => Attendance::where('status', 'Present')->whereBetween('date', [$weekStart, $today])->count(),
            'month' => Attendance::where('status', 'Present')->whereBetween('date', [$monthStart, $today])->count(),
            'total' => Attendance::where('status', 'Present')->count(),
        ]);
    }
}