<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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
}