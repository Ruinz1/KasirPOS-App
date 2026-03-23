<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
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
            'payment_method' => 'nullable|in:cash,card,qris',
            'payment_status' => 'nullable|in:paid,pending',
            'order_type' => 'required|in:dine_in,takeaway',
            'paid_amount' => 'nullable|numeric|min:0',
            'initial_cash' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.note' => 'nullable|string',
            'items.*.is_takeaway' => 'boolean',
            'items.*.additional_price' => 'nullable|numeric|min:0',
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

        // Set default payment_status if not provided
        // Jika payment_method null (Bayar Nanti), payment_status = pending
        if (empty($validated['payment_method'])) {
            $validated['payment_status'] = 'pending';
        } elseif ($validated['payment_method'] === 'qris') {
            $validated['payment_status'] = 'paid';
        } elseif (!isset($validated['payment_status'])) {
            $validated['payment_status'] = (isset($validated['paid_amount']) && $validated['paid_amount'] > 0) ? 'paid' : 'pending';
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
                'payment_status' => $validated['payment_status'],
                'order_type' => $validated['order_type'],
                'paid_amount' => $validated['paid_amount'] ?? null,
                'initial_cash' => $validated['initial_cash'] ?? null,
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
                $menuItem = MenuItem::with(['menuIngredients.inventoryItem', 'parent'])->findOrFail($item['menu_item_id']);
                
                // Determine target item for stock (Self or Parent)
                $stockItem = $menuItem->parent ?: $menuItem;
                $deductionAmount = $item['quantity'] * ($menuItem->parent ? $menuItem->portion_value : 1);
                
                // Check stock availability
                if (!$menuItem->uses_ingredients && $stockItem->stock < $deductionAmount) {
                    throw new \Exception("Insufficient stock for {$menuItem->name} (Available: " . (float)$stockItem->stock . ")");
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $requiredAmount = $ingredient->amount * $item['quantity'];
                        if ($inventoryItem->current_stock < $requiredAmount) {
                            throw new \Exception("Insufficient stock for {$inventoryItem->name}");
                        }
                    }
                }

                // Create order item with discounted price + additional price (variants)
                $discountedPrice = $menuItem->getDiscountedPrice();
                $additionalPrice = isset($item['additional_price']) ? (float)$item['additional_price'] : 0;
                $finalPrice = $discountedPrice + $additionalPrice;
                
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $item['quantity'],
                    'price' => $finalPrice, // Use final price with variants
                    'note' => $item['note'] ?? null,
                    'is_takeaway' => $item['is_takeaway'] ?? false,
                ]);

                // Reduce stock
                if (!$menuItem->uses_ingredients) {
                    $stockItem->stock -= $deductionAmount;
                    $stockItem->save();
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $inventoryItem->current_stock -= ($ingredient->amount * $item['quantity']);
                        $inventoryItem->save();
                    }
                }

                // Calculate totals using discounted price
                $itemTotal = $finalPrice * $item['quantity'];
                $itemCogs = $menuItem->calculateCOGS() * $item['quantity'];
                
                $total += $itemTotal;
                $cogs += $itemCogs;
            }

            // Update order totals
            $order->total = $total;
            $order->cogs = $cogs;
            $order->profit = $total - $cogs;
            
            // Set paid_amount and change_amount based on payment method
            if ($order->payment_method === 'qris' || $order->payment_method === 'card') {
                // QRIS and Card: paid_amount always equals total
                $order->paid_amount = $total;
                $order->change_amount = 0;
            } elseif ($order->payment_method === 'cash') {
                // Cash: use provided paid_amount or default to total
                if (!$order->paid_amount) {
                    $order->paid_amount = $total;
                }
                // Calculate change if paid enough
                if ($order->paid_amount >= $total) {
                    $order->change_amount = $order->paid_amount - $total;
                } else {
                    $order->change_amount = 0;
                }
            } else {
                // payment_method = null (Bayar Nanti): tidak ada pembayaran saat ini
                $order->paid_amount = null;
                $order->change_amount = null;
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
     * Update order (e.g. for settling pending payment)
     */
    public function update(Request $request, Order $order)
    {
        // Kasir can only update their own orders unless admin/owner
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'payment_status' => 'required|in:paid,pending',
            'payment_method' => 'sometimes|in:cash,card,qris',
            'paid_amount' => 'nullable|numeric|min:0',
            'second_payment_method' => 'nullable|in:cash,card,qris',
            'second_paid_amount' => 'nullable|numeric|min:0',
        ]);

        // Determine contexts
        $currentPaid = (float)($order->paid_amount ?? 0);
        $incomingAmount = (float)($validated['paid_amount'] ?? 0);
        $totalBill = (float)$order->total;
        
        $totalPaidAfter = 0;

        // CHECK EXPLICIT SPLIT BILL DARI REQUEST
        if ($request->has('second_paid_amount')) {
            if ($request->has('payment_method')) {
                $order->payment_method = $validated['payment_method'];
            }
            $order->paid_amount = $incomingAmount;

            if ($request->has('second_payment_method')) {
                $order->second_payment_method = $validated['second_payment_method'];
            }
            $order->second_paid_amount = (float)$validated['second_paid_amount'];

            $totalPaidAfter = $incomingAmount + (float)$validated['second_paid_amount'];
        } else {
            // AUTOMATIC ADD-ON PAYMENT LOGIC 
            if ($currentPaid > 0 && $incomingAmount < $totalBill && ($currentPaid + $incomingAmount >= $totalBill - 100)) {
                 // SPLIT PAYMENT CONTEXT (Auto fallback)
                 // Condition: Already paid something. Incoming is NOT full amount. Sum covers total.
                 
                 if ($request->has('payment_method')) {
                      $order->second_payment_method = $validated['payment_method'];
                 }
                 $order->second_paid_amount = $incomingAmount;
                 
                 // Primary payment method/amount remains untouched!
                 $totalPaidAfter = $currentPaid + $incomingAmount;
                 
            } else {
                 // FULL PAYMENT / FIRST PAYMENT / OVERWRITE CONTEXT
                 // Either first time pay, or user puts full money to overwrite previous.
                 
                 if ($request->has('payment_method')) {
                     $order->payment_method = $validated['payment_method'];
                 }
                 
                 // If this is an overwrite, we should clear secondary to avoid zombie data
                 if ($incomingAmount >= $totalBill) {
                      $order->second_payment_method = null;
                      $order->second_paid_amount = null;
                      $order->paid_amount = $incomingAmount;
                      $totalPaidAfter = $incomingAmount;
                 } else {
                      // Partial Primary Payment
                      $order->paid_amount = $incomingAmount;
                      $totalPaidAfter = $incomingAmount;
                 }
            }
        }
        
        // Update Status based on Total Paid
        if ($validated['payment_status'] === 'paid') {
            if ($totalPaidAfter >= $totalBill) {
                $order->payment_status = 'paid';
                $order->change_amount = $totalPaidAfter - $totalBill;
            } else {
                $order->payment_status = 'pending';
                $order->change_amount = 0;
            }
            $order->save();
        } elseif ($validated['payment_status'] === 'pending') {
            $order->payment_status = 'pending';
            $order->change_amount = 0;
            $order->save();
        }

        $order->load(['items.menuItem', 'user', 'store']);
        return response()->json($order);
    }

    /**
     * Update order items (Edit Order Content) - REPLACES items
     */
    public function updateItems(Request $request, Order $order)
    {
        // Kasir can only update their own orders unless admin/owner
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.note' => 'nullable|string',
            'items.*.is_takeaway' => 'boolean',
            'items.*.additional_price' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string',
            'order_type' => 'required|in:dine_in,takeaway',
        ]);

        DB::beginTransaction();
        try {
            // Restore inventory stock from OLD items
            $order->load('items.menuItem.menuIngredients.inventoryItem', 'items.menuItem.parent');
            foreach ($order->items as $orderItem) {
                $menuItem = $orderItem->menuItem;
                if ($menuItem && !$menuItem->uses_ingredients) {
                     $stockItem = $menuItem->parent ?: $menuItem;
                     $restoreAmount = $orderItem->quantity * ($menuItem->parent ? $menuItem->portion_value : 1);
                     
                     $stockItem->stock += $restoreAmount;
                     $stockItem->save();
                }

                if ($menuItem && $menuItem->menuIngredients) {
                    foreach ($menuItem->menuIngredients as $ingredient) {
                        $inventoryItem = $ingredient->inventoryItem;
                        if ($inventoryItem && $inventoryItem->type === 'stock') {
                            $inventoryItem->current_stock += ($ingredient->amount * $orderItem->quantity); // Restore
                            $inventoryItem->save();
                        }
                    }
                }
            }

            // Delete old items
            $order->items()->delete();

            // Insert new items and deduct stock
            $total = 0;
            $cogs = 0;

            foreach ($validated['items'] as $item) {
                $menuItem = MenuItem::with(['menuIngredients.inventoryItem', 'parent'])->findOrFail($item['menu_item_id']);
                
                // Determine target item for stock (Self or Parent)
                $stockItem = $menuItem->parent ?: $menuItem;
                $deductionAmount = $item['quantity'] * ($menuItem->parent ? $menuItem->portion_value : 1);
                
                // Check stock availability
                if (!$menuItem->uses_ingredients && $stockItem->stock < $deductionAmount) {
                    throw new \Exception("Insufficient stock for {$menuItem->name} (Available: " . (float)$stockItem->stock . ")");
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $requiredAmount = $ingredient->amount * $item['quantity'];
                        if ($inventoryItem->current_stock < $requiredAmount) {
                            throw new \Exception("Insufficient stock for {$inventoryItem->name}");
                        }
                    }
                }

                $discountedPrice = $menuItem->getDiscountedPrice();
                $additionalPrice = isset($item['additional_price']) ? (float)$item['additional_price'] : 0;
                $finalPrice = $discountedPrice + $additionalPrice;
                
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $item['quantity'],
                    'price' => $finalPrice,
                    'note' => $item['note'] ?? null,
                    'is_takeaway' => $item['is_takeaway'] ?? false,
                ]);

                // Reduce stock
                if (!$menuItem->uses_ingredients) {
                    $stockItem->stock -= $deductionAmount;
                    $stockItem->save();
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $inventoryItem->current_stock -= ($ingredient->amount * $item['quantity']);
                        $inventoryItem->save();
                    }
                }

                $total += $finalPrice * $item['quantity'];
                $cogs += $menuItem->calculateCOGS() * $item['quantity'];
            }

            // Update order details
            $order->total = $total;
            $order->cogs = $cogs;
            $order->profit = $total - $cogs;
            if (isset($validated['customer_name'])) $order->customer_name = $validated['customer_name'];
            if (isset($validated['order_type'])) $order->order_type = $validated['order_type'];

            // Adjust Payment Status
            if ($order->payment_status === 'paid') {
                 // Because they already received their change_amount previously, we bake it into paid_amount
                 // so the store only formally holds the exact original bill amount.
                 if ((float)$order->change_amount > 0) {
                     $order->paid_amount = (float)$order->paid_amount - (float)$order->change_amount;
                     $order->change_amount = 0;
                 }
                 
                 $effectivePaid = (float)$order->paid_amount + (float)$order->second_paid_amount;
                 
                 if ($effectivePaid < $total) {
                     // Total increased beyond what was paid -> Pending (Must pay difference)
                     $order->payment_status = 'pending'; 
                 } else {
                     // Still covered, update change
                     $order->change_amount = $effectivePaid - $total;
                 }
            }

            $order->save();
            DB::commit();

            return response()->json($order->load(['items.menuItem', 'user', 'store']));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to update order', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Add items to an existing order (APPEND items)
     */
    public function addItems(Request $request, Order $order)
    {
        // Kasir can only update their own orders unless admin/owner
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.note' => 'nullable|string',
            'items.*.is_takeaway' => 'boolean',
            'items.*.additional_price' => 'nullable|numeric|min:0',
        ]);

        DB::beginTransaction();
        try {
            $total = $order->total;
            $cogs = $order->cogs;
            $addedItems = [];

            foreach ($validated['items'] as $item) {
                $menuItem = MenuItem::with(['menuIngredients.inventoryItem', 'parent'])->findOrFail($item['menu_item_id']);
                
                // Determine target item for stock
                $stockItem = $menuItem->parent ?: $menuItem;
                $deductionAmount = $item['quantity'] * ($menuItem->parent ? $menuItem->portion_value : 1);
                
                // Check stock availability
                if (!$menuItem->uses_ingredients && $stockItem->stock < $deductionAmount) {
                    throw new \Exception("Insufficient stock for {$menuItem->name} (Available: " . (float)$stockItem->stock . ")");
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $requiredAmount = $ingredient->amount * $item['quantity'];
                        if ($inventoryItem->current_stock < $requiredAmount) {
                            throw new \Exception("Insufficient stock for {$inventoryItem->name}");
                        }
                    }
                }

                $discountedPrice = $menuItem->getDiscountedPrice();
                $additionalPrice = isset($item['additional_price']) ? (float)$item['additional_price'] : 0;
                $finalPrice = $discountedPrice + $additionalPrice;
                
                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $item['quantity'],
                    'price' => $finalPrice,
                    'note' => $item['note'] ?? null,
                    'is_takeaway' => $item['is_takeaway'] ?? false,
                    'is_addon' => true, // Mark as add-on
                ]);

                // Reduce stock
                if (!$menuItem->uses_ingredients) {
                    $stockItem->stock -= $deductionAmount;
                    $stockItem->save();
                }

                foreach ($menuItem->menuIngredients as $ingredient) {
                    $inventoryItem = $ingredient->inventoryItem;
                    if ($inventoryItem && $inventoryItem->type === 'stock') {
                        $inventoryItem->current_stock -= ($ingredient->amount * $item['quantity']);
                        $inventoryItem->save();
                    }
                }

                $total += $finalPrice * $item['quantity'];
                $cogs += $menuItem->calculateCOGS() * $item['quantity'];
                
                $orderItem->load('menuItem');
                $addedItems[] = $orderItem;
            }

            // Update order details
            $order->total = $total;
            $order->cogs = $cogs;
            $order->profit = $total - $cogs;

            // Check if queue status needs reset
            $shouldResetQueue = false;
            foreach ($addedItems as $addedItem) {
                $category = strtolower($addedItem->menuItem->category ?? '');
                if (in_array($category, ['makanan', 'minuman'])) {
                     $shouldResetQueue = true;
                     break;
                }
            }

            if ($shouldResetQueue) {
                 if ($order->queue_status === 'completed' || $order->queue_status === 'in_progress') {
                     $order->queue_status = 'pending';
                 }
            }

            // Adjust Payment Status
            if ($order->payment_status === 'paid') {
                 // Because they already received their change_amount previously, we bake it into paid_amount
                 // so the store only formally holds the exact original bill amount.
                 if ((float)$order->change_amount > 0) {
                     $order->paid_amount = (float)$order->paid_amount - (float)$order->change_amount;
                     $order->change_amount = 0;
                 }
                 
                 $effectivePaid = (float)$order->paid_amount + (float)$order->second_paid_amount;
                 
                 if ($effectivePaid < $total) {
                     // Total increased beyond what was paid -> Pending (Must pay difference)
                     $order->payment_status = 'pending'; 
                 } else {
                     // Still covered, update change
                     $order->change_amount = $effectivePaid - $total;
                 }
            } else if ($order->payment_status === 'pending') {
                 // If it's already pending, we shouldn't zero out everything blindly unless needed,
                 // but if there IS a change_amount (unlikely if pending), we'd bake it.
                 if ((float)$order->change_amount > 0) {
                     $order->paid_amount = (float)$order->paid_amount - (float)$order->change_amount;
                     $order->change_amount = 0;
                 }
            }

            $order->save();
            DB::commit();

            return response()->json([
                'order' => $order->load(['items.menuItem', 'user', 'store']),
                'added_items' => $addedItems
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to add items to order', 'error' => $e->getMessage()], 500);
        }
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
            $order->load(['items.menuItem.menuIngredients.inventoryItem', 'items.menuItem.parent']);
            
            foreach ($order->items as $orderItem) {
                $menuItem = $orderItem->menuItem;
                
                if ($menuItem && !$menuItem->uses_ingredients) {
                     $stockItem = $menuItem->parent ?: $menuItem;
                     $restoreAmount = $orderItem->quantity * ($menuItem->parent ? $menuItem->portion_value : 1);
                     
                     $stockItem->stock += $restoreAmount;
                     $stockItem->save();
                }

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

    /**
     * Upload payment proof images for an order
     */
    public function uploadPaymentProof(Request $request, Order $order)
    {
        // Kasir can only upload proof for their own orders unless admin/owner
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'images' => 'required|array|min:1|max:5',
            'images.*' => 'required|image|mimes:jpeg,png,jpg|max:5120', // Max 5MB per image
        ]);

        try {
            $uploadedPaths = [];
            
            foreach ($request->file('images') as $image) {
                // Store in storage/app/public/payment-proofs
                $path = $image->store('payment-proofs', 'public');
                $uploadedPaths[] = $path;
            }

            // Get existing proofs or initialize empty array
            $existingProofs = $order->payment_proof ?? [];
            
            // Merge with new uploads
            $allProofs = array_merge($existingProofs, $uploadedPaths);
            
            // Update order
            $order->payment_proof = $allProofs;
            $order->save();

            return response()->json([
                'message' => 'Payment proof uploaded successfully',
                'payment_proof' => $allProofs,
                'order' => $order->load(['items.menuItem', 'user', 'store'])
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to upload payment proof',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update order details (table, order_type, payment_method)
     * For editing completed orders
     */
    public function updateOrderDetails(Request $request, Order $order)
    {
        // Kasir can only update their own orders unless admin/owner
        if ($request->user()->isKasir() && $order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'table_id' => 'nullable|exists:tables,id',
            'order_type' => 'sometimes|in:dine_in,takeaway',
            'payment_method' => 'sometimes|in:cash,card,qris',
        ]);

        try {
            DB::beginTransaction();

            $oldTableId = $order->table_id;

            // Update order fields
            if (isset($validated['order_type'])) {
                $order->order_type = $validated['order_type'];
                
                // If changing to takeaway, remove table assignment
                if ($validated['order_type'] === 'takeaway' && $order->table_id) {
                    $oldTable = \App\Models\Table::find($order->table_id);
                    if ($oldTable) {
                        $oldTable->status = 'available';
                        $oldTable->current_order_id = null;
                        $oldTable->save();
                    }
                    $order->table_id = null;
                }
            }

            if (isset($validated['payment_method'])) {
                $order->payment_method = $validated['payment_method'];
            }

            // Handle table assignment
            if (array_key_exists('table_id', $validated)) {
                // Release old table if exists
                if ($oldTableId && $oldTableId != $validated['table_id']) {
                    $oldTable = \App\Models\Table::find($oldTableId);
                    if ($oldTable && $oldTable->current_order_id == $order->id) {
                        $oldTable->status = 'available';
                        $oldTable->current_order_id = null;
                        $oldTable->save();
                    }
                }

                // Assign new table
                if ($validated['table_id']) {
                    $newTable = \App\Models\Table::findOrFail($validated['table_id']);
                    
                    // Check if table is available
                    if ($newTable->status !== 'available' && $newTable->current_order_id != $order->id) {
                        DB::rollBack();
                        return response()->json([
                            'message' => 'Meja sudah terisi oleh pesanan lain'
                        ], 422);
                    }

                    $newTable->status = 'occupied';
                    $newTable->current_order_id = $order->id;
                    $newTable->save();

                    $order->table_id = $validated['table_id'];
                } else {
                    // Remove table assignment
                    $order->table_id = null;
                }
            }

            $order->save();
            DB::commit();

            return response()->json([
                'message' => 'Detail pesanan berhasil diperbarui',
                'order' => $order->load(['items.menuItem', 'user', 'store', 'table'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal memperbarui detail pesanan',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
