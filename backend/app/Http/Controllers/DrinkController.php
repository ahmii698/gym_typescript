<?php

namespace App\Http\Controllers;

use App\Models\Drink;
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
            'price' => 'numeric|min:0',
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
            'total_price' => $drink->price * $request->quantity,
        ]);

        return response()->json(['drink' => $drink->fresh(), 'sale' => $sale]);
    }

    public function destroy(Drink $drink)
    {
        $drink->delete();
        return response()->json(['message' => 'Deleted']);
    }
}