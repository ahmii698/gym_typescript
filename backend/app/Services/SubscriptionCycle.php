<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Monthly subscription cycle logic (ek hi jagah, sab controllers yahin se use karte hain).
 *
 * Cycle 0: client_since .. client_since + 1 month
 * Cycle 1: client_since + 1 month .. + 2 months   ...aur isi tarah har mahine.
 * (31 Jan + 1 month = 28 Feb, March mein overflow nahi hota)
 *
 * amount_proof.billing_period mein cycle ki start date save hoti hai: "2026-11-10"
 * Fee har company ki apni hoti hai: companies.monthly_fee
 */
class SubscriptionCycle
{
    /** Jis company ki fee set nahi hui uske liye */
    public const DEFAULT_FEE = 5000;

    public static function addMonths(Carbon $start, int $n): Carbon
    {
        return $start->copy()->startOfDay()->addMonthsNoOverflow($n);
    }

    /** Aaj kaun sa cycle chal raha hai */
    public static function currentIndex(Carbon $start, Carbon $today): int
    {
        $n = ($today->year - $start->year) * 12 + ($today->month - $start->month);
        if (self::addMonths($start, $n)->gt($today)) {
            $n--;
        }
        return max($n, 0);
    }

    public static function periodKey(Carbon $d): string
    {
        return $d->format('Y-m-d');
    }

    /** DB ki billing_period ("2026-11-10") -> cycle number. Purani values (31 Oct 2026) ke liye null */
    public static function indexFromPeriod(Carbon $start, ?string $period): ?int
    {
        if (!$period || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $period)) {
            return null;
        }
        $p = Carbon::createFromFormat('Y-m-d', $period)->startOfDay();
        $n = ($p->year - $start->year) * 12 + ($p->month - $start->month);
        return $n >= 0 ? $n : null;
    }

    /** Ek company ke saare proofs (jis user ne upload kiya uski company se) */
    public static function proofsFor(int $companyId): Collection
    {
        return DB::table('amount_proof')
            ->join('users', 'users.id', '=', 'amount_proof.user_id')
            ->where('users.company_id', $companyId)
            ->select('amount_proof.*')
            ->orderByDesc('amount_proof.id')
            ->get();
    }

    /**
     * @param  string|Carbon|null $clientSince  jis din free se normal client bana
     * @param  Collection         $proofs       is company ke proofs (billing_period, amount, status chahiye)
     * @param  float              $fee          is company ki monthly fee
     * @return array|null         null = abhi normal client nahi hai
     */
    public static function summary($clientSince, Collection $proofs, float $fee = self::DEFAULT_FEE): ?array
    {
        if (!$clientSince) {
            return null;
        }

        $start = Carbon::parse($clientSince)->startOfDay();
        $n     = self::currentIndex($start, Carbon::today());

        // har cycle ki approved amount
        $paidByCycle = [];
        foreach ($proofs as $p) {
            if ($p->status !== 'approved') {
                continue;
            }
            $i = self::indexFromPeriod($start, $p->billing_period);
            if ($i === null) {
                continue;
            }
            $paidByCycle[$i] = ($paidByCycle[$i] ?? 0) + (float) $p->amount;
        }

        $fullyPaid = array_keys(array_filter($paidByCycle, fn ($a) => $a >= $fee));
        $lastPaid  = $fullyPaid ? max($fullyPaid) : null;
        $current   = $paidByCycle[$n] ?? 0;

        return [
            'client_since'  => $start,
            'billing_start' => self::addMonths($start, $n),
            'due_date'      => self::addMonths($start, $n + 1),
            'paid_amount'   => min($current, $fee),
            'is_paid'       => $current >= $fee,
            // akhri poori paid cycle: subscription kab se kab tak valid hai
            'paid_from'     => $lastPaid !== null ? self::addMonths($start, $lastPaid) : null,
            'paid_until'    => $lastPaid !== null ? self::addMonths($start, $lastPaid + 1) : null,
        ];
    }
}