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
        'uses_ingredients',
        'status',
        'stock',
        'parent_id',
        'portion_value',
        'image',
        'store_id',
        'variants',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'uses_ingredients' => 'boolean',
        'stock' => 'float',
        'portion_value' => 'float',
        'variants' => 'array',
    ];

    protected $appends = ['current_stock'];

    protected static function booted()
    {
        static::saving(function ($menuItem) {
            // Automatically update status based on stock
            if (!$menuItem->uses_ingredients) {
                if ($menuItem->stock <= 0) {
                    $menuItem->status = 'kosong';
                } else if ($menuItem->stock > 0 && $menuItem->status === 'kosong') {
                    $menuItem->status = 'ready';
                }
            }
        });
    }

    /**
     * Get the parent menu item (for shared stock)
     */
    public function parent()
    {
        return $this->belongsTo(MenuItem::class, 'parent_id');
    }

    /**
     * Get child menu items (that share this stock)
     */
    public function children()
    {
        return $this->hasMany(MenuItem::class, 'parent_id');
    }

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

    /**
     * Get effective stock (handles parent/child logic and ingredient-based stock)
     */
    public function getCurrentStockAttribute()
    {
        // If this item uses ingredients, calculate stock based on available inventory
        if ($this->uses_ingredients) {
            $minStock = null;
            
            // We need to ensure ingredients are loaded to avoid N+1 if possible, 
            // but here we just access the relationship. Controller should handle eager loading.
            foreach ($this->menuIngredients as $ingredient) {
                $inventoryItem = $ingredient->inventoryItem;
                
                // Only consider 'stock' type inventory (ignore equipment, etc.)
                if ($inventoryItem && $inventoryItem->type === 'stock' && $ingredient->amount > 0) {
                    $possible = floor($inventoryItem->current_stock / $ingredient->amount);
                    
                    if ($minStock === null || $possible < $minStock) {
                        $minStock = $possible;
                    }
                }
            }
            
            // If ingredients are defined but none found or loaded, default to 0
            // If no ingredients are defined at all, technically stock is 0 (can't make it)
            return (float)($minStock ?? 0);
        }

        if ($this->parent_id) {
            return $this->parent ? (float)$this->parent->stock : 0;
        }
        return (float)$this->stock;
    }

    /**
     * Get status attribute (overrides DB value for ingredient-based items)
     */
    public function getStatusAttribute($value)
    {
        if ($this->getAttribute('uses_ingredients')) {
            // Avoid infinite loop if current_stock uses status (it doesn't)
            return $this->getCurrentStockAttribute() > 0 ? 'ready' : 'kosong';
        }

        $currentStock = $this->getCurrentStockAttribute();
        if ($currentStock <= 0) {
            return 'kosong';
        } else if ($currentStock > 0 && $value === 'kosong') {
            return 'ready';
        }

        return $value;
    }
}
