<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FixedExpense extends Model
{
    use HasFactory, BelongsToCompany;

    protected $table = 'fixed_expenses';

    protected $fillable = [
        'title',
        'amount',
        'date',
    ];

    protected $casts = [
        'amount' => 'float',
        'date' => 'date:Y-m-d',
    ];
}