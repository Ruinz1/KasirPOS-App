<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Table;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TableController extends Controller
{
    /**
     * Display a listing of tables
     */
    public function index(Request $request)
    {
        $query = Table::with(['currentOrder.items.menuItem', 'store']);

        // Filter by store_id (for admin)
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        } elseif ($request->user()->store_id) {
            // For owner/kasir, only show their store's tables
            $query->where('store_id', $request->user()->store_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $tables = $query->orderBy('table_number')->get();

        return response()->json($tables);
    }

    /**
     * Store a newly created table
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'table_number' => 'required|string|max:50',
            'capacity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
            'store_id' => 'nullable|exists:stores,id',
        ]);

        // Set store_id
        $storeId = null;
        if (isset($validated['store_id'])) {
            $storeId = $validated['store_id'];
        } elseif ($request->user()->store_id) {
            $storeId = $request->user()->store_id;
        }

        // Check if table number already exists in this store
        $exists = Table::where('table_number', $validated['table_number'])
            ->where('store_id', $storeId)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Nomor meja sudah ada di toko ini'
            ], 422);
        }

        $table = Table::create([
            'table_number' => $validated['table_number'],
            'capacity' => $validated['capacity'] ?? 4,
            'notes' => $validated['notes'] ?? null,
            'store_id' => $storeId,
            'status' => 'available',
        ]);

        return response()->json($table, 201);
    }

    /**
     * Display the specified table
     */
    public function show(Table $table)
    {
        $table->load(['currentOrder.items.menuItem', 'store']);
        return response()->json($table);
    }

    /**
     * Update the specified table
     */
    public function update(Request $request, Table $table)
    {
        $validated = $request->validate([
            'table_number' => 'sometimes|string|max:50',
            'capacity' => 'sometimes|integer|min:1',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:available,occupied,reserved',
        ]);

        // Check if table number is being changed and if it already exists
        if (isset($validated['table_number']) && $validated['table_number'] !== $table->table_number) {
            $exists = Table::where('table_number', $validated['table_number'])
                ->where('store_id', $table->store_id)
                ->where('id', '!=', $table->id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Nomor meja sudah ada di toko ini'
                ], 422);
            }
        }

        $table->update($validated);

        return response()->json($table);
    }

    /**
     * Remove the specified table
     */
    public function destroy(Table $table)
    {
        // Check if table is currently occupied
        if ($table->status === 'occupied') {
            return response()->json([
                'message' => 'Tidak dapat menghapus meja yang sedang terisi'
            ], 422);
        }

        $table->delete();

        return response()->json([
            'message' => 'Meja berhasil dihapus'
        ]);
    }

    /**
     * Assign an order to a table (occupy table)
     */
    public function assignOrder(Request $request, Table $table)
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
        ]);

        // Check if table is available
        if ($table->status !== 'available') {
            return response()->json([
                'message' => 'Meja tidak tersedia'
            ], 422);
        }

        DB::beginTransaction();
        try {
            $order = Order::findOrFail($validated['order_id']);

            // Update table
            $table->status = 'occupied';
            $table->current_order_id = $order->id;
            $table->save();

            // Update order
            $order->table_id = $table->id;
            $order->save();

            DB::commit();

            $table->load(['currentOrder.items.menuItem']);
            return response()->json($table);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal mengatur meja',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Release a table (mark as available)
     */
    public function releaseTable(Table $table)
    {
        DB::beginTransaction();
        try {
            // Update table
            $table->status = 'available';
            $table->current_order_id = null;
            $table->save();

            DB::commit();

            return response()->json([
                'message' => 'Meja berhasil dikosongkan',
                'table' => $table
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal mengosongkan meja',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mark table as ready for service (all food served)
     */
    public function markServed(Table $table)
    {
        if ($table->current_order_id) {
            $order = Order::find($table->current_order_id);
            if ($order) {
                $order->queue_status = 'completed';
                $order->queue_completed_at = now();
                $order->save();
            }
        }

        return response()->json([
            'message' => 'Meja ditandai sudah dilayani',
            'table' => $table->load('currentOrder')
        ]);
    }
}
