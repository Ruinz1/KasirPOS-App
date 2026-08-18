<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryUsageLog;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryReportController extends Controller
{
    /**
     * Rekap pemakaian bahan baku per periode.
     * Query: ?start_date=2026-08-01&end_date=2026-08-31&group_by=day|week|month
     */
    public function usageReport(Request $request)
    {
        $storeId = $request->user()->store_id;

        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate   = $request->input('end_date', now()->toDateString());
        $groupBy   = $request->input('group_by', 'day'); // day | month
        $inventoryItemId = $request->input('inventory_item_id'); // filter per bahan

        $query = InventoryUsageLog::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->whereBetween('usage_date', [$startDate, $endDate])
            ->where('usage_type', 'order');

        if ($inventoryItemId) {
            $query->where('inventory_item_id', $inventoryItemId);
        }

        // Rekap per bahan (summary tabel)
        $byIngredient = (clone $query)
            ->select(
                'inventory_item_id',
                DB::raw('SUM(quantity_used) as total_quantity'),
                DB::raw('SUM(cost_amount) as total_cost'),
                DB::raw('MAX(price_per_unit) as last_price_per_unit'),
                DB::raw('COUNT(DISTINCT order_id) as order_count')
            )
            ->with('inventoryItem:id,name,unit,category,price_per_unit')
            ->groupBy('inventory_item_id')
            ->orderByDesc('total_cost')
            ->get()
            ->map(function ($row) {
                return [
                    'inventory_item_id'  => $row->inventory_item_id,
                    'name'               => $row->inventoryItem->name ?? '-',
                    'unit'               => $row->inventoryItem->unit ?? '-',
                    'category'           => $row->inventoryItem->category ?? '-',
                    'current_price'      => (float)($row->inventoryItem->price_per_unit ?? 0),
                    'total_quantity'     => round((float)$row->total_quantity, 3),
                    'total_cost'         => round((float)$row->total_cost, 2),
                    'order_count'        => (int)$row->order_count,
                ];
            });

        // Tren harian atau bulanan
        $dateFormat = $groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
        $trendData = (clone $query)
            ->select(
                DB::raw("DATE_FORMAT(usage_date, '{$dateFormat}') as period"),
                DB::raw('SUM(cost_amount) as total_cost'),
                DB::raw('SUM(quantity_used) as total_quantity')
            )
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Ringkasan total
        $summary = [
            'total_cost'      => round((float)$query->sum('cost_amount'), 2),
            'total_quantity'  => round((float)$query->sum('quantity_used'), 3),
            'ingredient_count' => $byIngredient->count(),
            'start_date'      => $startDate,
            'end_date'        => $endDate,
        ];

        return response()->json([
            'summary'        => $summary,
            'by_ingredient'  => $byIngredient,
            'trend'          => $trendData,
        ]);
    }

    /**
     * Histori pemakaian detail untuk satu bahan tertentu.
     * GET /inventory/{inventoryItem}/usage-history
     */
    public function itemHistory(Request $request, InventoryItem $inventoryItem)
    {
        $storeId   = $request->user()->store_id;
        $startDate = $request->input('start_date', now()->subDays(30)->toDateString());
        $endDate   = $request->input('end_date', now()->toDateString());

        $logs = InventoryUsageLog::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->where('inventory_item_id', $inventoryItem->id)
            ->whereBetween('usage_date', [$startDate, $endDate])
            ->with(['order:id,daily_number,customer_name,created_at', 'orderItem:id,menu_item_id,quantity'])
            ->orderByDesc('usage_date')
            ->orderByDesc('created_at')
            ->paginate(50);

        return response()->json($logs);
    }

    /**
     * Ringkasan pemakaian harian (total cost dari usage + overhead).
     * GET /inventory/daily-summary?date=2026-08-10
     */
    public function dailySummary(Request $request)
    {
        $storeId = $request->user()->store_id;
        $date    = $request->input('date', now()->toDateString());

        // Pemakaian dari order
        $orderUsage = InventoryUsageLog::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->where('usage_date', $date)
            ->where('usage_type', 'order')
            ->select(
                'inventory_item_id',
                DB::raw('SUM(quantity_used) as total_quantity'),
                DB::raw('SUM(cost_amount) as total_cost')
            )
            ->with('inventoryItem:id,name,unit')
            ->groupBy('inventory_item_id')
            ->get();

        // Overhead hari ini
        $overheads = \App\Models\InventoryDailyOverhead::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->where('date', $date)
            ->with('inventoryItem:id,name,unit')
            ->get();

        $totalOrderCost    = round((float)$orderUsage->sum('total_cost'), 2);
        $totalOverheadCost = round((float)$overheads->sum('cost_amount'), 2);

        return response()->json([
            'date'               => $date,
            'order_usage'        => $orderUsage,
            'overheads'          => $overheads,
            'total_order_cost'   => $totalOrderCost,
            'total_overhead_cost'=> $totalOverheadCost,
            'total_cogs'         => $totalOrderCost + $totalOverheadCost,
        ]);
    }

    /**
     * Rekap pemakaian per bahan per hari dalam satu rentang (untuk tabel histori bahan).
     * GET /inventory/{inventoryItem}/daily-usage?start_date=...&end_date=...
     */
    public function itemDailyUsage(Request $request, InventoryItem $inventoryItem)
    {
        $storeId   = $request->user()->store_id;
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate   = $request->input('end_date', now()->toDateString());

        $dailyUsage = InventoryUsageLog::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->where('inventory_item_id', $inventoryItem->id)
            ->whereBetween('usage_date', [$startDate, $endDate])
            ->select(
                'usage_date',
                DB::raw('SUM(quantity_used) as total_quantity'),
                DB::raw('SUM(cost_amount) as total_cost'),
                DB::raw('COUNT(DISTINCT order_id) as order_count')
            )
            ->groupBy('usage_date')
            ->orderBy('usage_date', 'desc')
            ->get();

        $overheadUsage = \App\Models\InventoryDailyOverhead::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->where('inventory_item_id', $inventoryItem->id)
            ->whereBetween('date', [$startDate, $endDate])
            ->select(
                'date as usage_date',
                DB::raw('SUM(quantity_used) as total_quantity'),
                DB::raw('SUM(cost_amount) as total_cost'),
                DB::raw('0 as order_count')
            )
            ->groupBy('date')
            ->get();

        return response()->json([
            'inventory_item'  => $inventoryItem->only(['id', 'name', 'unit', 'current_stock', 'price_per_unit']),
            'order_usage'     => $dailyUsage,
            'overhead_usage'  => $overheadUsage,
            'total_quantity'  => round((float)$dailyUsage->sum('total_quantity') + (float)$overheadUsage->sum('total_quantity'), 3),
            'total_cost'      => round((float)$dailyUsage->sum('total_cost') + (float)$overheadUsage->sum('total_cost'), 2),
        ]);
    }
}
