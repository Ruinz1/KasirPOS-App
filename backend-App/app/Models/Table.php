<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_number',
        'status',
        'store_id',
        'current_order_id',
        'capacity',
        'notes',
    ];

    protected $casts = [
        'capacity' => 'integer',
    ];

    /**
     * Get the store that owns the table
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Get the current order occupying this table
     */
    public function currentOrder()
    {
        return $this->belongsTo(Order::class, 'current_order_id');
    }

    /**
     * Get all orders that have used this table
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
