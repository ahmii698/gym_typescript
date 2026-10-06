<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trainer extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'cnic',
        'email',
        'specialization',
        'role',
        'status',
        'experience_years',
        'base_salary',      // <-- Yeh add kiya
        'photo_url',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'experience_years' => 'integer',
        'base_salary' => 'float',  // <-- Yeh add kiya
    ];

    public function members(): HasMany
    {
        return $this->hasMany(Member::class);
    }
}