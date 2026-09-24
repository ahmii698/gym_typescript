<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Accessory extends Model
{
    protected $fillable = [
        'name',
        'category',
        'quantity',
        'unit_price',
        'status',
        'image',
        'notes',
    ];

    protected $casts = [
        'quantity'   => 'integer',
        'unit_price' => 'float',
    ];

    public function stockLogs(): HasMany
    {
        return $this->hasMany(AccessoryStockLog::class);
    }

    /**
     * Auto-update status based on quantity.
     * in  => quantity > 5
     * low => 1-5
     * out => 0
     */
    public function updateStatusFromQuantity(): void
    {
        if ($this->quantity <= 0) {
            $this->status = 'out';
        } elseif ($this->quantity <= 5) {
            $this->status = 'low';
        } else {
            $this->status = 'in';
        }
    }
}