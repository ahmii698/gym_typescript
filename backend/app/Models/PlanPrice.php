<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanPrice extends Model
{
    protected $fillable = [
        'plan_id', 'billing_cycle', 'duration_months', 'currency',
        'price', 'setup_fee', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price'     => 'decimal:2',
            'setup_fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }
}