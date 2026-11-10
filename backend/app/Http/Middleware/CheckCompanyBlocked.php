<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckCompanyBlocked
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->company_id) {
            $blocked = DB::table('companies')
                ->where('id', $user->company_id)
                ->value('is_blocked');

            if ($blocked) {
                $user->tokens()->delete();

                return response()->json([
                    'code' => 'company_blocked',
                    'message' => 'Your subscription is blocked. Please clear your payment.',
                ], 403);
            }
        }

        return $next($request);
    }
}