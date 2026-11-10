<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SuperAdminCompanyController extends Controller
{
    /** GET /super-admin/companies : normal companies (free trial wali yahan nahi aayengi) */
    public function index()
    {
        $companies = DB::table('companies')
            ->whereNull('deleted_at')   // soft-deleted companies list mein na aayein
            ->whereNull('trial_days')   // NEW: free trial wali companies sirf Trial Users page par dikhengi
            ->orderByDesc('id')
            ->get();

        $rows = $companies->map(function ($c) {
            $admin = DB::table('users')
                ->where('company_id', $c->id)
                ->where('role', 'admin')
                ->orderBy('id')
                ->first();

            return [
                'id'         => $c->id,
                'name'       => $c->name,
                'admin_name' => $admin->name ?? '-',
                'email'      => $admin->email ?? '-',
                'phone'      => $admin->phone ?? '-',
                'created_at' => $c->created_at,
            ];
        })->values();

        return response()->json(['data' => $rows]);
    }

    /** POST /super-admin/companies : create a company and its admin user (optional free trial) */
    public function store(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:150|unique:companies,name',
            'name'         => 'required|string|max:100',
            'email'        => 'required|email|max:150|unique:users,email|unique:companies,email',
            'phone'        => ['required', 'regex:/^[0-9+\-\s]{7,20}$/'],
            'password'     => 'required|string|min:8|confirmed',
            'trial_days'   => 'nullable|integer|min:1|max:365',
        ]);

        [$companyId, $userId] = DB::transaction(function () use ($data) {
            $base = Str::slug($data['company_name']) ?: 'company';
            $slug = $base;
            $i = 1;
            while (DB::table('companies')->where('slug', $slug)->exists()) {
                $slug = $base . '-' . $i++;
            }

            $companyRow = [
                'name'       => $data['company_name'],
                'slug'       => $slug,
                'email'      => $data['email'],
                'phone'      => $data['phone'],
                'country'    => 'PK',
                'timezone'   => 'Asia/Karachi',
                'status'     => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (!empty($data['trial_days'])) {
                // Trial company: client_since abhi set nahi hota, convert wale din set hoga
                $days = (int) $data['trial_days'];
                $companyRow['trial_days']      = $days;
                $companyRow['trial_starts_at'] = now();
                $companyRow['trial_ends_at']   = now()->addDays($days);
            } else {
                // Normal company (trial nahi): aaj se billing shuru
                $companyRow['client_since'] = now()->toDateString();
            }

            $companyId = DB::table('companies')->insertGetId($companyRow);

            $userId = DB::table('users')->insertGetId([
                'company_id'  => $companyId,
                'name'        => $data['name'],
                'email'       => $data['email'],
                'phone'       => $data['phone'],
                'role'        => 'admin',
                'base_salary' => 0,
                'password'    => Hash::make($data['password']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            return [$companyId, $userId];
        });

        return response()->json([
            'message'    => 'Company and admin created successfully',
            'company_id' => $companyId,
            'user_id'    => $userId,
        ], 201);
    }
}