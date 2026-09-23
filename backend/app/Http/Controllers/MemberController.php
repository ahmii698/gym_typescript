<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMemberRequest;
use App\Models\Member;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MemberController extends Controller
{
    public function index(Request $request)
    {
        $members = Member::with(['package:id,name', 'trainer:id,name'])
            ->when($request->q, function ($query, $search) {
                $query->where(function ($w) use ($search) {
                    $w->where('full_name', 'like', "%{$search}%")
                        ->orWhere('cnic', 'like', "%{$search}%")
                        ->orWhere('contact_number', 'like', "%{$search}%")
                        ->orWhere('member_code', 'like', "%{$search}%");
                });
            })
            ->when($request->member_type, fn ($q, $type) => $q->where('member_type', $type))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 10));

        return response()->json($members);
    }

    // Fee Collection page ke liye — poori list, filters/pagination frontend khud karta hai
    public function feeOverview()
    {
        $today = Carbon::today();

        $members = Member::with(['package:id,name,price', 'latestPayment'])
            ->latest()
            ->get()
            ->map(function (Member $m) use ($today) {
                $end = $m->end_date ? Carbon::parse($m->end_date)->startOfDay() : null;
                $daysToExpire = null;

                if ($end) {
                    $daysToExpire = (int) $today->diffInDays($end);
                    if ($end->lt($today)) {
                        $daysToExpire = -$daysToExpire;
                    }
                }

                $latest = $m->latestPayment;

                return [
                    'id'             => $m->id,
                    'full_name'      => $m->full_name,
                    'contact_number' => $m->contact_number,
                    'package_name'   => $m->package->name ?? null,
                    'package_price'  => $m->package->price ?? null,
                    'member_type'    => $m->member_type,
                    'is_active'      => (bool) $m->is_active,
                    'payment_status' => ($latest && $latest->status === 'paid') ? 'Paid' : 'Unpaid',
                    'last_payment'   => ($latest && $latest->status === 'paid' && $latest->paid_on)
                        ? Carbon::parse($latest->paid_on)->format('M j, Y')
                        : null,
                    'fee_expire'     => $end ? $end->format('M j, Y') : null,
                    'days_to_expire' => $daysToExpire,

                    // CNIC Images — full URL
                    'cnic_front_url' => $m->cnic_front_path
                        ? Storage::disk('public')->url($m->cnic_front_path)
                        : null,
                    'cnic_back_url'  => $m->cnic_back_path
                        ? Storage::disk('public')->url($m->cnic_back_path)
                        : null,
                ];
            });

        return response()->json($members);
    }

    public function store(StoreMemberRequest $request)
    {
        $data = $request->validated();
        $package = Package::findOrFail($data['package_id']);
        $hasTrainer = in_array($data['member_type'], Member::TRAINER_TYPES, true);

        $member = DB::transaction(function () use ($request, $data, $package, $hasTrainer) {
            $start = Carbon::parse($data['start_date']);

            $member = Member::create([
                'full_name'       => $data['full_name'],
                'cnic'            => $data['cnic'],
                'cnic_front_path' => $request->file('cnic_front')->store('cnicfront', 'public'),
                'cnic_back_path'  => $request->file('cnic_back')->store('cnicback', 'public'),
                'contact_number'  => $data['contact_number'],
                'email'           => $data['email'] ?? null,
                'date_of_birth'   => $data['date_of_birth'] ?? null,
                'gender'          => $data['gender'] ?? null,
                'member_type'     => $data['member_type'],
                'package_id'      => $package->id,
                'trainer_id'      => $hasTrainer ? ($data['trainer_id'] ?? null) : null,
                'start_date'      => $start->toDateString(),
                'end_date'        => $data['end_date']
                    ?? $start->copy()->addDays($package->duration_days)->toDateString(),
                'notes'           => $data['notes'] ?? null,
                'status'          => 'active',
            ]);

            $member->update([
                'member_code' => 'FZ-' . str_pad((string) $member->id, 4, '0', STR_PAD_LEFT),
            ]);

            $fee = (float) ($data['fee_amount'] ?? 0);
            if ($fee > 0) {
                $status = $data['payment_status'] ?? 'pending';

                $member->payments()->create([
                    'amount'       => $fee,
                    'status'       => $status,
                    'paid_on'      => $status === 'paid' ? now()->toDateString() : null,
                    'method'       => 'cash',
                    'collected_by' => optional($request->user())->name ?? 'Front Desk',
                ]);
            }

            return $member;
        });

        return response()->json([
            'message' => 'Member added successfully',
            'data'    => $member->load(['package', 'trainer', 'payments']),
        ], 201);
    }

    public function show(Member $member)
    {
        return response()->json($member->load(['package', 'trainer', 'payments']));
    }
}