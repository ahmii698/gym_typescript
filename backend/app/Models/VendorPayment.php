<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPayment extends Model
{
    protected $fillable = [
        'vendor_id',
        'purchase_id',
        'amount',
        'note',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(VendorPurchase::class, 'purchase_id');
    }
}