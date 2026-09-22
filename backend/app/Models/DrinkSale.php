<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrinkSale extends Model
{
    protected $fillable = ['drink_id', 'sold_by', 'quantity', 'total_price'];

    public function drink()
    {
        return $this->belongsTo(Drink::class);
    }
}
