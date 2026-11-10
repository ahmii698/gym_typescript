<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CashInHandEntry extends Model
{
    use BelongsToCompany;

    protected $table = 'cash_in_hand_entries';

    protected $fillable = [
        'type',
        'amount',
        'balance_before',
        'balance_after',
        'note',
        'user_id',
        'user_name',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'balance_before' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    /** Maujooda cash in hand (sab se aakhri entry ka balance_after). Ab sirf login company ki entries se. */
    public static function currentBalance(): float
    {
        $last = static::orderByDesc('id')->first();

        return $last ? (float) $last->balance_after : 0.0;
    }

    /**
     * Cash add ya withdraw karo aur history entry banao.
     * Transaction + lock ki wajah se do requests ek saath aayein to balance galat nahi hota.
     * Withdraw balance se zyada ho to RuntimeException throw hoti hai (English message).
     */
    public static function record(string $type, float $amount, ?string $note = null, $user = null): self
    {
        return DB::transaction(function () use ($type, $amount, $note, $user) {
            $last = static::orderByDesc('id')->lockForUpdate()->first();
            $before = $last ? (float) $last->balance_after : 0.0;

            if ($type === 'withdraw' && $amount > $before) {
                throw new RuntimeException(
                    'Not enough cash in hand. Available: Rs ' . number_format($before, 2)
                    . ', required: Rs ' . number_format($amount, 2)
                    . '. Please add cash in hand first.'
                );
            }

            $after = $type === 'add' ? $before + $amount : $before - $amount;

            $entry = new static([
                'type' => $type,
                'amount' => $amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'note' => $note,
                'user_id' => $user?->id,
                'user_name' => $user?->name ?? $user?->email,
            ]);

            // company_id request se nahi, sirf user se. Trait bhi set karta hai,
            // lekin yahan explicit rakha taake queue/job mein bhi sahi company aaye.
            if ($user && isset($user->company_id)) {
                $entry->company_id = $user->company_id;
            }

            $entry->save();

            return $entry;
        });
    }

    /**
     * Inventory khareed / vendor payment ke liye cash kaato.
     * Amount 0 ho to kuch nahi karta. Cash kam ho to RuntimeException throw hoti hai.
     * Hamesha DB::transaction ke andar se call karo, taake fail hone par poori khareed rollback ho.
     */
    public static function spend(float $amount, string $note, $user = null): ?self
    {
        if ($amount <= 0) {
            return null;
        }

        return static::record('withdraw', $amount, $note, $user);
    }
}