<?php

namespace App\Http\Controllers;

use App\Models\Accessory;
use App\Models\AccessoryStockLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AccessoryController extends Controller
{
    // GET /api/accessories
    public function index(Request $request)
    {
        $query = Accessory::query();

        if ($request->filled('q')) {
            $query->where('name', 'like', '%' . $request->q . '%');
        }

        if ($request->filled('category') && $request->category !== 'All Categories') {
            $query->where('category', $request->category);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        $items = $query->latest()->get();

        return response()->json([
            'data'  => $items,
            'stats' => [
                'total' => Accessory::count(),
                'in'    => Accessory::where('status', 'in')->count(),
                'low'   => Accessory::where('status', 'low')->count(),
                'out'   => Accessory::where('status', 'out')->count(),
            ],
        ]);
    }

    // GET /api/accessories/spend-summary
    // 4 spend cards ke liye data: all-time total, today, this week,
    // aur ek flexible card jo month / week / custom date range accept karta hai.
    public function spendSummary(Request $request)
    {
        $data = $request->validate([
            'filter_type' => 'nullable|in:month,week,custom',
            'month'       => 'nullable|integer|min:1|max:12',
            'year'        => 'nullable|integer|min:2000|max:2100',
            'week_date'   => 'nullable|date',
            'from'        => 'nullable|date',
            'to'          => 'nullable|date',
        ]);

        // Sirf wo logs jinme actually khareedari hui hai (stock badha aur price save hui)
        $base = fn () => AccessoryStockLog::query()
            ->where('quantity_change', '>', 0)
            ->whereNotNull('unit_price');

        $sum = fn ($query) => (float) round(
            (clone $query)->sum(DB::raw('quantity_change * unit_price')),
            2
        );

        // All-time — jab se software bana, ab tak
        $totalAllTime = $sum($base());

        // Today
        $today = $sum($base()->whereDate('created_at', now()->toDateString()));

        // This week (Mon - Sun)
        $thisWeek = $sum($base()->whereBetween('created_at', [
            now()->startOfWeek(), now()->endOfWeek(),
        ]));

        // Flexible card: month / week / custom date range
        $filterType = $data['filter_type'] ?? 'month';

        if ($filterType === 'week') {
            $anchor = isset($data['week_date']) ? Carbon::parse($data['week_date']) : now();
            $start  = $anchor->copy()->startOfWeek();
            $end    = $anchor->copy()->endOfWeek();
            $label  = $start->format('d M') . ' - ' . $end->format('d M Y');
        } elseif ($filterType === 'custom') {
            $start = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : now()->startOfDay();
            $end   = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : now()->endOfDay();
            $label = $start->format('d M Y') . ' - ' . $end->format('d M Y');
        } else { // month (default)
            $month = $data['month'] ?? now()->month;
            $year  = $data['year'] ?? now()->year;
            $start = Carbon::create($year, $month, 1)->startOfMonth();
            $end   = $start->copy()->endOfMonth();
            $label = $start->format('F Y');
        }

        $filtered = $sum($base()->whereBetween('created_at', [$start, $end]));

        return response()->json([
            'total_all_time' => $totalAllTime,
            'today'          => $today,
            'this_week'      => $thisWeek,
            'filtered'       => [
                'type'  => $filterType,
                'label' => $label,
                'value' => $filtered,
            ],
        ]);
    }

    // POST /api/accessories
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:255',
            'category'   => 'required|string|max:255',
            'quantity'   => 'required|integer|min:0',
            // price is required whenever some stock is being added
            'unit_price' => [
                Rule::requiredIf((int) $request->input('quantity') > 0),
                'nullable',
                'numeric',
                'min:0',
            ],
            'image'      => 'nullable|string',
            'notes'      => 'nullable|string',
        ]);

        $accessory = DB::transaction(function () use ($data) {
            $accessory = new Accessory($data);
            $accessory->updateStatusFromQuantity();
            $accessory->save();

            if ($accessory->quantity > 0) {
                $accessory->stockLogs()->create([
                    'type'            => 'initial',
                    'quantity_change' => $accessory->quantity,
                    'quantity_after'  => $accessory->quantity,
                    'unit_price'      => $data['unit_price'] ?? null,
                    'note'            => 'New item added',
                ]);
            }

            return $accessory;
        });

        return response()->json([
            'message' => 'Item added successfully',
            'data'    => $accessory,
        ], 201);
    }

    // PUT /api/accessories/{accessory}
    // Edit name/category/notes, or reduce stock (damaged, lost, given away...).
    // Increasing stock must go through restock() so the price is recorded.
    public function update(Request $request, Accessory $accessory)
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:255',
            'quantity' => 'sometimes|integer|min:0',
            'image'    => 'nullable|string',
            'notes'    => 'nullable|string',
            'reason'   => 'nullable|string|max:255',
        ]);

        $newQty = $data['quantity'] ?? $accessory->quantity;
        $delta  = $newQty - $accessory->quantity;

        if ($delta > 0) {
            return response()->json([
                'message' => 'Stock badhane ke liye Restock (+) use karein taake price bhi save ho.',
            ], 422);
        }

        DB::transaction(function () use ($accessory, $data, $newQty, $delta) {
            $accessory->fill(Arr::only($data, ['name', 'category', 'notes', 'image']));
            $accessory->quantity = $newQty;
            $accessory->updateStatusFromQuantity();
            $accessory->save();

            if ($delta < 0) {
                $accessory->stockLogs()->create([
                    'type'            => 'removed',
                    'quantity_change' => $delta,
                    'quantity_after'  => $newQty,
                    'unit_price'      => null,
                    'note'            => $data['reason'] ?? null,
                ]);
            }
        });

        return response()->json([
            'message' => 'Item updated successfully',
            'data'    => $accessory->fresh(),
        ]);
    }

    // POST /api/accessories/{accessory}/restock
    public function restock(Request $request, Accessory $accessory)
    {
        $data = $request->validate([
            'quantity'   => 'required|integer|min:1',
            'unit_price' => 'required|numeric|min:0',
            'note'       => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($accessory, $data) {
            $accessory->quantity   = $accessory->quantity + $data['quantity'];
            $accessory->unit_price = $data['unit_price']; // latest purchase price
            $accessory->updateStatusFromQuantity();
            $accessory->save();

            $accessory->stockLogs()->create([
                'type'            => 'restock',
                'quantity_change' => $data['quantity'],
                'quantity_after'  => $accessory->quantity,
                'unit_price'      => $data['unit_price'],
                'note'            => $data['note'] ?? null,
            ]);
        });

        return response()->json([
            'message' => 'Stock added successfully',
            'data'    => $accessory->fresh(),
        ]);
    }

    // GET /api/accessories/{accessory}/history
    public function history(Accessory $accessory)
    {
        $logs = $accessory->stockLogs()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        // Only purchases that have a price count towards spending / average
        $priced = $logs->where('quantity_change', '>', 0)->whereNotNull('unit_price');

        $unitsBought = (int) $priced->sum('quantity_change');
        $totalSpent  = (float) $priced->sum(fn ($l) => $l->quantity_change * $l->unit_price);

        return response()->json([
            'data'    => $logs,
            'summary' => [
                'total_purchased' => (int) $logs->where('quantity_change', '>', 0)->sum('quantity_change'),
                'total_spent'     => round($totalSpent, 2),
                'avg_unit_price'  => $unitsBought > 0 ? round($totalSpent / $unitsBought, 2) : null,
                'last_unit_price' => $accessory->unit_price,
            ],
        ]);
    }

    // DELETE /api/accessories/{accessory}
    public function destroy(Accessory $accessory)
    {
        $accessory->delete(); // history is removed automatically (cascade)

        return response()->json(['message' => 'Item deleted successfully']);
    }
}