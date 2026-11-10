<?php

namespace App\Http\Controllers;

use App\Models\CashInHandEntry;
use App\Models\Vendor;
use App\Models\VendorPayment;
use App\Models\VendorPurchase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;

class CreditController extends Controller
{
    // GET /api/credit/remaining?source=drink|accessory
    // Ek page (drinks ya accessories) ka vendors ko dena baqi (total - paid)
    public function remaining(Request $request)
    {
        $data = $request->validate([
            'source' => 'required|in:drink,accessory',
        ]);

        $total = (float) VendorPurchase::where('source_type', $data['source'])->sum('total_amount');
        $paid  = (float) VendorPurchase::where('source_type', $data['source'])->sum('paid_amount');

        return response()->json([
            'remaining' => round(max($total - $paid, 0), 2),
        ]);
    }

    // GET /api/credit/vendors?q=
    // Vendors ki list + upar ke 3 cards ka data
    public function index(Request $request)
    {
        $query = Vendor::with(['purchases.items'])->orderBy('name');

        // Search: vendor name, product name ya invoice #
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                  ->orWhereHas('purchases', function ($p) use ($q) {
                      $p->where('invoice_no', 'like', "%{$q}%")
                        ->orWhereHas('items', fn ($i) => $i->where('item_name', 'like', "%{$q}%"));
                  });
            });
        }

        $rows = $query->get()->map(function ($vendor) {
            $total = (float) $vendor->purchases->sum('total_amount');
            $paid  = (float) $vendor->purchases->sum('paid_amount');

            // Same product ki quantity jama karke: "car ac x 1"
            $products = $vendor->purchases
                ->flatMap(fn ($p) => $p->items)
                ->groupBy('item_name')
                ->map(fn ($group, $name) => [
                    'name'     => $name,
                    'quantity' => (int) $group->sum('quantity'),
                ])
                ->values();

            return [
                'id'            => $vendor->id,
                'name'          => $vendor->name,
                'phone'         => $vendor->phone,
                'products'      => $products,
                'total_qty'     => (int) $products->sum('quantity'),
                'total_orders'  => $vendor->purchases->count(),
                'total_amount'  => round($total, 2),
                'total_paid'    => round($paid, 2),
                'total_balance' => round($total - $paid, 2),
            ];
        })->values();

        // Cards: saare vendors ka overall hisaab (search se asar nahi padta)
        $allTotal = (float) VendorPurchase::sum('total_amount');
        $allPaid  = (float) VendorPurchase::sum('paid_amount');

        return response()->json([
            'data'    => $rows,
            'summary' => [
                'total_vendors' => Vendor::count(),
                'total_amount'  => round($allTotal, 2),
                'total_paid'    => round($allPaid, 2),
                'total_balance' => round($allTotal - $allPaid, 2),
                'pending_count' => $rows->where('total_balance', '>', 0)->count(),
            ],
        ]);
    }

    // GET /api/credit/vendors/{vendor}/history
    // Eye button: saari invoices (product-wise) + payment history
    public function history(Vendor $vendor)
    {
        $purchases = $vendor->purchases()
            ->with(['items', 'payments'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        // "All Records" table: har product ki alag row
        $records = [];
        foreach ($purchases as $purchase) {
            foreach ($purchase->items as $item) {
                $records[] = [
                    'purchase_id' => $purchase->id,
                    'invoice_no'  => $purchase->invoice_no,
                    'date'        => $purchase->created_at,
                    'product'     => $item->item_name,
                    'quantity'    => $item->quantity,
                    'total'       => round($item->quantity * $item->unit_price, 2),
                ];
            }
        }

        // Payment History table
        $payments = $vendor->payments()
            ->with('purchase:id,invoice_no')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($p) => [
                'id'         => $p->id,
                'invoice_no' => $p->purchase?->invoice_no,
                'amount'     => $p->amount,
                'note'       => $p->note,
                'date'       => $p->created_at,
            ]);

        $total = (float) $purchases->sum('total_amount');
        $paid  = (float) $purchases->sum('paid_amount');

        return response()->json([
            'vendor'    => ['id' => $vendor->id, 'name' => $vendor->name],
            'summary'   => [
                'total_orders' => $purchases->count(),
                'total_amount' => round($total, 2),
                'total_paid'   => round($paid, 2),
                'balance'      => round($total - $paid, 2),
            ],
            // Invoice-wise paid/balance (screenshot ke PAID aur BALANCE columns ke liye)
            'invoices'  => $purchases->map(fn ($p) => [
                'id'           => $p->id,
                'invoice_no'   => $p->invoice_no,
                'date'         => $p->created_at,
                'source_type'  => $p->source_type,
                'total_amount' => $p->total_amount,
                'paid_amount'  => $p->paid_amount,
                'balance'      => $p->balance,
            ])->values(),
            'records'   => $records,
            'payments'  => $payments,
        ]);
    }

    // POST /api/credit/vendors  { name, phone? }
    // Add Vendor
    public function store(Request $request)
    {
        $cid = $request->user()->company_id; // <-- NAYA

        $data = $request->validate([
            'name'  => [
                'required', 'string', 'max:255',
                // <-- BADLA: ab sirf apni company ke andar unique
                Rule::unique('vendors', 'name')->where('company_id', $cid),
            ],
            'phone' => 'nullable|string|max:50',
        ]);

        // company_id trait ka creating hook khud set karta hai
        $vendor = Vendor::create([
            'name'  => trim($data['name']),
            'phone' => $data['phone'] ?? null,
        ]);

        return response()->json([
            'message' => 'Vendor added successfully.',
            'data'    => $vendor,
        ], 201);
    }

    // PUT /api/credit/vendors/{vendor}  { name, phone? }
    // Edit Vendor
    public function update(Request $request, Vendor $vendor)
    {
        $cid = $request->user()->company_id; // <-- NAYA

        $data = $request->validate([
            'name'  => [
                'required', 'string', 'max:255',
                // <-- BADLA: apni company ke andar unique (khud ko ignore)
                Rule::unique('vendors', 'name')
                    ->where('company_id', $cid)
                    ->ignore($vendor->id),
            ],
            'phone' => 'nullable|string|max:50',
        ]);

        $vendor->update([
            'name'  => trim($data['name']),
            'phone' => $data['phone'] ?? null,
        ]);

        return response()->json([
            'message' => 'Vendor updated successfully.',
            'data'    => $vendor,
        ]);
    }

    // DELETE /api/credit/vendors/{vendor}
    // Balance baqi ho to delete nahi hoga, warna udhaar ka hisaab gayab ho jayega
    public function destroy(Vendor $vendor)
    {
        $balance = round(
            (float) $vendor->purchases()->sum('total_amount') - (float) $vendor->purchases()->sum('paid_amount'),
            2
        );

        if ($balance > 0) {
            return response()->json([
                'message' => 'Cannot delete this vendor: Rs ' . number_format($balance, 2)
                    . ' is still unpaid. Clear the balance with Pay Now first.',
            ], 422);
        }

        $vendor->delete(); // invoices, items aur payments cascade se delete ho jate hain

        return response()->json(['message' => 'Vendor deleted successfully.']);
    }

    // POST /api/credit/vendors/{vendor}/pay
    // Pay Now: amount sabse purani unpaid invoice se bharna shuru hota hai (oldest first)
    // Cash in hand: jitni payment ki, utni cash in hand se kat'ti hai. Cash kam ho to payment block.
    public function pay(Request $request, Vendor $vendor)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'note'   => 'nullable|string|max:255',
        ]);

        $amount = round((float) $data['amount'], 2);

        try {
            $paid = DB::transaction(function () use ($request, $vendor, $data, $amount) {
                // lockForUpdate: do log ek saath pay karein to hisaab na bigray
                $purchases = VendorPurchase::where('vendor_id', $vendor->id)
                    ->whereColumn('paid_amount', '<', 'total_amount')
                    ->orderBy('created_at')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                $balance = round($purchases->sum(fn ($p) => $p->total_amount - $p->paid_amount), 2);

                if ($balance <= 0) {
                    abort(response()->json(['message' => 'This vendor has no balance left to pay.'], 422));
                }

                if ($amount > $balance) {
                    abort(response()->json([
                        'message' => 'Amount is more than the balance. Remaining balance: Rs ' . number_format($balance, 2) . '.',
                    ], 422));
                }

                // Cash in hand se paise kaato (kam hon to RuntimeException -> payment rollback)
                CashInHandEntry::spend(
                    $amount,
                    'Vendor payment: ' . $vendor->name . (filled($data['note'] ?? null) ? ' - ' . $data['note'] : ''),
                    $request->user()
                );

                $remaining = $amount;

                foreach ($purchases as $purchase) {
                    if ($remaining <= 0) {
                        break;
                    }

                    $due   = round($purchase->total_amount - $purchase->paid_amount, 2);
                    $apply = min($due, $remaining);

                    $purchase->paid_amount = round($purchase->paid_amount + $apply, 2);
                    $purchase->save();

                    // company_id trait ka creating hook khud set karta hai
                    VendorPayment::create([
                        'vendor_id'   => $vendor->id,
                        'purchase_id' => $purchase->id,
                        'amount'      => $apply,
                        'note'        => $data['note'] ?? null,
                    ]);

                    $remaining = round($remaining - $apply, 2);
                }

                return $amount;
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Payment saved: Rs ' . number_format($paid, 2),
        ]);
    }
}