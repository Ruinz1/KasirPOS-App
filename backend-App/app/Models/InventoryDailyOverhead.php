<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BelongsToStore;

class InventoryDailyOverhead extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'store_id',
        'inventory_item_id',
        'user_id',
        'date',
        'quantity_used',
        'unit',
        'price_per_unit',
        'cost_amount',
        'notes',
    ];

    protected $casts = [
        'quantity_used'  => 'decimal:4',
        'price_per_unit' => 'decimal:4',
        'cost_amount'    => 'decimal:2',
        'date'           => 'date',
    ];

    /**
     * Boot — otomatis hitung cost_amount dari quantity × price sebelum simpan
     */
    protected static function booted(): void
    {
        static::saving(function (self $record) {
            $record->cost_amount = (float) $record->quantity_used * (float) $record->price_per_unit;
        });
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Scope: filter by date range
     */
    public function scopeInDateRange($query, string $startDate, string $endDate)
    {
        return $query->whereBetween('date', [$startDate, $endDate]);
    }
}
