<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\MenuIngredient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MenuController extends Controller
{
    /**
     * Display a listing of menu items
     */
    public function index(Request $request)
    {
        $query = MenuItem::with(['menuIngredients.inventoryItem']);

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Admin can filter by store_id
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        // Add calculated fields
        $items->each(function ($item) {
            $item->cogs = $item->calculateCOGS();
            $item->profit = $item->calculateProfit();
            $item->margin = $item->calculateMargin();
        });

        return response()->json($items);
    }

    /**
     * Store a newly created menu item
     */
    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'image' => 'nullable|string',
            'ingredients' => 'required|array|min:1',
            'ingredients.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'ingredients.*.amount' => 'required|numeric|min:0',
            'store_id' => 'nullable|exists:stores,id',
        ]);
        
        // If admin didn't provide store_id, use current user's store_id (if any)
        if (!isset($validated['store_id']) && $request->user()->store_id) {
            $validated['store_id'] = $request->user()->store_id;
        }

        DB::beginTransaction();
        try {
            $menuItem = MenuItem::create([
                'name' => $validated['name'],
                'category' => $validated['category'],
                'price' => $validated['price'],
                'image' => $validated['image'] ?? null,
                'store_id' => $validated['store_id'] ?? null,
            ]);

            foreach ($validated['ingredients'] as $ingredient) {
                MenuIngredient::create([
                    'menu_item_id' => $menuItem->id,
                    'inventory_item_id' => $ingredient['inventory_item_id'],
                    'amount' => $ingredient['amount'],
                ]);
            }

            DB::commit();

            $menuItem->load('menuIngredients.inventoryItem');
            return response()->json($menuItem, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create menu item', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified menu item
     */
    public function show(MenuItem $menuItem)
    {
        $menuItem->load('menuIngredients.inventoryItem');
        $menuItem->cogs = $menuItem->calculateCOGS();
        $menuItem->profit = $menuItem->calculateProfit();
        
        return response()->json($menuItem);
    }

    /**
     * Update the specified menu item
     */
    public function update(Request $request, MenuItem $menuItem)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:255',
            'price' => 'sometimes|numeric|min:0',
            'image' => 'nullable|string',
            'ingredients' => 'sometimes|array',
            'ingredients.*.inventory_item_id' => 'required|exists:inventory_items,id',
            'ingredients.*.amount' => 'required|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $menuItem->update([
                'name' => $validated['name'] ?? $menuItem->name,
                'category' => $validated['category'] ?? $menuItem->category,
                'price' => $validated['price'] ?? $menuItem->price,
                'image' => $validated['image'] ?? $menuItem->image,
            ]);

            if (isset($validated['ingredients'])) {
                // Delete existing ingredients
                $menuItem->menuIngredients()->delete();

                // Create new ingredients
                foreach ($validated['ingredients'] as $ingredient) {
                    MenuIngredient::create([
                        'menu_item_id' => $menuItem->id,
                        'inventory_item_id' => $ingredient['inventory_item_id'],
                        'amount' => $ingredient['amount'],
                    ]);
                }
            }

            DB::commit();

            $menuItem->load('menuIngredients.inventoryItem');
            return response()->json($menuItem);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update menu item', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified menu item
     */
    public function destroy(Request $request, MenuItem $menuItem)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $menuItem->delete();

        return response()->json(['message' => 'Menu item deleted successfully']);
    }
}
