<?php

namespace App\Http\Controllers;

use App\Models\CashInHandEntry;
use App\Models\Drink;
use App\Models\DrinkRestock;
use App\Models\DrinkSale;
use App\Models\Vendor;
use App\Models\VendorPayment;
use App\Models\VendorPurchase;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;

class DrinkController extends Controller
{
    // List (admin + frontdesk dono dekh sakain)
    public function index(Request $request)
    {
        $query = Drink::query();

        if ($request->filled('category') && $request->category !== 'All Categories') {
            $query->where('category', $request->category);
        }
        if ($request->filled('status') && $request->status !== 'all') {
            // quantity-based filter, kyunke status DB column nahi hai
            match ($request->status) {
                'out' => $query->where('quantity', '<=', 0),
                'low' => $query->whereColumn('quantity', '<=', 'low_stock_threshold')->where('quantity', '>', 0),
                'in' => $query->whereColumn('quantity', '>', 'low_stock_threshold'),
                default => null,
            };
        }
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        return response()->json($query->orderBy('name')->get());
    }

    // Naya item add karna
    // Optional credit purchase: vendor_name + invoice_no + paid_now
    // Cash in hand: bina vendor ke poora bill, vendor ke saath sirf paid_now cash se katta hai.
    public function store(Request $request)
    {
        $isCredit = filled($request->input('vendor_name'));

        $data = $request->validate([
            'name' => 'required|string',
            'category' => 'required|string',
            'unit' => 'required|string',
            'quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'integer|min:0',
            'price' => 'numeric|min:0',        // selling price
            // credit purchase mein cost price zaroori hai (bill = quantity x cost_price)
            'cost_price' => [Rule::requiredIf($isCredit), 'numeric', 'min:0'],   // khareed price

            // ---- Vendor credit (optional) ----
            'vendor_name' => 'nullable|string|max:255',
            'invoice_no' => [
                Rule::requiredIf($isCredit),
                'nullable',
                'string',
                'max:100',
                'unique:vendor_purchases,invoice_no',
            ],
            'paid_now' => 'nullable|numeric|min:0',
        ]);

        $totalBill = round((int) $data['quantity'] * (float) ($data['cost_price'] ?? 0), 2);

        if ($isCredit) {
            if ((int) $data['quantity'] < 1) {
                return response()->json([
                    'message' => 'Quantity must be at least 1 for a vendor purchase.',
                ], 422);
            }

            $paid = round((float) ($data['paid_now'] ?? 0), 2);

            if ($paid > $totalBill) {
                return response()->json([
                    'message' => 'Paid Now cannot be more than the total bill (Rs ' . number_format($totalBill, 2) . ').',
                ], 422);
            }
        }

        // Is purchase ke liye cash in hand se kitna katna hai
        $cashToSpend = $isCredit
            ? round((float) ($data['paid_now'] ?? 0), 2)
            : $totalBill;

        try {
            $drink = DB::transaction(function () use ($request, $data, $isCredit, $cashToSpend) {
                $drink = Drink::create(Arr::only($data, [
                    'name', 'category', 'unit', 'quantity',
                    'low_stock_threshold', 'price', 'cost_price',
                ]));

                // Cash in hand se paise kaato (kam hon to RuntimeException -> poori purchase rollback)
                CashInHandEntry::spend(
                    $cashToSpend,
                    $isCredit
                        ? 'Drink purchase (paid now): ' . $drink->name . ' x' . $data['quantity']
                            . ' - Vendor: ' . trim($data['vendor_name']) . ', Invoice: ' . trim($data['invoice_no'])
                        : 'Drink purchase: ' . $drink->name . ' x' . $data['quantity'],
                    $request->user()
                );

                if ($isCredit) {
                    $this->recordCredit(
                        $drink,
                        (int) $data['quantity'],
                        (float) $data['cost_price'],
                        $data['vendor_name'],
                        $data['invoice_no'],
                        (float) ($data['paid_now'] ?? 0)
                    );
                }

                return $drink;
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($drink, 201);
    }

    // Admin: edit
    public function update(Request $request, Drink $drink)
    {
        $drink->update($request->validate([
            'name' => 'sometimes|string',
            'category' => 'sometimes|string',
            'unit' => 'sometimes|string',
            'quantity' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'price' => 'sometimes|numeric|min:0',
            'cost_price' => 'sometimes|numeric|min:0',
        ]));

        return response()->json($drink);
    }

    // Frontdesk: item bechna (stock kam hoga)
    public function sell(Request $request, Drink $drink)
    {
        $request->validate(['quantity' => 'required|integer|min:1']);

        if ($drink->quantity < $request->quantity) {
            return response()->json(['message' => 'Not enough stock'], 422);
        }

        $drink->decrement('quantity', $request->quantity);

        $sale = DrinkSale::create([
            'drink_id' => $drink->id,
            'sold_by' => $request->user()?->id,
            'quantity' => $request->quantity,
            // cost_price ko is waqt snapshot kar rahe hain, taake baad mein
            // cost badle to purani sales ka profit sahi rahe.
            'cost_price' => $drink->cost_price,
            'total_price' => $drink->price * $request->quantity,
        ]);

        return response()->json(['drink' => $drink->fresh(), 'sale' => $sale]);
    }

    // Admin/Frontdesk: stock wapis add karna (naya maal aaya)
    // Optional credit purchase: vendor_name + invoice_no + paid_now
    // Cash in hand: bina vendor ke poora bill, vendor ke saath sirf paid_now cash se katta hai.
    public function restock(Request $request, Drink $drink)
    {
        $isCredit = filled($request->input('vendor_name'));

        $data = $request->validate([
            'quantity' => 'required|integer|min:1',
            'cost_price' => 'nullable|numeric|min:0',

            // ---- Vendor credit (optional) ----
            'vendor_name' => 'nullable|string|max:255',
            'invoice_no' => [
                Rule::requiredIf($isCredit),
                'nullable',
                'string',
                'max:100',
                'unique:vendor_purchases,invoice_no',
            ],
            'paid_now' => 'nullable|numeric|min:0',
        ]);

        // Naya cost price diya hai to wo, warna drink ka maujooda cost price
        $unitCost = (array_key_exists('cost_price', $data) && $data['cost_price'] !== null)
            ? (float) $data['cost_price']
            : (float) $drink->cost_price;

        $totalBill = round($data['quantity'] * $unitCost, 2);

        if ($isCredit) {
            $paid = round((float) ($data['paid_now'] ?? 0), 2);

            if ($paid > $totalBill) {
                return response()->json([
                    'message' => 'Paid Now cannot be more than the total bill (Rs ' . number_format($totalBill, 2) . ').',
                ], 422);
            }
        }

        // Is purchase ke liye cash in hand se kitna katna hai
        $cashToSpend = $isCredit
            ? round((float) ($data['paid_now'] ?? 0), 2)
            : $totalBill;

        try {
            $restock = DB::transaction(function () use ($request, $drink, $data, $isCredit, $unitCost, $cashToSpend) {
                $drink->increment('quantity', $data['quantity']);

                // agar naya khareed price diya hai to drink ki cost_price update kar do
                if (array_key_exists('cost_price', $data) && $data['cost_price'] !== null) {
                    $drink->update(['cost_price' => $data['cost_price']]);
                }

                $restock = DrinkRestock::create([
                    'drink_id' => $drink->id,
                    'restocked_by' => $request->user()?->id,
                    'quantity' => $data['quantity'],
                    'cost_price' => $drink->cost_price,
                ]);

                // Cash in hand se paise kaato (kam hon to RuntimeException -> poora restock rollback)
                CashInHandEntry::spend(
                    $cashToSpend,
                    $isCredit
                        ? 'Drink restock (paid now): ' . $drink->name . ' x' . $data['quantity']
                            . ' - Vendor: ' . trim($data['vendor_name']) . ', Invoice: ' . trim($data['invoice_no'])
                        : 'Drink restock: ' . $drink->name . ' x' . $data['quantity'],
                    $request->user()
                );

                if ($isCredit) {
                    $this->recordCredit(
                        $drink,
                        (int) $data['quantity'],
                        $unitCost,
                        $data['vendor_name'],
                        $data['invoice_no'],
                        (float) ($data['paid_now'] ?? 0)
                    );
                }

                return $restock;
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['drink' => $drink->fresh(), 'restock' => $restock]);
    }

    // Kisi bhi ek drink ki poori history: kab bikee, kab restock hui
    public function history(Drink $drink)
    {
        $sales = $drink->sales()->with('soldBy:id,name')->latest()->get()->map(fn ($s) => [
            'type' => 'sale',
            'quantity' => -$s->quantity, // stock kam hua
            'amount' => (float) $s->total_price,
            'profit' => (float) $s->total_price - ((float) $s->cost_price * $s->quantity),
            'by' => $s->soldBy?->name,
            'created_at' => $s->created_at,
        ]);

        $restocks = $drink->restocks()->with('restockedBy:id,name')->latest()->get()->map(fn ($r) => [
            'type' => 'restock',
            'quantity' => $r->quantity, // stock barha
            'amount' => null,
            'profit' => null,
            'by' => $r->restockedBy?->name,
            'created_at' => $r->created_at,
        ]);

        $history = $sales->concat($restocks)
            ->sortByDesc('created_at')
            ->values();

        return response()->json($history);
    }

    public function destroy(Drink $drink)
    {
        $drink->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Vendor credit record banata hai: vendor (naya ya purana) + invoice + item + paid payment.
     * Hamesha DB::transaction ke andar se call karein.
     */
    private function recordCredit(
        Drink $drink,
        int $quantity,
        float $unitCost,
        string $vendorName,
        string $invoiceNo,
        float $paidNow
    ): void {
        $vendor = Vendor::firstOrCreate(['name' => trim($vendorName)]);

        $total = round($quantity * $unitCost, 2);
        $paid = round($paidNow, 2);

        $purchase = VendorPurchase::create([
            'vendor_id' => $vendor->id,
            'invoice_no' => trim($invoiceNo),
            'source_type' => 'drink',
            'total_amount' => $total,
            'paid_amount' => $paid,
        ]);

        $purchase->items()->create([
            'item_type' => 'drink',
            'item_id' => $drink->id,
            'item_name' => $drink->name,
            'quantity' => $quantity,
            'unit_price' => $unitCost,
        ]);

        // Agar usi waqt kuch paise diye to wo bhi payment history mein dikhein
        if ($paid > 0) {
            VendorPayment::create([
                'vendor_id' => $vendor->id,
                'purchase_id' => $purchase->id,
                'amount' => $paid,
                'note' => 'Paid at purchase',
            ]);
        }
    }
}