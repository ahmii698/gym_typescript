<?php

namespace App\Http\Controllers;

use App\Services\SubscriptionCycle;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AmountProofController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'proof'          => 'required|file|mimes:jpg,jpeg,png|max:5120', // 5MB
            'amount'         => 'required|numeric|min:1', // <-- CHANGED: 0 ka proof na jaye
            'billing_period' => 'required|date_format:Y-m-d', // cycle ki start date
        ]);

        $user    = $request->user();
        $company = DB::table('companies')->where('id', $user->company_id)->first();

        abort_if(!$company, 422, 'Company not found');

        // NEW: trial wali company ki billing convert hone ke din se shuru hoti hai, trial mein proof nahi
        abort_if(
            !is_null($company->trial_days),
            422,
            'Your free trial is still active. Billing starts after your account is converted.'
        );

        // client_since abhi nahi hai (purani company) to cycle aaj se shuru hoga
        $firstPayment = !$company->client_since;
        $start        = $company->client_since ?: Carbon::today()->toDateString();

        $fee = (float) ($company->monthly_fee ?? SubscriptionCycle::DEFAULT_FEE); // is company ki apni fee

        $s = SubscriptionCycle::summary(
            $start,
            $firstPayment ? collect() : SubscriptionCycle::proofsFor($company->id),
            $fee
        );

        // Proof sirf chal rahe cycle ke liye ho sakta hai
        abort_if(
            $request->billing_period !== SubscriptionCycle::periodKey($s['billing_start']),
            422,
            'Billing period has changed. Please refresh the page and try again.'
        );
        abort_if($s['is_paid'], 422, 'This billing period is already paid');

        // <-- NEW: is cycle mein ab tak approved paid amount, aur remaining
        $paid = $firstPayment ? 0.0 : (float) DB::table('amount_proof')
            ->where('company_id', $company->id)
            ->where('billing_period', $request->billing_period)
            ->where('status', 'approved')
            ->sum('amount');

        $remaining = max($fee - $paid, 0);

        // <-- NEW: remaining se zyada amount ka proof qabool nahi hoga
        abort_if(
            (float) $request->amount > $remaining,
            422,
            'Amount cannot be more than the remaining Rs ' . number_format($remaining)
        );

        $path = $request->file('proof')->store('amount-proofs', 'public');

        $id = DB::transaction(function () use ($request, $user, $company, $path, $firstPayment, $start) {
            $id = DB::table('amount_proof')->insertGetId([
                'user_id'        => $user->id,
                'company_id'     => $user->company_id, // DEFAULT 1 par na rahe
                'amount'         => $request->amount,
                'billing_period' => $request->billing_period,
                'proof_path'     => $path,
                'status'         => 'pending',
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);

            // Sirf tab set hoga jab client_since null ho, purani date kabhi overwrite nahi hoti
            if ($firstPayment) {
                DB::table('companies')
                    ->where('id', $company->id)
                    ->whereNull('client_since')
                    ->update(['client_since' => $start, 'updated_at' => now()]);
            }

            return $id;
        });

        return response()->json([
            'message' => 'Payment proof submitted successfully',
            'id'      => $id,
        ], 201);
    }
}