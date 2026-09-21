<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\TrainerController;
use Illuminate\Support\Facades\Route;

// ---------- Public routes (bina login ke) ----------
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// Forgot password (OTP flow)
Route::post('/forgot-password', [PasswordResetController::class, 'sendOtp'])->middleware('throttle:5,1');
Route::post('/verify-otp', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:10,1');

// ---------- Protected routes (login zaroori) ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // Members (admin + frontdesk dono access kar sakte hain)
    Route::get('/members', [MemberController::class, 'index']);
    Route::post('/members', [MemberController::class, 'store']);
    Route::get('/members/{member}', [MemberController::class, 'show']);

    // Trainers (dropdown + "Add New Trainer")
    Route::get('/trainers', [TrainerController::class, 'index']);
    Route::post('/trainers', [TrainerController::class, 'store']);

    // Packages (dropdown)
    Route::get('/packages', [PackageController::class, 'index']);

    // Sirf admin
    Route::middleware('role:admin')->group(function () {
        Route::post('/admin/register', [AuthController::class, 'registerAdmin']);
        Route::post('/frontdesk/register', [AuthController::class, 'registerFrontdesk']);

        Route::post('/packages', [PackageController::class, 'store']);
    });
});