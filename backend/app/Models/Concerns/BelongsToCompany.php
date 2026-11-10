<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany()
    {
        // Har query mein login wale user ki company ka filter khud lag jayega
        static::addGlobalScope('company', function (Builder $builder) {
            $user = auth('sanctum')->user();
            if ($user && isset($user->company_id)) {
                $builder->where($builder->getModel()->getTable() . '.company_id', $user->company_id);
            }
        });

        // Naya record banate waqt company_id khud lag jayegi
        static::creating(function ($model) {
            if (empty($model->company_id)) {
                $user = auth('sanctum')->user();
                if ($user && isset($user->company_id)) {
                    $model->company_id = $user->company_id;
                }
            }
        });
    }
}