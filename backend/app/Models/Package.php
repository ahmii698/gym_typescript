<?php
// app/Models/Package.php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Package extends Model
{
    use HasFactory, BelongsToCompany;

    protected $fillable = [
        'name',
        'type',
        'price',
        'duration_days',
        'features',
        'is_active',
        'icon',
    ];

    protected $casts = [
        'features'  => 'array',
        'is_active' => 'boolean',
        'price'     => 'decimal:2',
    ];
}