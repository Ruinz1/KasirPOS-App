<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    protected $fillable = [
        'store_id',
        'name',
        'phone',
        'total_points',
        'lifetime_points',
        'wa_info_status',
        'wa_info_method',
        'wa_info_sent_at',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function pointTransactions(): HasMany
    {
        return $this->hasMany(PointTransaction::class);
    }

    public function addPoints(int $points, ?int $orderId = null, string $description = ''): void
    {
        $this->increment('total_points', $points);
        $this->increment('lifetime_points', $points);

        PointTransaction::create([
            'member_id' => $this->id,
            'order_id' => $orderId,
            'points' => $points,
            'type' => 'earn',
            'description' => $description,
        ]);
    }

    public function redeemPoints(int $points, ?int $orderId = null, string $description = ''): bool
    {
        if ($this->total_points < $points) {
            return false;
        }

        $this->decrement('total_points', $points);

        PointTransaction::create([
            'member_id' => $this->id,
            'order_id' => $orderId,
            'points' => -$points,
            'type' => 'redeem',
            'description' => $description,
        ]);

        return true;
    }
}
