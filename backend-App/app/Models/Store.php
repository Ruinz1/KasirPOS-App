<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'location',
        'owner_id',
        'image',
    ];

    /**
     * Get the owner of the store.
     */
    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get the users/employees belonging to the store.
     */
    public function users()
    {
        return $this->hasMany(User::class);
    }

    /**
     * Get orders for the store.
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }
    
    /**
     * Get inventory items for the store.
     */
    public function inventoryItems()
    {
        return $this->hasMany(InventoryItem::class);
    }
}
