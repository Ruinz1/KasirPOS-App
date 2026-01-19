<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * Display a listing of orders
     */
    public function index(Request $request)
    {
        $query = Order::with(['user', 'items.menuItem']);
        
        // Remove default status filter so we can see all orders (including cancelled)
        // Frontend will handle the display coloring
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Kasir can only see their own orders, even if they have view_reports permission
        if ($request->user()->isKasir()) {
            $query->where('user_id', $request->user()->id);
        }

        // Filter by store_id (only for admin)
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        // Filter by user_id (for owner/admin to see specific kasir's orders)
        if ($request->has('user_id') && !$request->user()->isKasir()) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $orders = $query->orderBy('created_at', 'desc')->get();

        return response()->json($orders);
    }

    /**
     * Store a newly created order
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'payment_method' => 'required|in:cash,card,qris',
            'order_type' => 'required|in:dine_in,takeaway',
            'paid_amount' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'store_id' => 'nullable|exists:stores,id',
        ]);
        
        $storeId = null;
        if (isset($validated['store_id'])) {
             // Explicitly provided (e.g. by admin)
             $storeId = $validated['store_id'];
        } elseif ($request->user()->store_id) {
             // Fallback to user's store
             $storeId = $request->user()->store_id;
        }

        DB::beginTransaction();
        try {
            // Calculate daily_number (reset every day)
            $today = now()->startOfDay();
            $dailyNumber = Order::where('store_id', $storeId)
                ->whereDate('created_at', $today)
                ->count() + 1;

            $order = Order::create([
                'user_id' => $request->user()->id,
                'customer_name' => $validated['customer_name'],
                'payment_method' => $validated['payment_method'],
                'order_type' => $validated['order_type'],
                'paid_amount' => $validated['paid_amount'] ?? null,
                'change_amount' => null, // Will be calculated after total
                'daily_number' => $dailyNumber,
                'total' => 0,
                'cogs' => 0,
                'profit' => 0,
                'store_id' => $storeId,
            ]);

            $total = 0;
            $cogs = 0;

            foreach ($validated['items'] as $item) {
                $menuItem = MenuItem::with('menuIngredients.inventoryItem')->findOrFail($item['menu_item_id']);
                
                // Check stock availability
                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem->type === 'stock') {
                        $requiredAmount = $ingredient->amount * $item['quantity'];
                        if ($inventoryItem->current_stock < $requiredAmount) {
                            throw new \Exception("Insufficient stock for {$inventoryItem->name}");
                        }
                    }
                }

                // Create order item with discounted price
                $discountedPrice = $menuItem->getDiscountedPrice();
                
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $item['quantity'],
                    'price' => $discountedPrice, // Use discounted price
                ]);

                // Reduce stock
                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem->type === 'stock') {
                        $inventoryItem->current_stock -= ($ingredient->amount * $item['quantity']);
                        $inventoryItem->save();
                    }
                }

                // Calculate totals using discounted price
                $itemTotal = $discountedPrice * $item['quantity'];
                $itemCogs = $menuItem->calculateCOGS() * $item['quantity'];
                
                $total += $itemTotal;
                $cogs += $itemCogs;
            }

            // Update order totals
            $order->total = $total;
            $order->cogs = $cogs;
            $order->profit = $total - $cogs;
            
            // Calculate change if paid_amount is provided
            if ($order->paid_amount && $order->paid_amount >= $total) {
                $order->change_amount = $order->paid_amount - $total;
            }
            
            $order->save();

            DB::commit();

            $order->load(['items.menuItem', 'user']);
            return response()->json($order, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create order', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified order
     */
    public function show(Request $request, Order $order)
    {
        // Kasir can only see their own orders
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->load(['items.menuItem', 'user', 'store']);
        
        return response()->json($order);
    }

    /**
     * Get sales report/statistics
     */
    public function salesReport(Request $request)
    {
        $query = Order::query();
        
        // Only include completed orders in statistics
        $query->where('status', 'completed');

        // Kasir can only see their own stats
        if ($request->user()->isKasir()) {
            $query->where('user_id', $request->user()->id);
        }

        // Filter by store_id (only for admin)
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        // Filter by user_id
        if ($request->has('user_id') && !$request->user()->isKasir()) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $orders = $query->get();

        $stats = [
            'total_orders' => $orders->count(),
            'total_sales' => $orders->sum('total'),
            'total_cogs' => $orders->sum('cogs'),
            'total_profit' => $orders->sum('profit'),
            'profit_margin' => $orders->sum('total') > 0 
                ? ($orders->sum('profit') / $orders->sum('total')) * 100 
                : 0,
        ];

        return response()->json($stats);
    }

    /**
     * Cancel an order (soft delete by changing status)
     * Restores inventory stock
     * All authenticated users (including karyawan) can cancel orders
     */
    public function destroy(Request $request, Order $order)
    {
        // All authenticated users can cancel orders (no role restriction)

        // Check if order is already cancelled
        if ($order->status === 'cancelled') {
            return response()->json(['message' => 'Order is already cancelled'], 400);
        }

        DB::beginTransaction();
        try {
            // Restore inventory stock
            $order->load('items.menuItem.menuIngredients.inventoryItem');
            
            foreach ($order->items as $orderItem) {
                $menuItem = $orderItem->menuItem;
                
                if ($menuItem && $menuItem->menuIngredients) {
                    foreach ($menuItem->menuIngredients as $ingredient) {
                        $inventoryItem = $ingredient->inventoryItem;
                        
                        if ($inventoryItem && $inventoryItem->type === 'stock') {
                            // Restore the stock
                            $inventoryItem->current_stock += ($ingredient->amount * $orderItem->quantity);
                            $inventoryItem->save();
                        }
                    }
                }
            }

            // Update order status to cancelled
            $order->status = 'cancelled';
            $order->save();

            DB::commit();

            return response()->json([
                'message' => 'Order cancelled successfully and inventory restored',
                'order' => $order
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to cancel order',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
