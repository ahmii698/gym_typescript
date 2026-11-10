<?php

// app/Http/Controllers/StaffController.php

namespace App\Http\Controllers;

use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    private const PHONE_REGEX = '/^[0-9+\-\s]{10,15}$/';

    private function messages(): array
    {
        return [
            'name.required'  => 'Name is required.',
            'phone.required' => 'Phone number is required.',
            'phone.regex'    => 'Enter a valid phone number.',
            'phone.unique'   => 'A staff member with this phone number already exists.',
            'email.email'    => 'Enter a valid email address.',
            'salary.numeric' => 'Salary must be a number.',
            'salary.min'     => 'Salary must be 0 or more.',
        ];
    }

    // GET /api/staff
    public function index(): JsonResponse
    {
        $staff = Staff::orderByDesc('id')->get();

        return response()->json(['success' => true, 'data' => $staff]);
    }

    // POST /api/staff
    public function store(Request $request): JsonResponse
    {
        $cid = $request->user()->company_id; // <-- NAYA

        $data = $request->validate([
            'name'   => ['required', 'string', 'max:100'],
            'phone'  => [
                'required', 'string', 'regex:' . self::PHONE_REGEX,
                // <-- BADLA: ab sirf apni company ke andar unique
                Rule::unique('staff', 'phone')->where('company_id', $cid),
            ],
            'email'  => ['nullable', 'email', 'max:150'],
            'salary' => ['nullable', 'numeric', 'min:0'],
        ], $this->messages());

        // company_id trait ka creating hook khud set karta hai
        $staff = Staff::create([
            'name'   => trim($data['name']),
            'phone'  => trim($data['phone']),
            'email'  => $data['email'] ?? null,
            'salary' => $data['salary'] ?? 0,
            'role'   => 'Staff', // role is always Staff by default
        ]);

        return response()->json(['success' => true, 'data' => $staff->fresh()], 201);
    }

    // PUT /api/staff/{staff}
    public function update(Request $request, Staff $staff): JsonResponse
    {
        $cid = $request->user()->company_id; // <-- NAYA

        $data = $request->validate([
            'name'   => ['required', 'string', 'max:100'],
            'phone'  => [
                'required', 'string', 'regex:' . self::PHONE_REGEX,
                // <-- BADLA: apni company ke andar unique (khud ko ignore)
                Rule::unique('staff', 'phone')
                    ->where('company_id', $cid)
                    ->ignore($staff->id),
            ],
            'email'  => ['nullable', 'email', 'max:150'],
            'salary' => ['nullable', 'numeric', 'min:0'],
        ], $this->messages());

        $staff->update([
            'name'   => trim($data['name']),
            'phone'  => trim($data['phone']),
            'email'  => $data['email'] ?? null,
            'salary' => $data['salary'] ?? 0,
        ]);

        return response()->json(['success' => true, 'data' => $staff->fresh()]);
    }

    // DELETE /api/staff/{staff}
    public function destroy(Staff $staff): JsonResponse
    {
        $staff->delete();

        return response()->json(['success' => true, 'message' => 'Staff member deleted.']);
    }
}