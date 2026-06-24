<?php

namespace App\Http\Controllers;

use App\Models\CashierShift;
use App\Models\Order;
use App\Models\DailyShopping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CashierShiftController extends Controller
{
    /**
     * Get list of shifts with optional filters.
     * Owner/Admin: sees all shifts for their store(s).
     * Kasir: sees only their own shifts.
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        $query = CashierShift::with('user')
            ->orderBy('opened_at', 'desc');

        // Admin can filter by store_id
        if ($user->role === 'admin' && $request->has('store_id')) {
            $query->where('store_id', $request->input('store_id'));
        }

        // Kasir can only see their own shifts
        if ($user->isKasir()) {
            $query->where('user_id', $user->id);
        }

        // Filter by specific user (for owner/admin)
        if ($request->has('user_id') && !$user->isKasir()) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('opened_at', '>=', $request->input('start_date'));
        }
        if ($request->has('end_date')) {
            $query->whereDate('opened_at', '<=', $request->input('end_date'));
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        $shifts = $query->get();

        return response()->json($shifts);
    }

    /**
     * Get the current active (open) shift for the authenticated user.
     */
    public function active(Request $request)
    {
        $user = Auth::user();

        $activeShift = CashierShift::where('user_id', $user->id)
            ->where('status', 'open')
            ->first();

        if (!$activeShift) {
            return response()->json(null);
        }

        // Calculate live shift data
        $shiftData = $activeShift->calculateShiftData();

        return response()->json([
            'shift' => $activeShift,
            'live_data' => $shiftData,
        ]);
    }

    /**
     * Open a new shift.
     */
    public function open(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'opening_cash' => 'required|numeric|min:0',
            'notes_open' => 'nullable|string|max:500',
        ]);

        // Check if user already has an open shift
        $existingShift = CashierShift::where('user_id', $user->id)
            ->where('status', 'open')
            ->first();

        if ($existingShift) {
            return response()->json([
                'message' => 'Anda masih memiliki shift yang aktif. Tutup shift sebelumnya terlebih dahulu.',
                'active_shift' => $existingShift,
            ], 422);
        }

        $storeId = $request->input('store_id', $user->store_id);

        $shift = CashierShift::create([
            'user_id' => $user->id,
            'store_id' => $storeId,
            'opened_at' => now(),
            'opening_cash' => $request->input('opening_cash'),
            'notes_open' => $request->input('notes_open'),
            'status' => 'open',
        ]);

        return response()->json([
            'message' => 'Shift berhasil dibuka',
            'shift' => $shift->load('user'),
        ], 201);
    }

    /**
     * Close an active shift.
     */
    public function close(Request $request, $id)
    {
        $user = Auth::user();

        $request->validate([
            'closing_cash' => 'required|numeric|min:0',
            'notes_close' => 'nullable|string|max:500',
            'adjustments' => 'nullable|array',
            'adjustments.*.amount' => 'required|numeric|min:0',
            'adjustments.*.notes' => 'nullable|string|max:255',
            'adjustments.*.is_shopping' => 'nullable|boolean',
        ]);

        $shift = CashierShift::findOrFail($id);

        // Only the shift owner or admin can close it
        if ($shift->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($shift->status === 'closed') {
            return response()->json([
                'message' => 'Shift ini sudah ditutup sebelumnya.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $adjustments = $request->input('adjustments', []);
            $shift->adjustments = $adjustments;

            // Create daily shopping records for shopping adjustments
            foreach ($adjustments as $adj) {
                if (!empty($adj['is_shopping'])) {
                    DailyShopping::create([
                        'store_id' => $shift->store_id,
                        'user_id' => $shift->user_id,
                        'item_name' => $adj['notes'] ?: 'Belanja Kasir',
                        'quantity' => 1,
                        'unit' => 'pcs',
                        'price_per_unit' => $adj['amount'],
                        'total_price' => $adj['amount'],
                        'status' => 'baru',
                        'notes' => 'Diinput otomatis dari Shift Kasir',
                        'shopping_date' => $shift->opened_at->format('Y-m-d'),
                        'cashier_shift_id' => $shift->id,
                    ]);
                }
            }

            // Calculate shift data from orders and newly created shopping records
            $shiftData = $shift->calculateShiftData();

            $closingCash = $request->input('closing_cash');
            $expectedCash = $shiftData['expected_cash'];
            $discrepancy = $closingCash - $expectedCash;

            $shift->update([
                'closed_at' => now(),
                'closing_cash' => $closingCash,
                'expected_cash' => $expectedCash,
                'cash_sales' => $shiftData['cash_sales'],
                'cash_change' => $shiftData['cash_change'],
                'qris_sales' => $shiftData['qris_sales'],
                'card_sales' => $shiftData['card_sales'],
                'discrepancy' => $discrepancy,
                'total_transactions' => $shiftData['total_transactions'],
                'total_revenue' => $shiftData['total_revenue'],
                'notes_close' => $request->input('notes_close'),
                'status' => 'closed',
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Shift berhasil ditutup',
                'shift' => $shift->fresh()->load('user'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menutup shift: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get detail of a specific shift.
     */
    public function show($id)
    {
        $user = Auth::user();

        $shift = CashierShift::with('user')->findOrFail($id);

        // Kasir can only view their own shifts
        if ($user->isKasir() && $shift->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $liveData = null;
        if ($shift->status === 'open') {
            $liveData = $shift->calculateShiftData();
        }

        return response()->json([
            'shift' => $shift,
            'live_data' => $liveData,
        ]);
    }

    /**
     * Get summary statistics for shifts.
     */
    public function summary(Request $request)
    {
        $user = Auth::user();

        $query = CashierShift::query();

        // Admin can filter by store_id
        if ($user->role === 'admin' && $request->has('store_id')) {
            $query->where('store_id', $request->input('store_id'));
        }

        // Kasir can only see own stats
        if ($user->isKasir()) {
            $query->where('user_id', $user->id);
        }

        // Default: current month
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', now()->toDateString());

        $query->whereDate('opened_at', '>=', $startDate)
              ->whereDate('opened_at', '<=', $endDate);

        $shifts = $query->get();

        $closedShifts = $shifts->where('status', 'closed');

        $totalShifts = $shifts->count();
        $closedCount = $closedShifts->count();
        $totalRevenue = $closedShifts->sum('total_revenue');
        $totalTransactions = $closedShifts->sum('total_transactions');
        $totalDiscrepancy = $closedShifts->sum('discrepancy');
        $avgDiscrepancy = $closedCount > 0 ? $totalDiscrepancy / $closedCount : 0;
        $negativeDiscrepancyCount = $closedShifts->where('discrepancy', '<', 0)->count();
        $openShiftsCount = $shifts->where('status', 'open')->count();

        return response()->json([
            'total_shifts' => $totalShifts,
            'closed_shifts' => $closedCount,
            'open_shifts' => $openShiftsCount,
            'total_revenue' => $totalRevenue,
            'total_transactions' => $totalTransactions,
            'total_discrepancy' => $totalDiscrepancy,
            'avg_discrepancy' => round($avgDiscrepancy, 2),
            'negative_discrepancy_count' => $negativeDiscrepancyCount,
        ]);
    }

    /**
     * Update a cashier shift (Edit).
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $shift = CashierShift::findOrFail($id);

        // Only shift owner or admin/owner role can update
        if ($shift->user_id !== $user->id && !$user->isAdmin() && $user->role !== 'owner') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'opening_cash' => 'sometimes|numeric|min:0',
            'closing_cash' => 'nullable|numeric|min:0',
            'notes_open' => 'nullable|string|max:500',
            'notes_close' => 'nullable|string|max:500',
            'status' => 'sometimes|in:open,closed',
            'adjustments' => 'nullable|array',
            'adjustments.*.amount' => 'required|numeric|min:0',
            'adjustments.*.notes' => 'nullable|string|max:255',
            'adjustments.*.is_shopping' => 'nullable|boolean',
        ]);

        DB::beginTransaction();
        try {
            if ($request->has('opening_cash')) {
                $shift->opening_cash = $request->input('opening_cash');
            }
            if ($request->has('closing_cash')) {
                $shift->closing_cash = $request->input('closing_cash');
            }
            if ($request->has('notes_open')) {
                $shift->notes_open = $request->input('notes_open');
            }
            if ($request->has('notes_close')) {
                $shift->notes_close = $request->input('notes_close');
            }
            if ($request->has('status')) {
                $shift->status = $request->input('status');
            }
            
            // Sync adjustments & daily shopping
            if ($request->has('adjustments')) {
                $adjustments = $request->input('adjustments');
                $shift->adjustments = $adjustments;
                
                // Sync daily shopping
                DailyShopping::where('cashier_shift_id', $shift->id)
                    ->where('notes', 'Diinput otomatis dari Shift Kasir')
                    ->delete();

                foreach ($adjustments as $adj) {
                    if (!empty($adj['is_shopping'])) {
                        DailyShopping::create([
                            'store_id' => $shift->store_id,
                            'user_id' => $shift->user_id,
                            'item_name' => $adj['notes'] ?: 'Belanja Kasir',
                            'quantity' => 1,
                            'unit' => 'pcs',
                            'price_per_unit' => $adj['amount'],
                            'total_price' => $adj['amount'],
                            'status' => 'baru',
                            'notes' => 'Diinput otomatis dari Shift Kasir',
                            'shopping_date' => $shift->opened_at->format('Y-m-d'),
                            'cashier_shift_id' => $shift->id,
                        ]);
                    }
                }
            }

            // Recalculate shift data if closed or if we want to save latest calculations
            $shiftData = $shift->calculateShiftData();
            
            $shift->cash_sales = $shiftData['cash_sales'];
            $shift->cash_change = $shiftData['cash_change'];
            $shift->qris_sales = $shiftData['qris_sales'];
            $shift->card_sales = $shiftData['card_sales'];
            $shift->total_transactions = $shiftData['total_transactions'];
            $shift->total_revenue = $shiftData['total_revenue'];
            $shift->expected_cash = $shiftData['expected_cash'];

            if ($shift->status === 'closed') {
                $closingCash = $shift->closing_cash ?? 0;
                $shift->discrepancy = $closingCash - $shift->expected_cash;
                if (!$shift->closed_at) {
                    $shift->closed_at = now();
                }
            } else {
                $shift->closed_at = null;
                $shift->closing_cash = null;
                $shift->discrepancy = null;
            }

            $shift->save();
            DB::commit();

            return response()->json([
                'message' => 'Shift berhasil diperbarui',
                'shift' => $shift->load('user'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal diperbarui: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a cashier shift (Delete).
     */
    public function destroy($id)
    {
        $user = Auth::user();
        
        // Only admin/owner can delete
        if (!$user->isAdmin() && $user->role !== 'owner') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $shift = CashierShift::findOrFail($id);

        DB::beginTransaction();
        try {
            // Delete auto-created daily shopping items associated with this shift
            DailyShopping::where('cashier_shift_id', $shift->id)
                ->where('notes', 'Diinput otomatis dari Shift Kasir')
                ->delete();

            $shift->delete();
            DB::commit();

            return response()->json([
                'message' => 'Shift berhasil dihapus',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menghapus shift: ' . $e->getMessage(),
            ], 500);
        }
    }
}
