<?php

// app/Models/Staff.php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    use BelongsToCompany;

    protected $table = 'staff';

    protected $fillable = [
        'name',
        'phone',
        'email',
        'role',
        'salary',
        'status',
    ];

    protected $casts = [
        'salary' => 'float',
    ];
}