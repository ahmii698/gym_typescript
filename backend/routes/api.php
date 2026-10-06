<?php

use App\Http\Controllers\AccessoryController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DrinkController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\OwnerDashboardController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\TrainerController;
use App\Http\Controllers\FixedExpenseController;
use App\Http\Controllers\ExtraExpenseController;
use App\Http\Controllers\SalaryController;
use Illuminate\Support\Facades\Route;

// ---------- Public routes (bina login ke) ----------
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::post('/forgot-password', [PasswordResetController::class, 'sendOtp'])->middleware('throttle:5,1');
Route::post('/verify-otp', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:10,1');

// ---------- Protected routes (login zaroori) ----------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // Dashboard stats (front desk / admin)
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Owner Dashboard stats (owner panel)
    Route::get('/owner/dashboard/stats', [OwnerDashboardController::class, 'stats']);

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

    // Attendance (view + toggle + history — admin aur frontdesk dono)
    // NOTE: checkins / checkin-stats routes {member} wale routes se pehle honi chahiye,
    // warna Laravel "checkins" ya "checkin-stats" ko {member} ID samajh kar match karega.
    Route::get('/attendance/checkins', [AttendanceController::class, 'checkins']);
    Route::get('/attendance/checkin-stats', [AttendanceController::class, 'checkinStats']);
    Route::get('/attendance', [AttendanceController::class, 'index']);
    Route::post('/attendance/{member}/toggle', [AttendanceController::class, 'toggle']);
    Route::get('/attendance/stats', [AttendanceController::class, 'stats']);
    Route::get('/attendance/{member}/history', [AttendanceController::class, 'history']);

    // Drinks (view + add + sell — admin aur frontdesk dono)
    Route::get('/drinks', [DrinkController::class, 'index']);
    Route::post('/drinks', [DrinkController::class, 'store']);
    Route::post('/drinks/{drink}/sell', [DrinkController::class, 'sell']);
    Route::post('/drinks/{drink}/restock', [DrinkController::class, 'restock']);
    Route::get('/drinks/{drink}/history', [DrinkController::class, 'history']);

    // Accessories / Inventory (view + add + edit + delete + restock + history — admin aur frontdesk dono)
    // NOTE: spend-summary route {accessory} wale routes se pehle honi chahiye,
    // warna Laravel "spend-summary" ko ek {accessory} ID samajh kar match karega.
    Route::get('/accessories/spend-summary', [AccessoryController::class, 'spendSummary']);
    Route::get('/accessories', [AccessoryController::class, 'index']);
    Route::post('/accessories', [AccessoryController::class, 'store']);
    Route::put('/accessories/{accessory}', [AccessoryController::class, 'update']);
    Route::delete('/accessories/{accessory}', [AccessoryController::class, 'destroy']);
    Route::post('/accessories/{accessory}/restock', [AccessoryController::class, 'restock']);
    Route::get('/accessories/{accessory}/history', [AccessoryController::class, 'history']);

    // ---------- Fixed Expenses ----------
    // NOTE: koi custom GET route (jaise /fixed-expenses/summary) ho to
    // usay {fixed_expense} wale routes se PEHLE rakhna.
    Route::get('/fixed-expenses', [FixedExpenseController::class, 'index']);
    Route::post('/fixed-expenses', [FixedExpenseController::class, 'store']);
    Route::put('/fixed-expenses/{id}', [FixedExpenseController::class, 'update']);
    Route::delete('/fixed-expenses/{id}', [FixedExpenseController::class, 'destroy']);

    // ---------- Extra Expenses ----------
    Route::get('/extra-expenses', [ExtraExpenseController::class, 'index']);
    Route::post('/extra-expenses', [ExtraExpenseController::class, 'store']);
    Route::put('/extra-expenses/{id}', [ExtraExpenseController::class, 'update']);
    Route::delete('/extra-expenses/{id}', [ExtraExpenseController::class, 'destroy']);

    // ---------- Salary Payments ----------
    // NOTE: /salary-summary, /staff-stats aur /salary-refresh ko /salary-payments/{id} se
    // PEHLE rakhna zaroori hai, warna Laravel "summary" ya "refresh" ko
    // {id} samajh kar match karega.
    Route::get('/staff-stats', [SalaryController::class, 'staffStats']);   // <-- NAYA (date/month filter cards)
    Route::get('/salary-summary', [SalaryController::class, 'summary']);
    Route::post('/salary-base/update', [SalaryController::class, 'updateBaseSalary']);
    Route::post('/salary-refresh', [SalaryController::class, 'refresh']);
    Route::get('/salary-payments', [SalaryController::class, 'index']);
    Route::post('/salary-payments', [SalaryController::class, 'store']);
    Route::put('/salary-payments/{id}', [SalaryController::class, 'update']);
    Route::delete('/salary-payments/{id}', [SalaryController::class, 'destroy']);

    // Sirf admin
    Route::middleware('role:admin')->group(function () {
        Route::post('/admin/register', [AuthController::class, 'registerAdmin']);
        Route::post('/frontdesk/register', [AuthController::class, 'registerFrontdesk']);

        // Drinks — edit/delete sirf admin karega
        Route::put('/drinks/{drink}', [DrinkController::class, 'update']);
        Route::delete('/drinks/{drink}', [DrinkController::class, 'destroy']);

        // Agar chahein to Fixed / Extra Expense ki edit/delete bhi
        // sirf admin tak mehdood kar sakte hain. Filhaal sab logged-in
        // users (admin + frontdesk) use kar sakte hain.
    });
});