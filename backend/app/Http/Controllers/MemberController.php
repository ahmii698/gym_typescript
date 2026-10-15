<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMemberRequest;
use App\Models\Member;
use App\Models\MemberMonthlyFee;
use App\Models\Package;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MemberController extends Controller
{
    public function index(Request $request)
    {
        $members = Member::with(['package:id,name', 'trainer:id,name'])
            ->when($request->q, function ($query, $search) {
                $query->where(function ($w) use ($search) {
                    $w->where('full_name', 'like', "%{$search}%")
                        ->orWhere('cnic', 'like', "%{$search}%")
                        ->orWhere('contact_number', 'like', "%{$search}%")
                        ->orWhere('member_code', 'like', "%{$search}%");
                });
            })
            ->when($request->member_type, fn ($q, $type) => $q->where('member_type', $type))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 10));

        return response()->json($members);
    }

    // Fee Collection page ke liye — poori list, filters/pagination frontend khud karta hai
    public function feeOverview()
    {
        $today = Carbon::today();

        $members = Member::with(['package:id,name,price', 'latestPayment'])
            ->latest()
            ->get()
            ->map(function (Member $m) use ($today) {
                $end = $m->end_date ? Carbon::parse($m->end_date)->startOfDay() : null;
                $daysToExpire = null;

                if ($end) {
                    $daysToExpire = (int) $today->diffInDays($end);
                    if ($end->lt($today)) {
                        $daysToExpire = -$daysToExpire;
                    }
                }

                $latest = $m->latestPayment;

                return [
                    'id'             => $m->id,
                    'full_name'      => $m->full_name,
                    'contact_number' => $m->contact_number,
                    'package_name'   => $m->package->name ?? null,
                    'package_price'  => $m->package->price ?? null,
                    'member_type'    => $m->member_type,
                    'is_active'      => (bool) $m->is_active,
                    'payment_status' => ($latest && $latest->status === 'paid') ? 'Paid' : 'Unpaid',
                    'last_payment'   => ($latest && $latest->status === 'paid' && $latest->paid_on)
                        ? Carbon::parse($latest->paid_on)->format('M j, Y')
                        : null,
                    'fee_expire'     => $end ? $end->format('M j, Y') : null,
                    'days_to_expire' => $daysToExpire,

                    // CNIC Images — full URL (optional, null ho sakti hain)
                    'cnic_front_url' => $m->cnic_front_path
                        ? Storage::disk('public')->url($m->cnic_front_path)
                        : null,
                    'cnic_back_url'  => $m->cnic_back_path
                        ? Storage::disk('public')->url($m->cnic_back_path)
                        : null,
                ];
            });

        return response()->json($members);
    }

    public function store(StoreMemberRequest $request)
    {
        $data = $request->validated();
        $package = Package::findOrFail($data['package_id']);
        $hasTrainer = in_array($data['member_type'], Member::TRAINER_TYPES, true);

        // Installment months (default: 1)
        $installmentMonths = (int) ($data['installment_months'] ?? 1);
        if ($installmentMonths < 1) {
            $installmentMonths = 1;
        }

        $member = DB::transaction(function () use ($request, $data, $package, $hasTrainer, $installmentMonths) {
            $start = Carbon::parse($data['start_date']);

            // CNIC images optional hain — sirf tab store karo jab upload hui ho
            $cnicFrontPath = $request->hasFile('cnic_front')
                ? $request->file('cnic_front')->store('cnicfront', 'public')
                : null;
            $cnicBackPath = $request->hasFile('cnic_back')
                ? $request->file('cnic_back')->store('cnicback', 'public')
                : null;

            $member = Member::create([
                'full_name'          => $data['full_name'],
                'cnic'               => $data['cnic'],
                'cnic_front_path'    => $cnicFrontPath,
                'cnic_back_path'     => $cnicBackPath,
                'contact_number'     => $data['contact_number'],
                'email'              => $data['email'] ?? null,
                'date_of_birth'      => $data['date_of_birth'] ?? null,
                'gender'             => $data['gender'] ?? null,
                'member_type'        => $data['member_type'],
                'package_id'         => $package->id,
                'trainer_id'         => $hasTrainer ? ($data['trainer_id'] ?? null) : null,
                'start_date'         => $start->toDateString(),
                'end_date'           => $data['end_date']
                    ?? $start->copy()->addDays($package->duration_days)->toDateString(),
                'notes'              => $data['notes'] ?? null,
                'installment_months' => $installmentMonths,
                'status'             => 'active',
            ]);

            $member->update([
                'member_code' => 'FZ-' . str_pad((string) $member->id, 4, '0', STR_PAD_LEFT),
            ]);

            $fee = (float) ($data['fee_amount'] ?? 0);
            if ($fee > 0) {
                $status = $data['payment_status'] ?? 'pending';

                // Main payment record (whole amount)
                $member->payments()->create([
                    'amount'       => $fee,
                    'status'       => $status,
                    'paid_on'      => $status === 'paid' ? now()->toDateString() : null,
                    'method'       => 'cash',
                    'collected_by' => optional($request->user())->name ?? 'Front Desk',
                ]);

                // ============ MONTHLY FEES CREATE ============
                $this->createMonthlyFees($member, $fee, $installmentMonths, $status);
            }

            return $member;
        });

        return response()->json([
            'message' => 'Member added successfully',
            'data'    => $member->load(['package', 'trainer', 'payments', 'monthlyFees']),
        ], 201);
    }

    public function show(Member $member)
    {
        return response()->json($member->load(['package', 'trainer', 'payments', 'monthlyFees']));
    }

    /**
     * POST /member-monthly-fees/{id}/toggle
     * Monthly fee ko paid/pending mark karein.
     */
    public function toggleMonthlyFee($id)
    {
        $fee = MemberMonthlyFee::find($id);

        if (!$fee) {
            return response()->json([
                'status' => false,
                'message' => 'Monthly fee record nahi mila.',
            ], 404);
        }

        try {
            if ($fee->status === 'paid') {
                $fee->status = 'pending';
                $fee->paid_on = null;
            } else {
                $fee->status = 'paid';
                $fee->paid_on = now()->toDateString();
            }
            $fee->save();

            return response()->json([
                'status' => true,
                'message' => $fee->status === 'paid' ? 'Fee paid mark ho gayi.' : 'Fee pending mark ho gayi.',
                'data' => [
                    'id'           => $fee->id,
                    'member_id'    => $fee->member_id,
                    'month_number' => $fee->month_number,
                    'fee_amount'   => (float) $fee->fee_amount,
                    'valid_from'   => $fee->valid_from?->format('Y-m-d'),
                    'valid_till'   => $fee->valid_till?->format('Y-m-d'),
                    'status'       => $fee->status,
                    'paid_on'      => $fee->paid_on?->format('Y-m-d'),
                    'note'         => $fee->note,
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Update nahi ho saka.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Monthly fees rows create karo with round-off.
     * Per month poori fee — last month mein remainder add ho jata hai.
     * Misal: 125000 / 12 = 10416.66 -> 10416 per month, last month 10424.
     */
    private function createMonthlyFees(Member $member, float $totalFee, int $months, string $status): void
    {
        if ($months < 1) {
            $months = 1;
        }

        // Round-off: per month poori fee, last month mein extra adjust
        $perMonthBase = (int) floor($totalFee / $months);
        $remainder = (int) round($totalFee) - ($perMonthBase * $months);

        $startDate = Carbon::parse($member->start_date);

        for ($i = 1; $i <= $months; $i++) {
            $validFrom = $startDate->copy()->addMonths($i - 1);
            $validTill = $startDate->copy()->addMonths($i)->subDay();

            // Last month mein remainder add karein
            $fee = $perMonthBase + ($i === $months ? $remainder : 0);

            $member->monthlyFees()->create([
                'month_number' => $i,
                'fee_amount'   => $fee,
                'valid_from'   => $validFrom->toDateString(),
                'valid_till'   => $validTill->toDateString(),
                'status'       => $status === 'paid' ? 'paid' : 'pending',
                'paid_on'      => $status === 'paid' ? now()->toDateString() : null,
            ]);
        }
    }
}