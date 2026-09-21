<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class PasswordResetController extends Controller
{
    private const OTP_MINUTES = 10;
    private const MAX_ATTEMPTS = 5;

    // Step 1: email lo, OTP bhejo
    public function sendOtp(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        $email = strtolower($data['email']);

        $user = User::where('email', $email)->first();

        if ($user) {
            $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::table('password_otps')->updateOrInsert(
                ['email' => $email],
                [
                    'otp' => Hash::make($otp),
                    'attempts' => 0,
                    'expires_at' => now()->addMinutes(self::OTP_MINUTES),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            Mail::raw(
                "Your FitZone password reset code is: {$otp}\n\n"
                . "This code expires in " . self::OTP_MINUTES . " minutes.\n"
                . "If you did not request this, you can ignore this email.",
                function ($message) use ($email) {
                    $message->to($email)->subject('FitZone Password Reset Code');
                }
            );
        }

        // Hamesha same jawab, taake koi yeh na jaan sake ke email registered hai ya nahi
        return response()->json([
            'message' => 'If this email is registered, a code has been sent.',
        ]);
    }

    // Step 2: OTP check karo
    public function verifyOtp(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
        ]);

        $error = $this->checkOtp(strtolower($data['email']), $data['otp']);
        if ($error) {
            return response()->json(['message' => $error], 422);
        }

        return response()->json(['message' => 'OTP verified']);
    }

    // Step 3: naya password set karo
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
            'password' => 'required|min:8',
        ]);

        $email = strtolower($data['email']);

        $error = $this->checkOtp($email, $data['otp']);
        if ($error) {
            return response()->json(['message' => $error], 422);
        }

        $user = User::where('email', $email)->first();
        if (!$user) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        $user->password = $data['password']; // model ka 'hashed' cast khud hash karta hai
        $user->save();

        DB::table('password_otps')->where('email', $email)->delete();
        $user->tokens()->delete(); // purane login sessions khatam

        return response()->json(['message' => 'Password reset successfully']);
    }

    private function checkOtp(string $email, string $otp): ?string
    {
        $record = DB::table('password_otps')->where('email', $email)->first();

        if (!$record) {
            return 'Invalid or expired code.';
        }

        if (Carbon::parse($record->expires_at)->isPast()) {
            DB::table('password_otps')->where('email', $email)->delete();
            return 'Code has expired. Please request a new one.';
        }

        if ($record->attempts >= self::MAX_ATTEMPTS) {
            DB::table('password_otps')->where('email', $email)->delete();
            return 'Too many wrong attempts. Please request a new code.';
        }

        if (!Hash::check($otp, $record->otp)) {
            DB::table('password_otps')->where('email', $email)->increment('attempts');
            return 'Incorrect code.';
        }

        return null;
    }
}