<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryDailyOverhead;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryOverheadController extends Controller
{
    /**
     * List overhead dengan filter tanggal / bulan.
     * GET /inventory/overheads?start_date=...&end_date=...
     */
    public function index(Request $request)
    {
        $storeId   = $request->user()->store_id;
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate   = $request->input('end_date', now()->toDateString());

        $overheads = InventoryDailyOverhead::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->whereBetween('date', [$startDate, $endDate])
            ->with([
                'inventoryItem:id,name,unit,price_per_unit',
                'user:id,name',
            ])
            ->orderByDesc('date')
            ->orderByDesc('created_at')
            ->get();

        // Ringkasan per bahan
        $summary = $overheads->groupBy('inventory_item_id')->map(function ($group) {
            $first = $group->first();
            return [
                'inventory_item_id' => $first->inventory_item_id,
                'name'              => $first->inventoryItem->name ?? '-',
                'unit'              => $first->inventoryItem->unit ?? '-',
                'total_quantity'    => round((float)$group->sum('quantity_used'), 3),
                'total_cost'        => round((float)$group->sum('cost_amount'), 2),
                'entry_count'       => $group->count(),
            ];
        })->values();

        return response()->json([
            'overheads'        => $overheads,
            'summary'          => $summary,
            'total_cost'       => round((float)$overheads->sum('cost_amount'), 2),
            'period'           => ['start' => $startDate, 'end' => $endDate],
        ]);
    }

    /**
     * Simpan overhead baru.
     * POST /inventory/overheads
     */
    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'inventory_item_id' => 'required|exists:inventory_items,id',
            'date'              => 'required|date',
            'quantity_used'     => 'required|numeric|min:0.001',
            'notes'             => 'nullable|string|max:255',
        ]);

        $storeId = $request->user()->store_id;

        // Ambil harga per unit dari inventori
        $item = InventoryItem::findOrFail($validated['inventory_item_id']);

        // Kurangi stok inventori sesuai overhead
        if ($item->current_stock < $validated['quantity_used']) {
            return response()->json([
                'message' => "Stok {$item->name} tidak cukup. Tersisa: {$item->current_stock} {$item->unit}"
            ], 422);
        }

        $item->current_stock -= $validated['quantity_used'];
        $item->save();

        $overhead = InventoryDailyOverhead::create([
            'store_id'          => $storeId,
            'inventory_item_id' => $validated['inventory_item_id'],
            'user_id'           => $request->user()->id,
            'date'              => $validated['date'],
            'quantity_used'     => $validated['quantity_used'],
            'unit'              => $item->unit,
            'price_per_unit'    => (float)$item->price_per_unit,
            'cost_amount'       => round($validated['quantity_used'] * (float)$item->price_per_unit, 2),
            'notes'             => $validated['notes'] ?? null,
        ]);

        $overhead->load('inventoryItem:id,name,unit,current_stock');

        return response()->json([
            'message'   => 'Overhead berhasil dicatat',
            'overhead'  => $overhead,
            'remaining_stock' => $item->current_stock,
        ], 201);
    }

    /**
     * Update overhead.
     * PUT /inventory/overheads/{id}
     */
    public function update(Request $request, InventoryDailyOverhead $overhead)
    {
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Pastikan milik toko yang sama
        if ($overhead->store_id !== $request->user()->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'quantity_used' => 'sometimes|numeric|min:0.001',
            'date'          => 'sometimes|date',
            'notes'         => 'nullable|string|max:255',
        ]);

        // Kembalikan stok lama, kurangi stok baru
        if (isset($validated['quantity_used'])) {
            $item = $overhead->inventoryItem;
            $diff = $validated['quantity_used'] - (float)$overhead->quantity_used;

            if ($diff > 0 && $item->current_stock < $diff) {
                return response()->json([
                    'message' => "Stok {$item->name} tidak cukup untuk perubahan ini."
                ], 422);
            }

            $item->current_stock -= $diff;
            $item->save();

            $validated['price_per_unit'] = (float)$item->price_per_unit;
            // cost_amount dihitung otomatis di model boot
        }

        $overhead->update($validated);

        return response()->json(['message' => 'Overhead diperbarui', 'overhead' => $overhead->fresh('inventoryItem')]);
    }

    /**
     * Hapus overhead dan kembalikan stok.
     * DELETE /inventory/overheads/{id}
     */
    public function destroy(Request $request, InventoryDailyOverhead $overhead)
    {
        if (!$request->user()->hasPermission('manage_inventory')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($overhead->store_id !== $request->user()->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Kembalikan stok
        $item = $overhead->inventoryItem;
        if ($item) {
            $item->current_stock += (float)$overhead->quantity_used;
            $item->save();
        }

        $overhead->delete();

        return response()->json(['message' => 'Overhead dihapus dan stok dikembalikan']);
    }

    /**
     * Rekap overhead bulanan.
     * GET /inventory/overheads/monthly-recap?year=2026&month=08
     */
    public function monthlyRecap(Request $request)
    {
        $storeId = $request->user()->store_id;
        $year    = $request->input('year', now()->year);
        $month   = $request->input('month', now()->month);

        $startDate = "{$year}-" . str_pad($month, 2, '0', STR_PAD_LEFT) . '-01';
        $endDate   = date('Y-m-t', strtotime($startDate));

        $recap = InventoryDailyOverhead::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->whereBetween('date', [$startDate, $endDate])
            ->select(
                'inventory_item_id',
                DB::raw('SUM(quantity_used) as total_quantity'),
                DB::raw('SUM(cost_amount) as total_cost'),
                DB::raw('COUNT(*) as entry_count'),
                DB::raw('AVG(quantity_used) as avg_daily')
            )
            ->with('inventoryItem:id,name,unit,price_per_unit')
            ->groupBy('inventory_item_id')
            ->orderByDesc('total_cost')
            ->get()
            ->map(function ($row) {
                return [
                    'inventory_item_id' => $row->inventory_item_id,
                    'name'              => $row->inventoryItem->name ?? '-',
                    'unit'              => $row->inventoryItem->unit ?? '-',
                    'total_quantity'    => round((float)$row->total_quantity, 3),
                    'total_cost'        => round((float)$row->total_cost, 2),
                    'avg_daily'         => round((float)$row->avg_daily, 3),
                    'entry_count'       => (int)$row->entry_count,
                ];
            });

        return response()->json([
            'year'       => (int)$year,
            'month'      => (int)$month,
            'recap'      => $recap,
            'total_cost' => round((float)$recap->sum('total_cost'), 2),
        ]);
    }
}
