<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyShopping extends Model
{
    use HasFactory;

    protected $table = 'daily_shopping';

    protected $fillable = [
        'store_id',
        'user_id',
        'inventory_item_id',
        'item_name',
        'quantity',
        'unit',
        'price_per_unit',
        'total_price',
        'status',
        'notes',
        'shopping_date',
    ];

    protected $casts = [
        'shopping_date' => 'date',
        'quantity' => 'decimal:2',
        'price_per_unit' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
