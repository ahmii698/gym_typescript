<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalaryPayment extends Model
{
    protected $table = 'salary_payments';

    protected $fillable = [
        'staff_id',
        'staff_type',
        'amount',
        'commission',
        'month',
        'year',
        'paid_on',
        'status',
        'note',
        'is_settled',
    ];

    protected $casts = [
        'amount' => 'float',
        'commission' => 'float',
        'month' => 'integer',
        'year' => 'integer',
        'paid_on' => 'date:Y-m-d',
        'is_settled' => 'boolean',
    ];

    // total = salary + commission (JSON response mein "total" aayega)
    protected $appends = ['total'];

    public function getTotalAttribute(): float
    {
        return (float) $this->amount + (float) $this->commission;
    }
}