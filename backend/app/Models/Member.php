<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    public const TYPES = ['normal_user', 'normal_trainer', 'package_trainer', 'package_only'];
    public const TRAINER_TYPES = ['normal_trainer', 'package_trainer'];

    protected $fillable = [
        'member_code',
        'full_name',
        'cnic',
        'cnic_front_path',
        'cnic_back_path',
        'contact_number',
        'email',
        'date_of_birth',
        'gender',
        'member_type',
        'package_id',
        'trainer_id',
        'start_date',
        'end_date',
        'notes',
        'status',
    ];

    protected $hidden = ['cnic_front_path', 'cnic_back_path'];

    protected $appends = ['cnic_front_url', 'cnic_back_url'];

    protected $casts = [
        'date_of_birth' => 'date:Y-m-d',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    protected function cnicFrontUrl(): Attribute
    {
        return Attribute::get(
            fn () => $this->cnic_front_path ? asset('storage/' . $this->cnic_front_path) : null
        );
    }

    protected function cnicBackUrl(): Attribute
    {
        return Attribute::get(
            fn () => $this->cnic_back_path ? asset('storage/' . $this->cnic_back_path) : null
        );
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(Trainer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}