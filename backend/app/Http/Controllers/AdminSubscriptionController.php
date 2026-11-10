<?php

namespace App\Http\Controllers;

use App\Services\SubscriptionCycle;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminSubscriptionController extends Controller
{
    /**
     * GET /admin/subscription
     * Gym owner ke Amounts page ke liye: billing period, due date, payment status.
     *
     * Jis company ka client_since abhi nahi hai (trial / naya), uska cycle "aaj" se
     * shuru dikhta hai. Jis din woh pehla proof upload karegi, usi din client_since set ho jayega.
     */
    public function show(Request $request)
    {
        $company = DB::table('companies')
            ->where('id', $request->user()->company_id)
            ->whereNull('deleted_at')
            ->first();

        abort_if(!$company, 404, 'Company not found');

        $today = Carbon::today();

        // Har company ki apni fee
        $fee = (float) ($company->monthly_fee ?? SubscriptionCycle::DEFAULT_FEE);

        $s = $company->client_since
            ? SubscriptionCycle::summary($company->client_since, SubscriptionCycle::proofsFor($company->id), $fee)
            : SubscriptionCycle::summary($today->toDateString(), collect(), $fee);

        // Free trial info (agar company trial par hai)
        $isTrial   = $company->trial_days !== null;
        $trialEnds = null;
        if ($isTrial) {
            if ($company->trial_ends_at) {
                $trialEnds = Carbon::parse($company->trial_ends_at)->startOfDay();
            } elseif ($company->trial_starts_at) {
                $trialEnds = Carbon::parse($company->trial_starts_at)->startOfDay()->addDays((int) $company->trial_days);
            }
        }
        $trialDaysLeft = $trialEnds ? max((int) $today->diffInDays($trialEnds, false), 0) : null;

        // <-- NEW: is cycle mein ab tak approved paid amount aur remaining
        $periodKey = SubscriptionCycle::periodKey($s['billing_start']);
        $paid = $company->client_since
            ? (float) DB::table('amount_proof')
                ->where('company_id', $company->id)
                ->where('billing_period', $periodKey)
                ->where('status', 'approved')
                ->sum('amount')
            : 0.0;
        $remaining = max($fee - $paid, 0);

        return response()->json([
            'data' => [
                'monthly_fee'     => $fee,
                'paid_amount'     => $paid,       // <-- NEW
                'remaining'       => $remaining,  // <-- NEW
                'started_at'      => $company->client_since ? Carbon::parse($company->client_since)->toDateString() : null,
                'billing_start'   => $s['billing_start']->toDateString(),
                'due_date'        => $s['due_date']->toDateString(),
                'is_paid'         => $s['is_paid'],
                'paid_until'      => $s['paid_until'] ? $s['paid_until']->toDateString() : null,
                'is_trial'        => $isTrial,
                'trial_days_left' => $trialDaysLeft,
            ],
        ]);
    }
}