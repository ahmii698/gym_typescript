<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'trial_days', 'max_users',
        'is_public', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function prices()
    {
        return $this->hasMany(PlanPrice::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }
}