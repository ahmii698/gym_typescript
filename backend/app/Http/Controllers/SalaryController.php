<?php

namespace App\Http\Controllers;

use App\Models\SalaryPayment;
use App\Models\Trainer;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SalaryController extends Controller
{
    /**
     * GET /salary-payments
     * Saare records (settled + unsettled) return karta hai.
     * Frontend decide karta hai kya dikhana hai.
     */
    public function index(Request $request)
    {
        try {
            $query = SalaryPayment::query();

            if ($request->filled('staff_id')) {
                $query->where('staff_id', $request->staff_id);
            }
            if ($request->filled('staff_type')) {
                $query->where('staff_type', $request->staff_type);
            }
            if ($request->filled('month')) {
                $query->where('month', $request->month);
            }
            if ($request->filled('year')) {
                $query->where('year', $request->year);
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            $payments = $query->orderBy('year', 'desc')
                              ->orderBy('month', 'desc')
                              ->orderBy('id', 'desc')
                              ->get();

            return response()->json(['status' => true, 'data' => $payments], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Salary payments load nahi ho sake.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /salary-payments
     * Multiple partial payments allowed. Us month ki saari paid payments
     * (settled + unsettled) base salary ki limit mein count hoti hain.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'staff_id'   => 'required|integer',
            'staff_type' => 'required|in:trainer,frontdesk',
            'amount'     => 'required|numeric|min:0',
            'month'      => 'required|integer|min:1|max:12',
            'year'       => 'required|integer|min:2000|max:2100',
            'paid_on'    => 'required|date',
            'status'     => 'sometimes|in:paid,pending',
            'note'       => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            if ($request->staff_type === 'trainer') {
                $baseSalary = (float) Trainer::where('id', $request->staff_id)
                                             ->value('base_salary');
            } else {
                $baseSalary = (float) DB::table('users')
                                        ->where('id', $request->staff_id)
                                        ->where('role', 'frontdesk')
                                        ->value('base_salary');
            }

            // Us month mein ab tak kitni PAID salary ho chuki hai (settled + unsettled, sab)
            $alreadyPaid = (float) SalaryPayment::where('staff_id', $request->staff_id)
                                                ->where('staff_type', $request->staff_type)
                                                ->where('month', $request->month)
                                                ->where('year', $request->year)
                                                ->where('status', 'paid')
                                                ->sum('amount');

            $newTotal = $alreadyPaid + (float) $request->amount;

            if ($baseSalary > 0 && $newTotal > $baseSalary) {
                return response()->json([
                    'status' => false,
                    'message' => 'Total paid (' . number_format($newTotal) . ') base salary (' . number_format($baseSalary) . ') se zyada ho rahi hai.',
                ], 422);
            }

            $payment = SalaryPayment::create([
                'staff_id'   => $request->staff_id,
                'staff_type' => $request->staff_type,
                'amount'     => $request->amount,
                'month'      => $request->month,
                'year'       => $request->year,
                'paid_on'    => $request->paid_on,
                'status'     => $request->status ?? 'paid',
                'note'       => $request->note,
                'is_settled' => false,
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Payment record ho gayi.',
                'data' => $payment,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Salary record nahi ho saki.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /salary-payments/{id}
     */
    public function update(Request $request, $id)
    {
        $payment = SalaryPayment::find($id);

        if (!$payment) {
            return response()->json([
                'status' => false,
                'message' => 'Payment record nahi mila.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'amount'  => 'sometimes|required|numeric|min:0',
            'paid_on' => 'sometimes|required|date',
            'status'  => 'sometimes|in:paid,pending',
            'note'    => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $payment->update($request->only(['amount', 'paid_on', 'status', 'note']));

            return response()->json([
                'status' => true,
                'message' => 'Payment update ho gayi.',
                'data' => $payment,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Payment update nahi ho saki.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /salary-payments/{id}
     */
    public function destroy($id)
    {
        $payment = SalaryPayment::find($id);

        if (!$payment) {
            return response()->json([
                'status' => false,
                'message' => 'Payment record nahi mila.',
            ], 404);
        }

        try {
            $payment->delete();

            return response()->json([
                'status' => true,
                'message' => 'Payment delete ho gayi.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Payment delete nahi ho saki.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /salary-summary
     * Card ke liye us month ki SAARI payments (settled + unsettled) count hoti hain.
     * Refresh sirf table ke "Remaining" ko reset karta hai, card ko nahi.
     * Naya month shuru hote hi card khud naye month ka data (Rs 0 se) dikhata hai.
     */
    public function summary(Request $request)
    {
        try {
            $month = (int) $request->input('month', now()->month);
            $year = (int) $request->input('year', now()->year);

            $trainerBudget = Trainer::where('is_active', true)->sum('base_salary');

            $frontdeskBudget = DB::table('users')
                ->where('role', 'frontdesk')
                ->sum('base_salary');

            $totalBudget = $trainerBudget + $frontdeskBudget;

            $paid = SalaryPayment::where('month', $month)
                                 ->where('year', $year)
                                 ->where('status', 'paid')
                                 ->sum('amount');

            $pending = SalaryPayment::where('month', $month)
                                    ->where('year', $year)
                                    ->where('status', 'pending')
                                    ->sum('amount');

            return response()->json([
                'status' => true,
                'data' => [
                    'total_budget' => (float) $totalBudget,
                    'trainer_budget' => (float) $trainerBudget,
                    'frontdesk_budget' => (float) $frontdeskBudget,
                    'paid_this_month' => (float) $paid,
                    'pending_this_month' => (float) $pending,
                    'month' => $month,
                    'year' => $year,
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Summary load nahi ho saki.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /staff-stats?mode=date&date=2026-08-14
     * GET /staff-stats?mode=month&month=2026-08
     * Cards ka data us date/month ke hisaab se.
     */
    public function staffStats(Request $request)
    {
        try {
            $mode = $request->input('mode', 'month');

            if ($mode === 'date') {
                $date   = Carbon::parse($request->input('date', now()->toDateString()));
                $cutoff = $date->copy()->endOfDay();
                $month  = (int) $date->month;
                $year   = (int) $date->year;
            } else {
                $m      = Carbon::createFromFormat('Y-m-d', $request->input('month', now()->format('Y-m')) . '-01');
                $cutoff = $m->copy()->endOfMonth()->endOfDay();
                $month  = (int) $m->month;
                $year   = (int) $m->year;
            }

            // Jo staff us din/month tak add ho chuka tha (created_at null ho to bhi count)
            $existedBy = function ($q) use ($cutoff) {
                $q->whereNull('created_at')->orWhere('created_at', '<=', $cutoff);
            };

            $trainerQuery = Trainer::where($existedBy);
            $frontQuery   = DB::table('users')->where('role', 'frontdesk')->where($existedBy);

            $trainerCount = (clone $trainerQuery)->count();
            $frontCount   = (clone $frontQuery)->count();
            $budget       = (float) $trainerQuery->sum('base_salary') + (float) $frontQuery->sum('base_salary');

            // Paid: us month ki payments (date mode mein sirf us date tak ki)
            $paidQuery = SalaryPayment::where('month', $month)
                                      ->where('year', $year)
                                      ->where('status', 'paid');

            if ($mode === 'date') {
                $paidQuery->whereDate('paid_on', '<=', $cutoff->toDateString());
            }

            return response()->json([
                'status' => true,
                'data' => [
                    'total_staff' => $trainerCount + $frontCount,
                    'trainers'    => $trainerCount,
                    'frontdesk'   => $frontCount,
                    'budget'      => $budget,
                    'paid'        => (float) $paidQuery->sum('amount'),
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Stats load nahi ho sake.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /salary-base/update
     */
    public function updateBaseSalary(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'staff_id'    => 'required|integer',
            'staff_type'  => 'required|in:trainer,frontdesk',
            'base_salary' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            if ($request->staff_type === 'trainer') {
                $staff = Trainer::find($request->staff_id);

                if (!$staff) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Trainer nahi mila.',
                    ], 404);
                }

                $staff->base_salary = $request->base_salary;
                $staff->save();
            } else {
                $updated = DB::table('users')
                    ->where('id', $request->staff_id)
                    ->where('role', 'frontdesk')
                    ->update(['base_salary' => $request->base_salary]);

                if (!$updated) {
                    return response()->json([
                        'status' => false,
                        'message' => 'Front desk staff nahi mila.',
                    ], 404);
                }
            }

            return response()->json([
                'status' => true,
                'message' => 'Salary update ho gayi.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Salary update nahi ho saki.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /salary-refresh
     * Current month ki payments DELETE nahi hoti, sirf "settled" mark hoti hain.
     * Monthly view reset ho jata hai, lekin Total Record mein sab kuch rehta hai.
     */
    public function refresh(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'staff_id'   => 'required|integer',
            'staff_type' => 'required|in:trainer,frontdesk',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $month = now()->month;
            $year = now()->year;

            $settled = SalaryPayment::where('staff_id', $request->staff_id)
                                    ->where('staff_type', $request->staff_type)
                                    ->where('month', $month)
                                    ->where('year', $year)
                                    ->where('is_settled', false)
                                    ->update(['is_settled' => true]);

            return response()->json([
                'status' => true,
                'message' => 'Salary reset ho gayi. Purana record Total mein safe hai.',
                'settled_count' => $settled,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Reset nahi ho saka.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}