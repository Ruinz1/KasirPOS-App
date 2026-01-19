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
        'discount_percentage',
        'image',
        'store_id',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
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
     * Calculate discounted price
     */
    public function getDiscountedPrice(): float
    {
        if ($this->discount_percentage > 0) {
            $discountAmount = ($this->price * $this->discount_percentage) / 100;
            return $this->price - $discountAmount;
        }
        return $this->price;
    }

    /**
     * Calculate discount amount
     */
    public function getDiscountAmount(): float
    {
        if ($this->discount_percentage > 0) {
            return ($this->price * $this->discount_percentage) / 100;
        }
        return 0;
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
     * Calculate profit per unit (after discount)
     */
    public function calculateProfit(): float
    {
        return $this->getDiscountedPrice() - $this->calculateCOGS();
    }

    /**
     * Calculate profit margin percentage (after discount)
     */
    public function calculateMargin(): float
    {
        $discountedPrice = $this->getDiscountedPrice();
        if ($discountedPrice == 0) {
            return 0;
        }
        return ($this->calculateProfit() / $discountedPrice) * 100;
    }
}
