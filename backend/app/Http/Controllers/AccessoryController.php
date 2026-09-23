<?php

namespace App\Http\Controllers;

use App\Models\Accessory;
use Illuminate\Http\Request;

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

    // POST /api/accessories
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'quantity' => 'required|integer|min:0',
            'image'    => 'nullable|string',
            'notes'    => 'nullable|string',
        ]);

        $accessory = new Accessory($data);
        $accessory->updateStatusFromQuantity();
        $accessory->save();

        return response()->json([
            'message' => 'Item added successfully',
            'data'    => $accessory,
        ], 201);
    }

    // PUT /api/accessories/{accessory}
    public function update(Request $request, Accessory $accessory)
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:255',
            'quantity' => 'sometimes|integer|min:0',
            'image'    => 'nullable|string',
            'notes'    => 'nullable|string',
        ]);

        $accessory->fill($data);
        $accessory->updateStatusFromQuantity();
        $accessory->save();

        return response()->json([
            'message' => 'Item updated successfully',
            'data'    => $accessory,
        ]);
    }

    // DELETE /api/accessories/{accessory}
    public function destroy(Accessory $accessory)
    {
        $accessory->delete();

        return response()->json(['message' => 'Item deleted successfully']);
    }
}