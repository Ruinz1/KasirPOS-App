<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    /**
     * Display a listing of inventory items
     */
    public function index(Request $request)
    {
        $query = InventoryItem::query();

        // Filter by type if provided
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Admin can filter by store_id
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        $items = $query->orderBy('created_at', 'desc')->get();

        // Add calculated fields
        $items->each(function ($item) {
            $item->value = $item->calculateValue();
            $item->stock_status = $item->getStockStatus();
            $item->is_low_stock = $item->isLowStock();
        });

        return response()->json($items);
    }

    /**
     * Store a newly created inventory item
     */
    public function store(Request $request)
    {
        // Check if user has permission
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:stock,equipment',
            'category' => 'required|string|max:255',
            
            // Stock fields (required if type is stock)
            'current_stock' => 'required_if:type,stock|nullable|numeric|min:0',
            'unit' => 'required_if:type,stock|nullable|string',
            'price_per_unit' => 'nullable|numeric|min:0',
            'min_stock' => 'required_if:type,stock|nullable|numeric|min:0',
            
            // Total price (required for both stock and equipment)
            'total_price' => 'required|numeric|min:0',
            'store_id' => 'nullable|exists:stores,id',
            
            // Equipment fields
            'status' => 'nullable|string|max:255',        // Baik, Rusak, Maintenance
            'description' => 'nullable|string',           // Keterangan
        ]);
        
        // Calculate price_per_unit from total_price for stock items
        if ($validated['type'] === 'stock' && isset($validated['total_price']) && isset($validated['current_stock']) && $validated['current_stock'] > 0) {
            $validated['price_per_unit'] = $validated['total_price'] / $validated['current_stock'];
        }
        
        // If admin didn't provide store_id, use current user's store_id
        if (!isset($validated['store_id']) && $request->user()->store_id) {
            $validated['store_id'] = $request->user()->store_id;
        }

        $item = InventoryItem::create($validated);

        return response()->json($item, 201);
    }

    /**
     * Display the specified inventory item
     */
    public function show(InventoryItem $inventoryItem)
    {
        $inventoryItem->value = $inventoryItem->calculateValue();
        $inventoryItem->stock_status = $inventoryItem->getStockStatus();
        
        return response()->json($inventoryItem);
    }

    /**
     * Update the specified inventory item
     */
    public function update(Request $request, InventoryItem $inventoryItem)
    {
        // Check if user has permission
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:stock,equipment',
            'category' => 'sometimes|string|max:255',
            'current_stock' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string',
            'price_per_unit' => 'nullable|numeric|min:0',
            'min_stock' => 'nullable|numeric|min:0',
            'total_price' => 'nullable|numeric|min:0',
            'store_id' => 'nullable|exists:stores,id',
            'status' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        // Recalculate price_per_unit if total_price or current_stock changed for stock items
        $type = $validated['type'] ?? $inventoryItem->type;
        if ($type === 'stock') {
            $totalPrice = $validated['total_price'] ?? $inventoryItem->total_price;
            $currentStock = $validated['current_stock'] ?? $inventoryItem->current_stock;
            
            if ($totalPrice > 0 && $currentStock > 0) {
                $validated['price_per_unit'] = $totalPrice / $currentStock;
            }
        }

        $inventoryItem->update($validated);

        return response()->json($inventoryItem);
    }

    /**
     * Remove the specified inventory item
     */
    public function destroy(Request $request, InventoryItem $inventoryItem)
    {
        // Check if user has permission
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $inventoryItem->delete();

        return response()->json(['message' => 'Inventory item deleted successfully']);
    }

    /**
     * Calculate total inventory value
     */
    public function calculateTotalValue(Request $request)
    {
        $query = InventoryItem::query();
        
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        $items = $query->get();
        
        $stockValue = $items->where('type', 'stock')->sum(function ($item) {
             return $item->calculateValue();
        });
        
        $equipmentValue = $items->where('type', 'equipment')->sum(function ($item) {
             return $item->calculateValue();
        });
        
        return response()->json([
            'stock_value' => $stockValue,
            'equipment_value' => $equipmentValue,
            'total_value' => $stockValue + $equipmentValue,
        ]);
    }
}
