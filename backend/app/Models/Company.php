<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Company extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'legal_name', 'slug', 'email', 'phone', 'website',
        'address_line1', 'address_line2', 'city', 'state', 'postal_code',
        'country', 'tax_number', 'timezone', 'logo_url', 'status',
        'current_subscription_id', 'created_by', 'suspended_reason',
    ];

    // Company banate waqt agar slug nahi diya to name se khud bana do
    protected static function booted()
    {
        static::creating(function ($company) {
            if (empty($company->slug)) {
                $base = Str::slug($company->name) ?: 'company';
                $slug = $base;
                $i = 1;

                // withTrashed: soft-deleted companies ka slug bhi unique index mein hota hai
                while (static::withTrashed()->where('slug', $slug)->exists()) {
                    $slug = $base . '-' . $i++;
                }

                $company->slug = $slug;
            }
        });
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    // Company ki abhi chal rahi subscription
    public function currentSubscription()
    {
        return $this->belongsTo(Subscription::class, 'current_subscription_id');
    }
}