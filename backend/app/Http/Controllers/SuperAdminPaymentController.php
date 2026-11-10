<?php

namespace App\Http\Controllers;

use App\Services\SubscriptionCycle;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class SuperAdminPaymentController extends Controller
{
    /** Company ki apni monthly fee (companies.monthly_fee) */
    private function feeOf($company): float
    {
        return (float) ($company->monthly_fee ?? SubscriptionCycle::DEFAULT_FEE);
    }

    /**
     * GET /super-admin/payments
     * One row per COMPANY with its payment status for the CURRENT billing cycle.
     */
    public function index()
    {
        $companies = DB::table('companies')
            ->whereNull('deleted_at')
            ->whereNull('trial_days') // trial companies Payments list mein nahi, wo Trial Users page par hain
            ->where(function ($q) {   // NEW: removed trial wali (suspended) companies na aayein
                $q->whereNull('status')->orWhere('status', '!=', 'suspended');
            })
            ->orderBy('id')
            ->get();

        $users = DB::table('users')
            ->whereNotNull('company_id')
            ->orderBy('id')
            ->get()
            ->groupBy('company_id');

        // Every proof, with the company of the user who uploaded it
        $proofs = DB::table('amount_proof')
            ->join('users', 'users.id', '=', 'amount_proof.user_id')
            ->select('amount_proof.*', 'users.company_id as proof_company_id')
            ->orderByDesc('amount_proof.id')
            ->get()
            ->groupBy('proof_company_id');

        $rows = $companies->map(function ($c) use ($users, $proofs) {
            $companyUsers  = $users->get($c->id, collect());
            $admin         = $companyUsers->firstWhere('role', 'admin');
            $companyProofs = $proofs->get($c->id, collect());
            $fee           = $this->feeOf($c);

            $s = SubscriptionCycle::summary($c->client_since, $companyProofs, $fee);

            // Chal rahe cycle ka sabse naya proof (View Proof ke liye)
            $latest = $s
                ? $companyProofs->first(fn ($p) => $p->billing_period === SubscriptionCycle::periodKey($s['billing_start']))
                : null;

            return [
                'id'             => $c->id,
                'client_name'    => $c->name ?? '-',
                'phone'          => $c->phone ?: ($admin->phone ?? ''),
                'plan'           => 'Monthly',
                'total_amount'   => $fee,
                'paid_amount'    => $s ? $s['paid_amount'] : 0,
                'billing_period' => $s ? $s['billing_start']->format('d M Y') : '',
                // ab due_date se aata hai (admin Amounts page wali date ke barabar)
                'expires_at'     => $s ? $s['due_date']->format('d M Y') : '',
                // Reminder page ke liye (ISO dates)
                'paid_from'      => $s && $s['paid_from'] ? $s['paid_from']->toDateString() : '',
                'paid_until'     => $s && $s['paid_until'] ? $s['paid_until']->toDateString() : '',
                'is_blocked'     => (bool) ($c->is_blocked ?? false), // Block button ke liye
                'proof'          => $latest ? $this->proofData($latest) : null,
            ];
        })->values();

        return response()->json(['data' => $rows]);
    }

    /**
     * PUT /super-admin/payments/companies/{id}/fee   { monthly_fee }
     * Is company ki monthly fee badlo (har company ki alag ho sakti hai).
     */
    public function updateFee(Request $request, $id)
    {
        $data = $request->validate([
            'monthly_fee' => 'required|numeric|min:1|max:10000000',
        ]);

        $exists = DB::table('companies')->where('id', $id)->whereNull('deleted_at')->exists();
        abort_if(!$exists, 404, 'Company not found');

        DB::table('companies')->where('id', $id)->update([
            'monthly_fee' => $data['monthly_fee'],
            'updated_at'  => now(),
        ]);

        return response()->json(['message' => 'Monthly fee updated']);
    }

    /**
     * PUT /super-admin/payments/companies/{id}/block   { blocked: true|false }
     * Company ko block / unblock karo. Block par us company ke sab users foran logout ho jate hain.
     */
    public function toggleBlock(Request $request, $id)
    {
        $data = $request->validate([
            'blocked' => 'required|boolean',
        ]);

        $exists = DB::table('companies')->where('id', $id)->whereNull('deleted_at')->exists();
        abort_if(!$exists, 404, 'Company not found');

        $blocked = (bool) $data['blocked'];

        DB::table('companies')->where('id', $id)->update([
            'is_blocked' => $blocked ? 1 : 0,
            'blocked_at' => $blocked ? now() : null,
            'updated_at' => now(),
        ]);

        if ($blocked) {
            // Is company ke sab users ke tokens delete = sab foran logout
            $userIds = DB::table('users')->where('company_id', $id)->pluck('id');

            DB::table('personal_access_tokens')
                ->where('tokenable_type', \App\Models\User::class)
                ->whereIn('tokenable_id', $userIds)
                ->delete();
        }

        return response()->json([
            'message' => $blocked ? 'Company blocked' : 'Company unblocked',
        ]);
    }

    /**
     * GET /super-admin/payments/companies/{companyId}/members
     * Every admin, front desk, trainer and staff member of one company.
     */
    public function members($companyId)
    {
        $company = DB::table('companies')->where('id', $companyId)->whereNull('deleted_at')->first();
        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        $list = collect();

        // Admins, front desk (and any other role) live in the users table
        DB::table('users')->where('company_id', $companyId)->orderBy('id')->get()
            ->each(function ($u) use ($list) {
                $list->push([
                    'id'    => $u->id,
                    'name'  => $u->name ?? '-',
                    'phone' => $u->phone ?? '',
                    'email' => $u->email ?? '',
                    'role'  => $u->role ?? 'staff',
                ]);
            });

        // Trainers / staff may have their own tables: they are included only if the table exists
        foreach (['trainer' => 'trainers', 'staff' => 'staff'] as $role => $table) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'company_id')) {
                continue;
            }

            $q = DB::table($table)->where('company_id', $companyId);
            if (Schema::hasColumn($table, 'deleted_at')) {
                $q->whereNull('deleted_at');
            }

            $q->orderBy('id')->get()->each(function ($r) use ($list, $role) {
                $list->push([
                    'id'    => $r->id,
                    'name'  => $r->name ?? '-',
                    'phone' => $r->phone ?? '',
                    'email' => $r->email ?? '',
                    'role'  => $role,
                ]);
            });
        }

        // Same person must not be shown twice
        $list = $list->unique(fn ($m) => $m['role'] . '|' . $m['name'] . '|' . $m['phone'])->values();

        return response()->json([
            'company' => $company->name,
            'data'    => $list,
        ]);
    }

    /**
     * GET /super-admin/payments/companies/{companyId}/history
     * Month-by-month payment history with the screenshots of each month.
     */
    public function history($companyId)
    {
        $company = DB::table('companies')->where('id', $companyId)->whereNull('deleted_at')->first();
        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        $fee = $this->feeOf($company);

        $proofs = DB::table('amount_proof')
            ->join('users', 'users.id', '=', 'amount_proof.user_id')
            ->where('users.company_id', $companyId)
            ->select('amount_proof.*', 'users.name as uploader_name')
            ->orderByDesc('amount_proof.id')
            ->get()
            ->groupBy('billing_period');

        // Every billing period that has a proof + the current one (even if nothing is paid yet)
        $periods = $proofs->keys();
        $current = SubscriptionCycle::summary($company->client_since, collect(), $fee);
        if ($current) {
            $periods->push(SubscriptionCycle::periodKey($current['billing_start']));
        }
        $periods = $periods->unique()->values()->all();
        usort($periods, fn ($a, $b) => (strtotime($b) ?: 0) <=> (strtotime($a) ?: 0));

        $rows = collect($periods)->map(function ($period) use ($proofs, $fee) {
            $list = $proofs->get($period, collect());
            $paid = min((float) $list->where('status', 'approved')->sum('amount'), $fee);

            if ($paid >= $fee) {
                $status = 'paid';
            } elseif ($list->contains('status', 'pending')) {
                $status = 'pending';
            } elseif ($list->contains('status', 'rejected')) {
                $status = 'rejected';
            } else {
                $status = 'unpaid';
            }

            return [
                'billing_period' => $this->periodLabel((string) $period),
                'total_amount'   => $fee,
                'paid_amount'    => $paid,
                'status'         => $status,
                'proofs'         => $list->map(function ($p) {
                    $data = $this->proofData($p);
                    $data['uploaded_by'] = $p->uploader_name ?? '';
                    return $data;
                })->values(),
            ];
        })->values();

        return response()->json([
            'company' => $company->name,
            'data'    => $rows,
        ]);
    }

    /** POST /super-admin/payments/proofs/{id}/approve */
    public function approve($id)
    {
        return $this->setStatus($id, 'approved', 'Payment approved');
    }

    /** POST /super-admin/payments/proofs/{id}/reject */
    public function reject($id)
    {
        return $this->setStatus($id, 'rejected', 'Payment rejected');
    }

    /** "2026-11-10" -> "10 Nov 2026" (purani values jaisi hain waisi hi rehti hain) */
    private function periodLabel(string $period): string
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $period)
            ? Carbon::parse($period)->format('d M Y')
            : $period;
    }

    private function proofData($p): array
    {
        return [
            'id'         => $p->id,
            'amount'     => (float) $p->amount,
            'status'     => $p->status,
            'url'        => Storage::disk('public')->url($p->proof_path),
            'created_at' => $p->created_at,
        ];
    }

    private function setStatus($id, string $status, string $message)
    {
        $proof = DB::table('amount_proof')->where('id', $id)->first();

        if (!$proof) {
            return response()->json(['message' => 'Proof not found'], 404);
        }

        DB::table('amount_proof')->where('id', $id)->update([
            'status'     => $status,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => $message]);
    }
}