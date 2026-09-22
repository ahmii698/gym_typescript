<?php

namespace App\Http\Controllers;

use App\Models\Trainer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        $data = $this->validated($request);

        $trainer = Trainer::create($data);

        return response()->json([
            'message' => 'Trainer added successfully',
            'data'    => $trainer,
        ], 201);
    }

    public function show(Trainer $trainer)
    {
        return response()->json($trainer);
    }

    public function update(Request $request, Trainer $trainer)
    {
        $data = $this->validated($request, $trainer->id);

        $trainer->update($data);

        return response()->json([
            'message' => 'Trainer updated successfully',
            'data'    => $trainer,
        ]);
    }

    public function destroy(Trainer $trainer)
    {
        $trainer->delete();

        return response()->json(['message' => 'Trainer deleted successfully']);
    }

    private function validated(Request $request, ?int $trainerId = null): array
    {
        return $request->validate([
            'name'              => ['required', 'string', 'max:255'],
            'phone'             => ['nullable', 'string', 'max:20'],
            'cnic'              => [
                'nullable', 'string',
                Rule::unique('trainers', 'cnic')->ignore($trainerId),
            ],
            'email'             => ['nullable', 'email', 'max:255'],
            'specialization'    => ['nullable', 'string', 'max:255'],
            'role'              => ['nullable', 'string', 'max:255'],
            'status'            => ['nullable', Rule::in(['Active', 'On Leave', 'Inactive'])],
            'experience_years'  => ['nullable', 'integer', 'min:0', 'max:60'],
            'photo_url'         => ['nullable', 'url', 'max:2048'],
        ]);
    }
}