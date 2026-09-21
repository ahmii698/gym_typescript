<?php

namespace App\Http\Controllers;

use App\Models\Trainer;
use Illuminate\Http\Request;

class TrainerController extends Controller
{
    public function index()
    {
        return response()->json(
            Trainer::where('is_active', true)->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'           => ['required', 'string', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:20'],
            'email'          => ['nullable', 'email', 'max:255'],
            'specialization' => ['nullable', 'string', 'max:255'],
        ]);

        $trainer = Trainer::create($data);

        return response()->json([
            'message' => 'Trainer added successfully',
            'data'    => $trainer,
        ], 201);
    }
}