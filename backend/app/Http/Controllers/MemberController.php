<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMemberRequest;
use App\Models\Member;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
                // storage/app/public/cnicfront/...  aur  storage/app/public/cnicback/...
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
                    'amount'  => $fee,
                    'status'  => $status,
                    'paid_on' => $status === 'paid' ? now()->toDateString() : null,
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