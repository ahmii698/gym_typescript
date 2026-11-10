<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SuperAdminPasswordResetController extends Controller
{
    private const OTP_TTL_MINUTES = 10;
    private const MAX_ATTEMPTS = 5;

    private function key(string $email): string
    {
        return 'sa_reset_otp:' . strtolower(trim($email));
    }

    /**
     * POST /super-admin/forgot-password  { email }
     */
    public function sendOtp(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
        ]);

        $email = strtolower(trim($data['email']));

        $admin = DB::table('super_admins')->whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$admin) {
            return response()->json(['message' => 'Ye email register nahi hai.'], 404);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put($this->key($email), [
            'otp_hash' => Hash::make($otp),
            'attempts' => 0,
        ], now()->addMinutes(self::OTP_TTL_MINUTES));

        try {
            Mail::raw(
                "Aapka Fusix Super Admin password reset OTP: {$otp}\n\n"
                . "Ye OTP " . self::OTP_TTL_MINUTES . " minute tak valid hai. "
                . "Agar aapne ye request nahi ki to is email ko ignore karein.",
                function ($m) use ($admin) {
                    $m->to($admin->email)->subject('Password Reset OTP');
                }
            );
        } catch (\Throwable $e) {
            Log::error('Super admin OTP mail failed: ' . $e->getMessage());
            Cache::forget($this->key($email));
            return response()->json(['message' => 'OTP email nahi bhej sake. Thori der baad try karo.'], 500);
        }

        return response()->json(['message' => 'OTP bhej diya gaya hai.']);
    }

    /**
     * POST /super-admin/verify-otp  { email, otp }
     */
    public function verifyOtp(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|digits:6',
        ]);

        if (!$this->otpIsValid($data['email'], $data['otp'], $error)) {
            return response()->json(['message' => $error], 422);
        }

        return response()->json(['message' => 'OTP sahi hai.']);
    }

    /**
     * POST /super-admin/reset-password  { email, otp, password, password_confirmation }
     */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'otp'      => 'required|digits:6',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if (!$this->otpIsValid($data['email'], $data['otp'], $error)) {
            return response()->json(['message' => $error], 422);
        }

        $email = strtolower(trim($data['email']));

        $admin = DB::table('super_admins')->whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$admin) {
            return response()->json(['message' => 'Ye email register nahi hai.'], 404);
        }

        DB::table('super_admins')->where('id', $admin->id)->update([
            'password'   => Hash::make($data['password']),
            'updated_at' => now(),
        ]);

        // Purane login tokens khatam (agar sanctum tokens use ho rahe hain)
        DB::table('personal_access_tokens')
            ->where('tokenable_id', $admin->id)
            ->where('tokenable_type', 'like', '%SuperAdmin%')
            ->delete();

        Cache::forget($this->key($email));

        return response()->json(['message' => 'Password reset ho gaya.']);
    }

    /**
     * OTP check (expire / attempts / match).
     */
    private function otpIsValid(string $email, string $otp, &$error = null): bool
    {
        $key = $this->key($email);
        $record = Cache::get($key);

        if (!$record) {
            $error = 'OTP expire ho gaya ya mila nahi. Dobara OTP mangwao.';
            return false;
        }

        if ($record['attempts'] >= self::MAX_ATTEMPTS) {
            Cache::forget($key);
            $error = 'Bohot zyada galat koshishein. Dobara OTP mangwao.';
            return false;
        }

        if (!Hash::check($otp, $record['otp_hash'])) {
            $record['attempts']++;
            Cache::put($key, $record, now()->addMinutes(self::OTP_TTL_MINUTES));
            $error = 'OTP galat hai.';
            return false;
        }

        return true;
    }
}