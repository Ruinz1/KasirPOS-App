<?php

namespace App\Traits;

use App\Models\Store;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait BelongsToStore
{
    /**
     * The "booted" method of the model.
     */
    protected static function bootBelongsToStore(): void
    {
        // Add Global Scope to filter by store
        static::addGlobalScope('store', function (Builder $builder) {
            if (Auth::check() && Auth::user()->store_id) {
                $builder->where('store_id', Auth::user()->store_id);
            }
        });

        // Auto-fill store_id on creation
        static::creating(function ($model) {
            if (Auth::check() && Auth::user()->store_id && !$model->store_id) {
                $model->store_id = Auth::user()->store_id;
            }
        });
    }

    /**
     * Get the store that the model belongs to.
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
