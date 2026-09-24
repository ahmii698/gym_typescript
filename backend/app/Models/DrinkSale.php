<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrinkSale extends Model
{
    protected $fillable = ['drink_id', 'sold_by', 'quantity', 'cost_price', 'total_price'];

    public function drink()
    {
        return $this->belongsTo(Drink::class);
    }

    public function soldBy()
    {
        return $this->belongsTo(User::class, 'sold_by');
    }
}