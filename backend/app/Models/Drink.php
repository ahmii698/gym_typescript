<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Drink extends Model
{
    protected $fillable = ['name', 'category', 'unit', 'quantity', 'low_stock_threshold', 'price', 'image'];

    // status attribute jo frontend directly use kar sake
    protected $appends = ['status'];

    public function getStatusAttribute(): string
    {
        if ($this->quantity <= 0) return 'out';
        if ($this->quantity <= $this->low_stock_threshold) return 'low';
        return 'in';
    }

    public function sales()
    {
        return $this->hasMany(DrinkSale::class);
    }
}
