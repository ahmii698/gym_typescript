<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessoryStockLog extends Model
{
    protected $fillable = [
        'accessory_id',
        'type',            // initial | restock | removed
        'quantity_change',
        'quantity_after',
        'unit_price',
        'note',
    ];

    protected $casts = [
        'quantity_change' => 'integer',
        'quantity_after'  => 'integer',
        'unit_price'      => 'float',
    ];

    public function accessory(): BelongsTo
    {
        return $this->belongsTo(Accessory::class);
    }
}