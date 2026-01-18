<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CapitalRecord;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;

class CapitalController extends Controller
{
    /**
     * Display a listing of capital records
     */
    public function index(Request $request)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = CapitalRecord::with('user')->orderBy('date', 'desc');
        
        // Admin can filter by store_id
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        $records = $query->get();

        return response()->json($records);
    }

    /**
     * Store a newly created capital record
     */
    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0',
            'date' => 'required|date',
            'description' => 'nullable|string',
            'store_id' => 'nullable|exists:stores,id',
        ]);

        $validated['user_id'] = $request->user()->id;
        
        // If admin didn't provide store_id, use current user's store_id
        if (!isset($validated['store_id']) && $request->user()->store_id) {
            $validated['store_id'] = $request->user()->store_id;
        }

        $record = CapitalRecord::create($validated);

        return response()->json($record, 201);
    }

    /**
     * Display the specified capital record
     */
    public function show(Request $request, CapitalRecord $capitalRecord)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $capitalRecord->load('user');
        
        return response()->json($capitalRecord);
    }

    /**
     * Update the specified capital record
     */
    public function update(Request $request, CapitalRecord $capitalRecord)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'amount' => 'sometimes|numeric|min:0',
            'date' => 'sometimes|date',
            'description' => 'nullable|string',
        ]);

        $capitalRecord->update($validated);

        return response()->json($capitalRecord);
    }

    /**
     * Remove the specified capital record
     */
    public function destroy(Request $request, CapitalRecord $capitalRecord)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $capitalRecord->delete();

        return response()->json(['message' => 'Capital record deleted successfully']);
    }

    /**
     * Calculate business profit/loss analysis
     */
    public function calculateBreakeven(Request $request)
    {
        if (!$request->user()->hasPermission('manage_capital')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $storeId = $request->get('store_id');
        
        // Get initial capital
        $capitalQuery = CapitalRecord::query();
        if ($storeId && $request->user()->role === 'admin') {
            $capitalQuery->where('store_id', $storeId);
        }
        $initialCapital = $capitalQuery->sum('amount');

        // Get current assets (stock)
        $stockQuery = InventoryItem::stocks();
        
        if ($storeId && $request->user()->role === 'admin') {
            $stockQuery->where('store_id', $storeId);
        }
        
        $stockValue = $stockQuery->get()->sum(function ($item) {
            return $item->calculateValue();
        });

        // Get equipment - separate good and damaged
        $equipmentQuery = InventoryItem::equipment();
        
        if ($storeId && $request->user()->role === 'admin') {
            $equipmentQuery->where('store_id', $storeId);
        }
        
        $allEquipment = $equipmentQuery->get();
        
        // Good equipment (Baik, Maintenance, Tidak Digunakan) = Asset
        $goodEquipmentValue = $allEquipment->filter(function ($item) {
            return in_array($item->status, ['Baik', 'Maintenance', 'Tidak Digunakan', null]);
        })->sum(function ($item) {
            return $item->calculateValue();
        });
        
        // Damaged equipment (Rusak) = Loss
        $damagedEquipmentValue = $allEquipment->filter(function ($item) {
            return $item->status === 'Rusak';
        })->sum(function ($item) {
            return $item->calculateValue();
        });

        $currentAssets = $stockValue + $goodEquipmentValue;

        // Get revenue and expenses
        $orderQuery = Order::query();
        $userQuery = User::query();
        
        if ($storeId && $request->user()->role === 'admin') {
            $orderQuery->where('store_id', $storeId);
            $userQuery->where('store_id', $storeId);
        }
        
        $totalRevenue = $orderQuery->sum('total');
        $totalCOGS = $orderQuery->sum('cogs');
        
        // Calculate employee salaries (current month)
        $employees = $userQuery->get();
        $totalSalaries = $employees->sum(function ($employee) {
            return $employee->calculateMonthlySalary();
        });

        // Calculate total expenses
        // Expenses = COGS + Salaries + Damaged Equipment
        $totalExpenses = $totalCOGS + $totalSalaries + $damagedEquipmentValue;
        
        /**
         * Correct Business Profit/Loss Formula:
         * 
         * Net Profit = (Current Assets + Total Revenue) - (Initial Capital + Total Expenses)
         * 
         * Where:
         * - Current Assets = Stock Value + Good Equipment Value
         * - Total Revenue = All sales income
         * - Initial Capital = Money invested to start business
         * - Total Expenses = COGS + Salaries + Damaged Equipment
         * 
         * This shows the actual profit/loss of the business
         */
        $netProfit = ($currentAssets + $totalRevenue) - ($initialCapital + $totalExpenses);
        
        // Status: profit if net profit is positive
        $businessStatus = $netProfit >= 0 ? 'profit' : 'loss';

        // Return on Investment: (Net Profit / Initial Capital) * 100
        $roi = $initialCapital > 0 ? ($netProfit / $initialCapital) * 100 : 0;

        return response()->json([
            'initial_capital' => $initialCapital,
            'current_assets' => [
                'stock_value' => $stockValue,
                'equipment_value' => $goodEquipmentValue,
                'total' => $currentAssets,
            ],
            'revenue' => [
                'total_sales' => $totalRevenue,
            ],
            'expenses' => [
                'cogs' => $totalCOGS,
                'salaries' => $totalSalaries,
                'damaged_equipment' => $damagedEquipmentValue, // NEW: Damaged equipment as loss
                'total' => $totalExpenses,
            ],
            'profit_loss' => [
                'net_profit' => $netProfit,
                'status' => $businessStatus,
                'roi_percentage' => round($roi, 2),
            ],
        ]);
    }
}
