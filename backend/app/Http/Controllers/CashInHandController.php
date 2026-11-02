<?php

namespace App\Http\Controllers;

use App\Models\CashInHandEntry;
use Illuminate\Http\Request;
use RuntimeException;

class CashInHandController extends Controller
{
    /** GET /cash-in-hand -> { balance, data: [...] } */
    public function index()
    {
        return response()->json([
            'balance' => CashInHandEntry::currentBalance(),
            'data' => CashInHandEntry::orderByDesc('id')->limit(200)->get(),
        ]);
    }

    /** POST /cash-in-hand  { type: add|withdraw, amount, note? } (sirf admin - role:admin middleware api.php me lagi hai) */
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'type' => 'required|in:add,withdraw',
            'amount' => 'required|numeric|min:0.01|max:999999999',
            'note' => 'nullable|string|max:255',
        ]);

        try {
            $entry = CashInHandEntry::record(
                $data['type'],
                (float) $data['amount'],
                $data['note'] ?? null,
                $user
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Cash update ho gaya.',
            'balance' => (float) $entry->balance_after,
            'entry' => $entry,
        ], 201);
    }
}