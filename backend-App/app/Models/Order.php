<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

use App\Traits\BelongsToStore;

class Order extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'customer_name',
        'customer_notes',
        'total',
        'cogs',
        'profit',
        'payment_method',
        'second_payment_method',
        'paid_amount',
        'second_paid_amount',
        'payment_status',
        'order_type',
        'payment_proof',
        'change_amount',
        'initial_cash',
        'daily_number',
        'status',
        'queue_status',
        'drink_queue_status',
        'notes',
        'queue_completed_at',
        'store_id',
        'table_id',
    ];

    protected $casts = [
        'payment_proof' => 'array',
    ];

    /**
     * Get the store that the order belongs to.
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }
    
    /**
     * Get the user (kasir) who created this order
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get order items
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Get the table assigned to this order
     */
    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    /**
     * Calculate totals for this order
     */
    public function calculateTotals(): void
    {
        $total = 0;
        $cogs = 0;

        foreach ($this->items as $item) {
            $total += $item->price * $item->quantity;
            
            $menuItem = $item->menuItem;
            if ($menuItem) {
                $cogs += $menuItem->calculateCOGS() * $item->quantity;
            }
        }

        $this->total = $total;
        $this->cogs = $cogs;
        $this->profit = $total - $cogs;
    }
}
