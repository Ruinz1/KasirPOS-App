<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

use App\Traits\BelongsToStore;

class InventoryItem extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'name',
        'type',
        'current_stock',
        'unit',
        'price_per_unit',
        'min_stock',
        'total_price',
        'category',
        'store_id',
        'status',        // For equipment: Baik, Rusak, Maintenance, etc.
        'description',   // Additional notes/description
    ];

    /**
     * Get the store that owns the inventory item.
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    protected $casts = [
        'current_stock' => 'decimal:2',
        'price_per_unit' => 'decimal:2',
        'min_stock' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    /**
     * Get menu ingredients that use this inventory item
     */
    public function menuIngredients(): HasMany
    {
        return $this->hasMany(MenuIngredient::class);
    }

    /**
     * Scope for stock items only
     */
    public function scopeStocks($query)
    {
        return $query->where('type', 'stock');
    }

    /**
     * Scope for equipment items only
     */
    public function scopeEquipment($query)
    {
        return $query->where('type', 'equipment');
    }

    /**
     * Calculate total value of this inventory item
     */
    public function calculateValue(): float
    {
        if ($this->type === 'stock') {
            return $this->current_stock * $this->price_per_unit;
        }
        return $this->total_price ?? 0;
    }

    /**
     * Check if stock is low
     */
    public function isLowStock(): bool
    {
        if ($this->type === 'equipment') {
            return false;
        }
        return $this->current_stock <= $this->min_stock;
    }

    /**
     * Get stock status
     */
    public function getStockStatus(): string
    {
        if ($this->type === 'equipment') {
            return 'N/A';
        }

        if ($this->current_stock <= 0) {
            return 'critical';
        }

        if ($this->current_stock <= $this->min_stock) {
            return 'warning';
        }

        return 'good';
    }
}
