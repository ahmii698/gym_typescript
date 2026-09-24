<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrinkRestock extends Model
{
    protected $fillable = ['drink_id', 'restocked_by', 'quantity', 'cost_price'];

    public function drink()
    {
        return $this->belongsTo(Drink::class);
    }

    public function restockedBy()
    {
        return $this->belongsTo(User::class, 'restocked_by');
    }
}