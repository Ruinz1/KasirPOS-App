<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use App\Traits\BelongsToStore;

class MenuItem extends Model
{
    use BelongsToStore;
    
    protected $fillable = [
        'name',
        'category',
        'price',
        'image',
        'store_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    /**
     * Get ingredients for this menu item
     */
    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(InventoryItem::class, 'menu_ingredients')
            ->withPivot('amount')
            ->withTimestamps();
    }

    /**
     * Get menu ingredients (pivot records)
     */
    public function menuIngredients(): HasMany
    {
        return $this->hasMany(MenuIngredient::class);
    }

    /**
     * Get order items for this menu item
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Calculate COGS (Cost of Goods Sold) for this menu item
     */
    public function calculateCOGS(): float
    {
        $cogs = 0;
        
        foreach ($this->menuIngredients as $ingredient) {
            $inventoryItem = $ingredient->inventoryItem;
            if ($inventoryItem && $inventoryItem->type === 'stock') {
                $cogs += $ingredient->amount * $inventoryItem->price_per_unit;
            }
        }
        
        return $cogs;
    }

    /**
     * Calculate profit per unit
     */
    public function calculateProfit(): float
    {
        return $this->price - $this->calculateCOGS();
    }

    /**
     * Calculate profit margin percentage
     */
    public function calculateMargin(): float
    {
        if ($this->price == 0) {
            return 0;
        }
        return ($this->calculateProfit() / $this->price) * 100;
    }
}
