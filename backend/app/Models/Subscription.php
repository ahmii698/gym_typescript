<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'company_id', 'plan_id', 'plan_price_id', 'billing_cycle', 'status',
        'start_date', 'current_period_start', 'current_period_end',
        'trial_ends_at', 'grace_period_ends_at', 'auto_renew',
        'cancel_at_period_end', 'cancelled_at', 'cancel_reason', 'expired_at',
    ];

    protected function casts(): array
    {
        return [
            'start_date'           => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end'   => 'datetime',
            'trial_ends_at'        => 'datetime',
            'grace_period_ends_at' => 'datetime',
            'cancelled_at'         => 'datetime',
            'expired_at'           => 'datetime',
            'auto_renew'           => 'boolean',
            'cancel_at_period_end' => 'boolean',
        ];
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function planPrice()
    {
        return $this->belongsTo(PlanPrice::class);
    }
}