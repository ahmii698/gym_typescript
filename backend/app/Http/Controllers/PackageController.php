<?php
// app/Http/Controllers/PackageController.php

namespace App\Http\Controllers;

use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PackageController extends Controller
{
    public function index(Request $request)
    {
        $query = Package::query();

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('is_active', $request->status === 'Active');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('features', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $package = Package::create($data);

        return response()->json($package, 201);
    }

    public function show(Package $package)
    {
        return response()->json($package);
    }

    public function update(Request $request, Package $package)
    {
        $data = $this->validateData($request);
        $package->update($data);

        return response()->json($package);
    }

    public function destroy(Package $package)
    {
        $package->delete();

        return response()->json(['message' => 'Package deleted.']);
    }

    private function validateData(Request $request): array
    {
        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'type'          => ['required', Rule::in(['Normal', 'Premium', 'With Trainer'])],
            'price'         => 'required|numeric|min:0',
            'duration_days' => 'required|integer|min:1',
            'features'      => 'required|array|min:1',
            'features.*'    => 'string',
            'icon'          => ['nullable', Rule::in(['dumbbell', 'users', 'user', 'layers'])],
            'is_active'     => 'sometimes|boolean',
        ]);

        $validated['is_active'] = $request->boolean('is_active', true);
        $validated['icon'] = $validated['icon'] ?? 'dumbbell';

        return $validated;
    }
}