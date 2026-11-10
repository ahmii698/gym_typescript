<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Money Channels: JazzCash / Easypaisa / Bank ki details aur QR (scanner) image.
 * Super admin yahan set karta hai, gym admins apne Amounts page par yahi dekhte hain.
 */
class SuperAdminChannelController extends Controller
{
    private const TYPES = ['jazzcash', 'easypaisa', 'bank'];

    /** GET /super-admin/payment-channels : teeno channels (edit karne ke liye) */
    public function index()
    {
        return response()->json(['data' => $this->rows(false)]);
    }

    /** GET /admin/payment-channels : gym admin ko sirf active channels (jin mein kuch bhara ho) */
    public function forAdmin()
    {
        return response()->json(['data' => $this->rows(true)]);
    }

    /** POST /super-admin/payment-channels/{type}  (multipart: fields + optional qr image) */
    public function update(Request $request, $type)
    {
        abort_unless(in_array($type, self::TYPES, true), 404, 'Unknown channel');

        $request->validate([
            'account_title'  => 'nullable|string|max:150',
            'account_number' => 'nullable|string|max:50',
            'bank_name'      => 'nullable|string|max:100',
            'iban'           => 'nullable|string|max:40',
            'is_active'      => 'nullable|boolean',
            'qr'             => 'nullable|file|mimes:jpg,jpeg,png|max:3072', // 3MB
            'remove_qr'      => 'nullable|boolean',
        ]);

        $row    = DB::table('payment_channels')->where('type', $type)->first();
        $qrPath = $row->qr_path ?? null;

        if ($request->hasFile('qr')) {
            if ($qrPath) {
                Storage::disk('public')->delete($qrPath);
            }
            $qrPath = $request->file('qr')->store('payment-qr', 'public');
        } elseif ($request->boolean('remove_qr') && $qrPath) {
            Storage::disk('public')->delete($qrPath);
            $qrPath = null;
        }

        DB::table('payment_channels')->updateOrInsert(
            ['type' => $type],
            [
                'account_title'  => $request->input('account_title'),
                'account_number' => $request->input('account_number'),
                'bank_name'      => $type === 'bank' ? $request->input('bank_name') : null,
                'iban'           => $type === 'bank' ? $request->input('iban') : null,
                'qr_path'        => $qrPath,
                'is_active'      => $request->boolean('is_active', true) ? 1 : 0,
                'updated_at'     => now(),
            ]
        );

        return response()->json(['message' => 'Channel saved']);
    }

    private function rows(bool $onlyUsable): array
    {
        $saved = DB::table('payment_channels')->get()->keyBy('type');

        $rows = [];
        foreach (self::TYPES as $type) {
            $r = $saved->get($type);

            $row = [
                'type'           => $type,
                'account_title'  => $r->account_title ?? '',
                'account_number' => $r->account_number ?? '',
                'bank_name'      => $r->bank_name ?? '',
                'iban'           => $r->iban ?? '',
                'qr_url'         => !empty($r->qr_path) ? Storage::disk('public')->url($r->qr_path) : null,
                'is_active'      => (bool) ($r->is_active ?? true),
            ];

            if ($onlyUsable) {
                $hasData = $row['account_number'] !== '' || $row['iban'] !== '' || $row['qr_url'] !== null;
                if (!$row['is_active'] || !$hasData) {
                    continue;
                }
            }

            $rows[] = $row;
        }

        return $rows;
    }
}