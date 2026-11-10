<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($data)) {
            return response()->json(['message' => 'Invalid email or password'], 401);
        }

        $user = Auth::user();

        // Company blocked hai to login nahi hoga (password sahi ho tab bhi), token bhi nahi banega
        if ($user->company_id) {
            $blocked = DB::table('companies')
                ->where('id', $user->company_id)
                ->value('is_blocked');

            if ($blocked) {
                Auth::logout();

                return response()->json([
                    'code' => 'company_blocked',
                    'message' => 'Your subscription is blocked. Please clear your payment.',
                ], 403);
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'role' => $user->role,
            'name' => $user->name,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function registerAdmin(Request $request)
    {
        return $this->createUser($request, 'admin');
    }

    public function registerFrontdesk(Request $request)
    {
        return $this->createUser($request, 'frontdesk');
    }

    /**
     * PUT /frontdesk/{id}
     * Front desk user ki details edit karna (sirf admin).
     * Password khali ho to purana password hi rehta hai.
     * Admin sirf apni company ka frontdesk edit kar sakta hai.
     */
    public function updateFrontdesk(Request $request, $id)
    {
        $user = User::where('id', $id)
            ->where('role', 'frontdesk')
            ->where('company_id', $request->user()->company_id) // doosri company ka user edit na ho
            ->first();

        if (!$user) {
            return response()->json(['message' => 'Front desk user not found'], 404);
        }

        $data = $request->validate([
            'fullName'    => 'required|string|max:255',
            'email'       => 'required|email|unique:users,email,' . $user->id,
            'phone'       => 'required|string',
            'base_salary' => 'nullable|numeric|min:0',
            'password'    => 'nullable|min:6|confirmed',
        ]);

        $user->name        = $data['fullName'];
        $user->email       = $data['email'];
        $user->phone       = $data['phone'];
        $user->base_salary = $data['base_salary'] ?? 0;

        if (!empty($data['password'])) {
            $user->password = $data['password']; // model ka 'hashed' cast khud hash kar dega
        }

        $user->save();

        return response()->json([
            'message' => 'Front desk updated',
            'data'    => $user->only('id', 'name', 'phone', 'email', 'base_salary'),
        ]);
    }

    private function createUser(Request $request, string $role)
    {
        $data = $request->validate([
            'fullName'    => 'required|string|max:255',
            'email'       => 'required|email|unique:users,email',
            'phone'       => 'required|string',
            'base_salary' => 'nullable|numeric|min:0',
            'password'    => 'required|min:6|confirmed',
        ]);

        $user = new User([
            'name'        => $data['fullName'],
            'email'       => $data['email'],
            'phone'       => $data['phone'],
            'password'    => $data['password'],
            'role'        => $role,
            'base_salary' => $data['base_salary'] ?? 0,
        ]);

        // Naya user usi company ka banega jis ka login wala admin hai.
        // Request se company_id nahi li jati, taake koi doosri company mein user na bana sake.
        $user->company_id = $request->user()->company_id;
        $user->save();

        return response()->json([
            'message' => ucfirst($role) . ' created',
            'data'    => $user->only('id', 'name', 'phone', 'email', 'base_salary'),
        ], 201);
    }
}