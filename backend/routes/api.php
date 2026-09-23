<?php

use App\Http\Controllers\AccessoryController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DrinkController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\TrainerController;
use Illuminate\Support\Facades\Route;

// ---------- Public routes (bina login ke) ----------
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::post('/forgot-password', [PasswordResetController::class, 'sendOtp'])->middleware('throttle:5,1');
Route::post('/verify-otp', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:10,1');

// ---------- Protected routes (login zaroori) ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // Members
    Route::get('/members/fee-overview', [MemberController::class, 'feeOverview']);
    Route::get('/members', [MemberController::class, 'index']);
    Route::post('/members', [MemberController::class, 'store']);
    Route::get('/members/{member}', [MemberController::class, 'show']);
    Route::get('/members/{member}/payments', [PaymentController::class, 'history']);

    // Payments (fee collection)
    Route::post('/payments', [PaymentController::class, 'store']);

    // Trainers
    Route::get('/trainers', [TrainerController::class, 'index']);
    Route::post('/trainers', [TrainerController::class, 'store']);
    Route::get('/trainers/{trainer}', [TrainerController::class, 'show']);
    Route::put('/trainers/{trainer}', [TrainerController::class, 'update']);
    Route::delete('/trainers/{trainer}', [TrainerController::class, 'destroy']);

    // Front desk staff list (admin aur frontdesk dono dekh sakte hain)
    Route::get('/staff/frontdesk', [TrainerController::class, 'frontdesk']);

    // Packages (view + add + edit + delete — sab logged-in users)
    Route::get('/packages', [PackageController::class, 'index']);
    Route::get('/packages/{package}', [PackageController::class, 'show']);
    Route::post('/packages', [PackageController::class, 'store']);
    Route::put('/packages/{package}', [PackageController::class, 'update']);
    Route::delete('/packages/{package}', [PackageController::class, 'destroy']);

    // Attendance (view + toggle — admin aur frontdesk dono)
    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::post('/attendance/{member}/toggle', [AttendanceController::class, 'toggle']);
    Route::get('/attendance/stats', [AttendanceController::class, 'stats']);

    // Drinks (view + add + sell — admin aur frontdesk dono)
    Route::get('/drinks', [DrinkController::class, 'index']);
    Route::post('/drinks', [DrinkController::class, 'store']);
    Route::post('/drinks/{drink}/sell', [DrinkController::class, 'sell']);

    // Accessories / Inventory (view + add + edit + delete — admin aur frontdesk dono)
    Route::get('/accessories', [AccessoryController::class, 'index']);
    Route::post('/accessories', [AccessoryController::class, 'store']);
    Route::put('/accessories/{accessory}', [AccessoryController::class, 'update']);
    Route::delete('/accessories/{accessory}', [AccessoryController::class, 'destroy']);

    // Sirf admin
    Route::middleware('role:admin')->group(function () {
        Route::post('/admin/register', [AuthController::class, 'registerAdmin']);
        Route::post('/frontdesk/register', [AuthController::class, 'registerFrontdesk']);

        // Drinks — edit/delete sirf admin karega
        Route::put('/drinks/{drink}', [DrinkController::class, 'update']);
        Route::delete('/drinks/{drink}', [DrinkController::class, 'destroy']);
    });
});