<?php

namespace App\Http\Controllers;

use App\Models\SuperAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SuperAdminAuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $admin = SuperAdmin::where('email', $data['email'])->first();

        if (!$admin || !Hash::check($data['password'], $admin->password)) {
            return response()->json(['message' => 'Email ya password ghalat hai.'], 401);
        }

        return response()->json([
            'token' => $admin->createToken('super-admin')->plainTextToken,
            'user'  => $admin,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user('super_admin')->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user('super_admin'));
    }
}