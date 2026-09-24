<?php

namespace App\Http\Controllers;

use App\Models\Drink;
use App\Models\DrinkRestock;
use App\Models\DrinkSale;
use Illuminate\Http\Request;

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

    // Admin: naya item add karna
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'category' => 'required|string',
            'unit' => 'required|string',
            'quantity' => 'required|integer|min:0',
            'low_stock_threshold' => 'integer|min:0',
            'price' => 'numeric|min:0',        // selling price
            'cost_price' => 'numeric|min:0',   // khareed price
        ]);

        return response()->json(Drink::create($data), 201);
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
    public function restock(Request $request, Drink $drink)
    {
        $data = $request->validate([
            'quantity' => 'required|integer|min:1',
            'cost_price' => 'nullable|numeric|min:0',
        ]);

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
}