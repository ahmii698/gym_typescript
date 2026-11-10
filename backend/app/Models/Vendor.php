<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    use BelongsToCompany;

    protected $fillable = ['name', 'phone'];

    // Is vendor ki saari invoices
    public function purchases(): HasMany
    {
        return $this->hasMany(VendorPurchase::class);
    }

    // Is vendor ko kiye gaye saare payments
    public function payments(): HasMany
    {
        return $this->hasMany(VendorPayment::class);
    }
}