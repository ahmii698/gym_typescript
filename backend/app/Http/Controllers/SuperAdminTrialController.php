<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminTrialController extends Controller
{
    /** GET /super-admin/trials */
    public function index()
    {
        $rows = DB::table('companies')
            ->whereNull('deleted_at')
            ->whereNotNull('trial_days')
            ->orderByDesc('id')
            ->get()
            ->map(function ($c) {
                $admin = DB::table('users')
                    ->where('company_id', $c->id)
                    ->where('role', 'admin')
                    ->orderBy('id')
                    ->first();

                return [
                    'id'         => $c->id,
                    'name'       => $c->name,
                    'phone'      => $admin->phone ?? ($c->phone ?? ''),
                    'start_date' => substr((string) $c->trial_starts_at, 0, 10),
                    'days'       => (int) $c->trial_days,
                ];
            })->values();

        return response()->json(['data' => $rows]);
    }

    /** POST /super-admin/trials/{id}/extend  { days } */
    public function extend(Request $request, $id)
    {
        $data = $request->validate(['days' => 'required|integer|min:1|max:365']);

        $c = DB::table('companies')->where('id', $id)->whereNotNull('trial_days')->first();
        abort_if(!$c, 404, 'Trial not found');

        $newDays = $c->trial_days + $data['days'];

        DB::table('companies')->where('id', $id)->update([
            'trial_days'    => $newDays,
            'trial_ends_at' => Carbon::parse($c->trial_starts_at)->addDays($newDays),
            'status'        => 'active',
            'updated_at'    => now(),
        ]);

        return response()->json(['message' => 'Trial extended']);
    }

    /** POST /super-admin/trials/{id}/convert : trial se hata kar normal monthly client banao */
    public function convert($id)
    {
        $c = DB::table('companies')->where('id', $id)->whereNotNull('trial_days')->first();
        abort_if(!$c, 404, 'Trial not found');

        DB::table('companies')->where('id', $id)->update([
            'trial_days'      => null,
            'trial_starts_at' => null,
            'trial_ends_at'   => null,
            'client_since'    => now()->toDateString(), // convert wale din se billing shuru
            'status'          => 'active',
            'updated_at'      => now(),
        ]);

        return response()->json(['message' => 'Converted to client']);
    }

    /** DELETE /super-admin/trials/{id} : trial list se hatao + access band */
    public function destroy($id)
    {
        DB::table('companies')->where('id', $id)->whereNotNull('trial_days')->update([
            'trial_days'      => null,
            'trial_starts_at' => null,
            'trial_ends_at'   => null,
            'status'          => 'suspended',
            'updated_at'      => now(),
        ]);

        return response()->json(['message' => 'Trial removed']);
    }
}