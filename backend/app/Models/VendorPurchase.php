<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VendorPurchase extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'vendor_id',
        'invoice_no',
        'source_type',   // 'accessory' ya 'drink'
        'total_amount',
        'paid_amount',
    ];

    protected $casts = [
        'total_amount' => 'float',
        'paid_amount'  => 'float',
    ];

    // JSON mein balance khud aa jaye (database mein save nahi hota)
    protected $appends = ['balance'];

    public function getBalanceAttribute(): float
    {
        return round($this->total_amount - $this->paid_amount, 2);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    // Invoice ke andar ke products
    public function items(): HasMany
    {
        return $this->hasMany(VendorPurchaseItem::class, 'purchase_id');
    }

    // Is invoice ke payments
    public function payments(): HasMany
    {
        return $this->hasMany(VendorPayment::class, 'purchase_id');
    }
}