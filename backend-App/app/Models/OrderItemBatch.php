<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItemBatch extends Model
{
    protected $fillable = [
        'order_id',
        'batch_number',
        'payment_method',
        'payment_status',
        'subtotal',
        'paid_amount',
        'change_amount',
        'paid_at',
        'queue_status',
        'drink_queue_status',
        'queue_completed_at',
        'hold_reason',
        'drink_hold_reason',
    ];

    protected $casts = [
        'queue_completed_at' => 'datetime',
        'paid_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'change_amount' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'batch_id');
    }
}
