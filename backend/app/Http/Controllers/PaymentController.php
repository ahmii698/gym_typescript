<?php

namespace App\Http\Controllers;

use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'member_id' => ['required', 'exists:members,id'],
            'amount'    => ['required', 'numeric', 'min:0'],
            'status'    => ['required', Rule::in(['paid', 'pending', 'partial'])],
            'method'    => ['nullable', Rule::in(['cash', 'card', 'bank_transfer', 'online'])],
            'paid_on'   => ['nullable', 'date'],
            'note'      => ['nullable', 'string', 'max:500'],
        ]);

        $member = Member::with('package')->findOrFail($data['member_id']);

        $payment = DB::transaction(function () use ($data, $member, $request) {
            $payment = $member->payments()->create([
                'amount'       => $data['amount'],
                'status'       => $data['status'],
                'paid_on'      => $data['status'] === 'paid'
                    ? ($data['paid_on'] ?? now()->toDateString())
                    : ($data['paid_on'] ?? null),
                'method'       => $data['method'] ?? 'cash',
                'collected_by' => optional($request->user())->name ?? 'Front Desk',
                'note'         => $data['note'] ?? null,
            ]);

            if ($data['status'] === 'paid') {
                $currentEnd = $member->end_date ? Carbon::parse($member->end_date) : null;
                $base = ($currentEnd && $currentEnd->isFuture()) ? $currentEnd : Carbon::today();

                $member->update([
                    'end_date' => $base->copy()->addDays($member->package->duration_days ?? 30)->toDateString(),
                    'status'   => 'active',
                ]);
            }

            return $payment;
        });

        return response()->json([
            'message' => 'Fee collected successfully',
            'data'    => $payment,
        ], 201);
    }

    public function history(Member $member)
    {
        return response()->json(
            $member->payments()->latest()->get()
        );
    }
}