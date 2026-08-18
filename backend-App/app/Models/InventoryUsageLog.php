<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BelongsToStore;

class InventoryUsageLog extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'store_id',
        'inventory_item_id',
        'order_id',
        'order_item_id',
        'quantity_used',
        'unit',
        'price_per_unit',
        'cost_amount',
        'usage_type',
        'notes',
        'usage_date',
    ];

    protected $casts = [
        'quantity_used'  => 'decimal:4',
        'price_per_unit' => 'decimal:4',
        'cost_amount'    => 'decimal:2',
        'usage_date'     => 'date',
    ];

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
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
        return $query->whereBetween('usage_date', [$startDate, $endDate]);
    }

    /**
     * Scope: only order-based usage
     */
    public function scopeFromOrders($query)
    {
        return $query->where('usage_type', 'order');
    }
}
