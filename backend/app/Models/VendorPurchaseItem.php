<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorPurchaseItem extends Model
{
    protected $fillable = [
        'purchase_id',
        'item_type',   // 'accessory' ya 'drink'
        'item_id',
        'item_name',
        'quantity',
        'unit_price',
    ];

    protected $casts = [
        'quantity'   => 'integer',
        'unit_price' => 'float',
    ];

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(VendorPurchase::class, 'purchase_id');
    }
}