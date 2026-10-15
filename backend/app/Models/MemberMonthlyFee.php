<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MemberMonthlyFee extends Model
{
    protected $table = 'member_monthly_fees';

    protected $fillable = [
        'member_id',
        'month_number',
        'fee_amount',
        'valid_from',
        'valid_till',
        'status',
        'paid_on',
        'note',
    ];

    protected $casts = [
        'fee_amount' => 'float',
        'valid_from' => 'date:Y-m-d',
        'valid_till' => 'date:Y-m-d',
        'paid_on'    => 'date:Y-m-d',
    ];
}