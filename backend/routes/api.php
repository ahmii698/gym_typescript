<?php

use App\Http\Controllers\AccessoryController;
use App\Http\Controllers\AdminSubscriptionController; // <-- NEW (Amounts page: subscription cycle)
use App\Http\Controllers\AmountProofController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CashInHandController;
use App\Http\Controllers\CreditController;
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
use App\Http\Controllers\StaffController;
use App\Http\Controllers\SuperAdminAuthController; // <-- NAYA (Super Admin)
use App\Http\Controllers\SuperAdminChannelController; // <-- NEW (Money Channels)
use App\Http\Controllers\SuperAdminCompanyController; // <-- NEW (Companies)
use App\Http\Controllers\SuperAdminPasswordResetController; // <-- NAYA (Super Admin forgot password)
use App\Http\Controllers\SuperAdminPaymentController;
use App\Http\Controllers\SuperAdminTrialController; // <-- NEW (Free Trials)
use Illuminate\Support\Facades\Route;

// ---------- Public routes (bina login ke) ----------
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// <-- NEW (Block): blocked company ko bina login ke JazzCash / Easypaisa / Bank scanners dikhane ke liye
Route::get('/public/payment-channels', [SuperAdminChannelController::class, 'forAdmin'])->middleware('throttle:30,1');

// <-- NAYA (Super Admin): super admin ka alag login
Route::post('/super-admin/login', [SuperAdminAuthController::class, 'login'])->middleware('throttle:10,1');

// <-- NAYA (Super Admin): super admin ka alag forgot password (OTP) flow
Route::post('/super-admin/forgot-password', [SuperAdminPasswordResetController::class, 'sendOtp'])->middleware('throttle:5,1');
Route::post('/super-admin/verify-otp', [SuperAdminPasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/super-admin/reset-password', [SuperAdminPasswordResetController::class, 'resetPassword'])->middleware('throttle:10,1');

Route::post('/forgot-password', [PasswordResetController::class, 'sendOtp'])->middleware('throttle:5,1');
Route::post('/verify-otp', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,1');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:10,1');

// ---------- Protected routes (login zaroori) ----------
// <-- CHANGED: 'company.blocked' add kiya, blocked company ka koi bhi user ab kisi route par nahi ja sakta
Route::middleware(['auth:sanctum', 'company.blocked'])->group(function () {
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

    // Change or remove a member's trainer (send trainer_id = null to remove)
    Route::put('/members/{member}/trainer', [MemberController::class, 'updateTrainer']);

    // Monthly Fee Toggle (Mark paid / unmark)
    Route::post('/member-monthly-fees/{id}/toggle', [MemberController::class, 'toggleMonthlyFee']);

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

    // ---------- Staff (Employees > Staff tab) ----------
    // NOTE: /staff/frontdesk (above) is a different route and is not affected.
    // There is no GET /staff/{staff} route on purpose, so "frontdesk" is never
    // matched as a staff ID.
    Route::get('/staff', [StaffController::class, 'index']);
    Route::post('/staff', [StaffController::class, 'store']);
    Route::put('/staff/{staff}', [StaffController::class, 'update']);
    Route::delete('/staff/{staff}', [StaffController::class, 'destroy']);

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
    Route::get('/accessories/spend-summary', [AccessoryController::class, 'spendSummary']);
    Route::get('/accessories', [AccessoryController::class, 'index']);
    Route::post('/accessories', [AccessoryController::class, 'store']);
    Route::put('/accessories/{accessory}', [AccessoryController::class, 'update']);
    Route::delete('/accessories/{accessory}', [AccessoryController::class, 'destroy']);
    Route::post('/accessories/{accessory}/restock', [AccessoryController::class, 'restock']);
    Route::get('/accessories/{accessory}/history', [AccessoryController::class, 'history']);

    // ---------- Credit Management (vendors ka udhaar hisaab — admin aur frontdesk dono) ----------
    // Delete sirf admin karega (neeche admin group mein)
    Route::get('/credit/remaining', [CreditController::class, 'remaining']);
    Route::get('/credit/vendors', [CreditController::class, 'index']);
    Route::post('/credit/vendors', [CreditController::class, 'store']);
    Route::put('/credit/vendors/{vendor}', [CreditController::class, 'update']);
    Route::get('/credit/vendors/{vendor}/history', [CreditController::class, 'history']);
    Route::post('/credit/vendors/{vendor}/pay', [CreditController::class, 'pay']);

    // ---------- Cash in Hand (balance + history dekhna sab logged-in users; update sirf admin, neeche) ----------
    Route::get('/cash-in-hand', [CashInHandController::class, 'index']);

    // ---------- Fixed Expenses ----------
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
    Route::get('/salary-frontdesk', [SalaryController::class, 'frontdesk']);
    Route::get('/staff-stats', [SalaryController::class, 'staffStats']);
    Route::get('/salary-summary', [SalaryController::class, 'summary']);
    Route::post('/salary-base/update', [SalaryController::class, 'updateBaseSalary']);
    Route::post('/salary-refresh', [SalaryController::class, 'refresh']);
    Route::get('/salary-payments', [SalaryController::class, 'index']);
    Route::post('/salary-payments', [SalaryController::class, 'store']);
    Route::put('/salary-payments/{id}', [SalaryController::class, 'update']);
    Route::delete('/salary-payments/{id}', [SalaryController::class, 'destroy']);

    // ---------- Amount Proof (payment screenshot upload) ----------
    Route::post('/amount-proof', [AmountProofController::class, 'store']);

    // Sirf admin
    Route::middleware('role:admin')->group(function () {
        Route::post('/admin/register', [AuthController::class, 'registerAdmin']);
        Route::post('/frontdesk/register', [AuthController::class, 'registerFrontdesk']);
        Route::put('/frontdesk/{id}', [AuthController::class, 'updateFrontdesk']);

        // <-- NEW (Amounts page): billing period, due date aur payment status
        Route::get('/admin/subscription', [AdminSubscriptionController::class, 'show']);

        // <-- NEW (Amounts page): super admin ne jo JazzCash / Easypaisa / Bank + QR set kiye
        Route::get('/admin/payment-channels', [SuperAdminChannelController::class, 'forAdmin']);

        // Drinks — edit/delete sirf admin karega
        Route::put('/drinks/{drink}', [DrinkController::class, 'update']);
        Route::delete('/drinks/{drink}', [DrinkController::class, 'destroy']);

        // Credit Management — vendor delete sirf admin karega
        Route::delete('/credit/vendors/{vendor}', [CreditController::class, 'destroy']);

        // Cash in Hand — add / withdraw sirf admin karega
        Route::post('/cash-in-hand', [CashInHandController::class, 'store']);
    });
});

// ---------- <-- NAYA (Super Admin): sirf super admin ke protected routes ----------
// Ye 'auth:sanctum' group ke BAHAR hain, aur sirf super_admins table ke token chalte hain.
Route::middleware('auth:super_admin')->prefix('super-admin')->group(function () {
    Route::post('/logout', [SuperAdminAuthController::class, 'logout']);
    Route::get('/me', [SuperAdminAuthController::class, 'me']);

    // Payments (list of companies + proof review)
    Route::get('/payments', [SuperAdminPaymentController::class, 'index']);
    Route::post('/payments/proofs/{id}/approve', [SuperAdminPaymentController::class, 'approve']);
    Route::post('/payments/proofs/{id}/reject', [SuperAdminPaymentController::class, 'reject']);

    // <-- NEW: har company ki apni monthly fee badalna
    Route::put('/payments/companies/{id}/fee', [SuperAdminPaymentController::class, 'updateFee']);

    // <-- NEW (Block): company ko block / unblock karna
    Route::put('/payments/companies/{id}/block', [SuperAdminPaymentController::class, 'toggleBlock']);

    // <-- NEW (Money Channels): JazzCash / Easypaisa / Bank details + QR image
    Route::get('/payment-channels', [SuperAdminChannelController::class, 'index']);
    Route::post('/payment-channels/{type}', [SuperAdminChannelController::class, 'update']);

    // <-- NEW: company ke saare members (admin / front desk / trainer / staff) aur month-wise payment history
    Route::get('/payments/companies/{id}/members', [SuperAdminPaymentController::class, 'members']);
    Route::get('/payments/companies/{id}/history', [SuperAdminPaymentController::class, 'history']);

    // <-- NEW (Companies): create a company + its admin, and list companies
    Route::get('/companies', [SuperAdminCompanyController::class, 'index']);
    Route::post('/companies', [SuperAdminCompanyController::class, 'store']);

    // <-- NEW (Free Trials): trial list, extend, convert (trial -> normal client) aur remove
    Route::get('/trials', [SuperAdminTrialController::class, 'index']);
    Route::post('/trials/{id}/extend', [SuperAdminTrialController::class, 'extend']);
    Route::post('/trials/{id}/convert', [SuperAdminTrialController::class, 'convert']); // <-- NEW
    Route::delete('/trials/{id}', [SuperAdminTrialController::class, 'destroy']);

    // yahan aage gyms / subscriptions ke routes aayenge
});