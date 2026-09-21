<?php

namespace App\Http\Controllers;

use App\Models\Package;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    public function index()
    {
        return response()->json(
            Package::where('is_active', true)->orderBy('price')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'price'         => ['required', 'numeric', 'min:0'],
        ]);

        $package = Package::create($data);

        return response()->json([
            'message' => 'Package added successfully',
            'data'    => $package,
        ], 201);
    }
}