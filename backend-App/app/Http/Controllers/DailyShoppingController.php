<?php

namespace App\Http\Controllers;

use App\Models\DailyShopping;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyShoppingController extends Controller
{
    // Get daily shopping items
    public function index(Request $request)
    {
        $user = $request->user();
        $date = $request->input('date', now()->format('Y-m-d'));
        
        // Determine store_id
        $storeId = $user->role === 'admin' && $request->has('store_id')
            ? $request->input('store_id')
            : $user->store_id;

        $items = DailyShopping::with('user')
            ->where('store_id', $storeId)
            ->whereDate('shopping_date', $date)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($items);
    }

    // Store new shopping item(s)
    public function store(Request $request)
    {
        $user = $request->user();
        $storeId = $user->role === 'admin' && $request->has('store_id')
            ? $request->input('store_id')
            : $user->store_id;


        // Cek apakah input adalah batch (memiliki key 'items' yang berupa array)
        if ($request->has('items') && is_array($request->input('items'))) {
            $validated = $request->validate([
                'shopping_date' => 'required|date',
                'items' => 'required|array|min:1',
                'items.*.item_name' => 'required|string|max:255',
                'items.*.quantity' => 'required|numeric|min:0',
                'items.*.unit' => 'required|string|max:50',
                'items.*.price_per_unit' => 'required|numeric|min:0',
                'items.*.notes' => 'nullable|string',
                'items.*.inventory_item_id' => 'nullable|exists:inventory_items,id',
                'user_id' => 'nullable|exists:users,id', // Allow selecting purchaser
            ]);

            $buyerId = $request->filled('user_id') ? $request->user_id : $user->id;
            $createdItems = [];
            
            DB::transaction(function () use ($validated, $buyerId, $storeId, &$createdItems) {
                foreach ($validated['items'] as $itemData) {
                    $totalPrice = $itemData['quantity'] * $itemData['price_per_unit'];
                    
                    $shoppingItem = DailyShopping::create([
                        'store_id' => $storeId,
                        'user_id' => $buyerId, 
                        'inventory_item_id' => $itemData['inventory_item_id'] ?? null,
                        'item_name' => $itemData['item_name'],
                        'quantity' => $itemData['quantity'],
                        'unit' => $itemData['unit'],
                        'price_per_unit' => $itemData['price_per_unit'],
                        'total_price' => $totalPrice,
                        'status' => 'baru',
                        'notes' => $itemData['notes'] ?? null,
                        'shopping_date' => $validated['shopping_date'],
                    ]);
                    
                    $createdItems[] = $shoppingItem;

                    // Update Inventory Logic
                    if (!empty($itemData['inventory_item_id'])) {
                        $inventoryItem = \App\Models\InventoryItem::find($itemData['inventory_item_id']);
                        if ($inventoryItem) {
                            $oldStock = $inventoryItem->current_stock ?? 0;
                            $oldPrice = $inventoryItem->price_per_unit ?? 0;
                            
                            $addStock = $itemData['quantity'];
                            $addPrice = $itemData['price_per_unit'];
                            
                            $newStock = $oldStock + $addStock;
                            
                            // Weighted Average Cost
                            if ($newStock > 0) {
                                $newAvgPrice = (($oldStock * $oldPrice) + ($addStock * $addPrice)) / $newStock;
                            } else {
                                $newAvgPrice = $addPrice;
                            }
                            
                            $inventoryItem->current_stock = $newStock;
                            $inventoryItem->price_per_unit = $newAvgPrice;
                            // Update total value as well just in case
                            $inventoryItem->total_price = $newStock * $newAvgPrice;
                            
                            $inventoryItem->save();
                        }
                    }
                }
            });

            return response()->json($createdItems, 201);
        }

        // Fallback ke single item (untuk backward compatibility jika ada)
        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0',
            'unit' => 'required|string|max:50',
            'price_per_unit' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
            'shopping_date' => 'required|date',
        ]);

        $totalPrice = $validated['quantity'] * $validated['price_per_unit'];

        $item = DailyShopping::create([
            'store_id' => $storeId,
            'user_id' => $user->id,
            'item_name' => $validated['item_name'],
            'quantity' => $validated['quantity'],
            'unit' => $validated['unit'],
            'price_per_unit' => $validated['price_per_unit'],
            'total_price' => $totalPrice,
            'status' => 'baru',
            'notes' => $validated['notes'] ?? null,
            'shopping_date' => $validated['shopping_date'],
        ]);

        return response()->json($item->load('user'), 201);
    }

    // ... existing updateStatus, destroy, statistics ...

    // Update shopping item
    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'item_name' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0',
            'unit' => 'required|string|max:50',
            'price_per_unit' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
            'user_id' => 'nullable|exists:users,id',
            'shopping_date' => 'required|date',
        ]);

        $item = DailyShopping::findOrFail($id);

        $totalPrice = $validated['quantity'] * $validated['price_per_unit'];

        $item->update([
            'item_name' => $validated['item_name'],
            'quantity' => $validated['quantity'],
            'unit' => $validated['unit'],
            'price_per_unit' => $validated['price_per_unit'],
            'total_price' => $totalPrice,
            'notes' => $validated['notes'] ?? null,
            'user_id' => $validated['user_id'] ?? $item->user_id, // Keep old user if not provided
            'shopping_date' => $validated['shopping_date'],
        ]);

        return response()->json($item->load('user'));
    }

    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:baru,habis,sisa,belum_digunakan',
        ]);

        $item = DailyShopping::findOrFail($id);
        $item->update(['status' => $validated['status']]);

        return response()->json($item);
    }

    public function destroy($id)
    {
        $item = DailyShopping::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Item deleted successfully']);
    }

    public function statistics(Request $request)
    {
        $user = $request->user();
        $date = $request->input('date', now()->format('Y-m-d'));
        
        $storeId = $user->role === 'admin' && $request->has('store_id')
            ? $request->input('store_id')
            : $user->store_id;

        // Total belanja hari ini
        $totalShopping = DailyShopping::where('store_id', $storeId)
            ->whereDate('shopping_date', $date)
            ->sum('total_price');

        // Total pendapatan hari ini (dari pesanan completed)
        $totalRevenue = Order::where('store_id', $storeId)
            ->whereDate('created_at', $date)
            ->where('status', 'completed')
            ->sum('total');

        // Keuntungan = Pendapatan - Belanja
        $profit = $totalRevenue - $totalShopping;

        // Count items by status
        $statusCount = DailyShopping::where('store_id', $storeId)
            ->whereDate('shopping_date', $date)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'total_shopping' => $totalShopping,
            'total_revenue' => $totalRevenue,
            'profit' => $profit,
            'total_items' => DailyShopping::where('store_id', $storeId)
                ->whereDate('shopping_date', $date)
                ->count(),
            'status_count' => [
                'baru' => $statusCount['baru'] ?? 0,
                'habis' => $statusCount['habis'] ?? 0,
                'sisa' => $statusCount['sisa'] ?? 0,
                'belum_digunakan' => $statusCount['belum_digunakan'] ?? 0,
            ],
        ]);
    }

    // Export daily shopping to Excel
    public function export(Request $request)
    {
        $user = $request->user();
        $date = $request->input('date', now()->format('Y-m-d'));
        
        $storeId = $user->role === 'admin' && $request->has('store_id')
            ? $request->input('store_id')
            : $user->store_id;

        $items = DailyShopping::with('user')
            ->where('store_id', $storeId)
            ->whereDate('shopping_date', $date)
            ->orderBy('created_at', 'desc')
            ->get();

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\DailyShoppingExport($items, $date), 
            'belanja-harian-' . $date . '.xlsx'
        );
    }

    // Get monthly recap
    public function monthlyRecap(Request $request)
    {
        $user = $request->user();
        $date = $request->input('date', now()->format('Y-m-d'));
        $month = \Carbon\Carbon::parse($date)->month;
        $year = \Carbon\Carbon::parse($date)->year;

        $storeId = $user->role === 'admin' && $request->has('store_id')
            ? $request->input('store_id')
            : $user->store_id;

        $recap = DailyShopping::where('store_id', $storeId)
            ->whereMonth('shopping_date', $month)
            ->whereYear('shopping_date', $year)
            ->with('user:id,name')
            ->orderBy('shopping_date', 'asc')
            ->get()
            ->groupBy('shopping_date')
            ->map(function ($items, $date) {
                return [
                    'date' => $date,
                    'total_items' => $items->count(),
                    'total_amount' => $items->sum('total_price'),
                    'items_summary' => $items->map(function($item) {
                        return [
                            'name' => $item->item_name,
                            'total' => $item->total_price,
                            'buyer' => $item->user->name ?? '-'
                        ];
                    })
                ];
            })
            ->values();

        return response()->json($recap);
    }

    // Get all users in the same store (for buyer selection - not limited to karyawan)
    public function getUsers(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\User::select('id', 'name', 'role', 'store_id')
            ->orderBy('name', 'asc');

        // Admin: can see all users or filter by store
        if ($user->role === 'admin') {
            if ($request->has('store_id') && $request->input('store_id') !== 'all') {
                $query->where('store_id', $request->input('store_id'));
            }
        } else {
            // Owner/Karyawan: only see users from their own store
            $query->where('store_id', $user->store_id);
        }

        $users = $query->get();

        return response()->json($users);
    }
}
