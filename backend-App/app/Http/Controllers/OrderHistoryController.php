<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OrderHistoryController extends Controller
{
    /**
     * Get order history (completed and cancelled orders)
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $storeId = $request->input('store_id', $user->store_id);

        // Admin can view any store's history
        if ($user->role === 'admin' && $request->has('store_id')) {
            $storeId = $request->input('store_id');
        }

        $query = Order::with(['items.menuItem', 'user'])
            ->where('store_id', $storeId);

        // Filter by status
        $status = $request->input('status', 'all');
        if ($status === 'completed') {
            $query->where('status', 'completed')
                  ->where('queue_status', 'completed');
        } elseif ($status === 'cancelled') {
            $query->where('status', 'cancelled');
        } else {
            // All: completed and cancelled
            $query->where(function($q) {
                $q->where(function($subQ) {
                    $subQ->where('status', 'completed')
                         ->where('queue_status', 'completed');
                })->orWhere('status', 'cancelled');
            });
        }

        // Filter by date
        if ($request->has('date')) {
            $query->whereDate('created_at', $request->input('date'));
        } else {
            // Default: today
            $query->whereDate('created_at', today());
        }

        $orders = $query->orderBy('created_at', 'desc')->get();

        return response()->json($orders);
    }

    /**
     * Get statistics
     */
    public function statistics(Request $request)
    {
        $user = Auth::user();
        $storeId = $request->input('store_id', $user->store_id);

        if ($user->role === 'admin' && $request->has('store_id')) {
            $storeId = $request->input('store_id');
        }

        $date = $request->input('date', today());

        $completed = Order::where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('queue_status', 'completed')
            ->whereDate('created_at', $date)
            ->count();

        $cancelled = Order::where('store_id', $storeId)
            ->where('status', 'cancelled')
            ->whereDate('created_at', $date)
            ->count();

        $totalRevenue = Order::where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('queue_status', 'completed')
            ->whereDate('created_at', $date)
            ->sum('total');

        return response()->json([
            'completed' => $completed,
            'cancelled' => $cancelled,
            'total_revenue' => $totalRevenue,
            'total_orders' => $completed + $cancelled,
        ]);
    }
}
