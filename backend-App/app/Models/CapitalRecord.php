<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\BelongsToStore;

class CapitalRecord extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'amount',
        'date',
        'description',
        'user_id',
        'store_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date' => 'date',
    ];

    /**
     * Get the user (owner) who recorded this capital
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
