<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class QueueController extends Controller
{
    /**
     * Get all orders in queue (FIFO order) - Today only
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $storeId = $request->input('store_id', $user->store_id);

        // Admin can view any store's queue
        if ($user->role === 'admin' && $request->has('store_id')) {
            $storeId = $request->input('store_id');
        }

        $orders = Order::with(['items.menuItem', 'user', 'table'])
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->where(function ($query) {
                // Ambil order yang masih dalam antrian:
                // 1. queue_status pending atau in_progress
                // 2. queue_status completed TAPI queue_completed_at masih null
                //    (berarti makanan selesai tapi minuman belum)
                $query->whereIn('queue_status', ['pending', 'in_progress'])
                    ->orWhere(function ($q) {
                        $q->where('queue_status', 'completed')
                            ->whereNull('queue_completed_at');
                    });
            })
            ->whereDate('created_at', today()) // Only today's orders
            ->orderBy('created_at', 'asc') // FIFO: First In First Out
            ->get();

        return response()->json($orders);
    }

    /**
     * Update food queue status (queue_status)
     * Order hanya keluar dari antrian jika SEMUA section yang ada sudah selesai
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'queue_status' => 'required|in:pending,in_progress,completed',
        ]);

        $order = Order::with('items.menuItem')->findOrFail($id);
        
        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $drinkCategories = ['minuman', 'drink', 'beverage', 'drinks'];

        // Simpan status lama sebelum diubah untuk pengecekan isReactivated
        $previousQueueStatus = $order->queue_status;
        $previousQueueCompletedAt = $order->queue_completed_at;

        $order->queue_status = $request->queue_status;

        if ($request->queue_status === 'completed') {
            // Cek apakah ini adalah re-activated order (sudah pernah selesai sebelumnya)
            $isReactivated = $previousQueueCompletedAt && $previousQueueStatus !== 'completed';

            if ($isReactivated) {
                // Re-order: cek apakah ada addon minuman yang belum selesai
                $drinkAddonItems = $order->items->filter(function ($item) use ($drinkCategories) {
                    if (!$item->is_addon) return false;
                    $category = strtolower($item->menuItem?->category ?? '');
                    return in_array($category, $drinkCategories);
                });
                // Jika ada addon minuman dan drink_queue_status belum selesai, jangan set queue_completed_at
                // (biarkan nanti diupdate saat minuman selesai)
                if ($drinkAddonItems->isNotEmpty() && $order->drink_queue_status !== 'completed') {
                    // makanan selesai, tapi minuman tambahan belum - jangan keluarkan dari antrian
                    $order->queue_completed_at = null;
                } else {
                    $order->queue_completed_at = now();
                }
            } else {
                // Order normal: cek apakah ada item minuman
                $hasDrinkItems = $order->items->contains(function ($item) use ($drinkCategories) {
                    $category = strtolower($item->menuItem?->category ?? '');
                    return in_array($category, $drinkCategories);
                });

                if ($hasDrinkItems && $order->drink_queue_status !== 'completed') {
                    // Ada minuman yang belum selesai - jangan keluarkan dari antrian
                    // Tetap set queue_status = completed untuk tracking makanan,
                    // tapi queue_completed_at = null agar tidak dianggap selesai
                    $order->queue_completed_at = null;
                } else {
                    // Tidak ada minuman, atau minuman sudah selesai → selesaikan order
                    $order->queue_completed_at = now();
                }
            }
        } elseif ($request->queue_status === 'pending' || $request->queue_status === 'in_progress') {
            // Reset queue_completed_at jika dikembalikan ke pending/in_progress
            $order->queue_completed_at = null;
        }
        
        $order->save();

        return response()->json([
            'message' => 'Queue status updated successfully',
            'order' => $order->load(['items.menuItem', 'user', 'table']),
            'auto_completed' => $order->queue_status === 'completed' && $order->queue_completed_at !== null,
        ]);
    }

    /**
     * Update drink queue status (drink_queue_status)
     * Order dikeluarkan dari antrian jika:
     * - Minuman selesai DAN makanan sudah selesai (atau tidak ada makanan)
     */
    public function updateDrinkStatus(Request $request, $id)
    {
        $request->validate([
            'drink_queue_status' => 'required|in:pending,completed',
        ]);

        $order = Order::with('items.menuItem')->findOrFail($id);
        
        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $drinkCategories = ['minuman', 'drink', 'beverage', 'drinks'];

        $order->drink_queue_status = $request->drink_queue_status;

        // Jika minuman selesai → cek apakah perlu auto-complete seluruh order
        if ($request->drink_queue_status === 'completed') {
            // Cek apakah ini re-activated order (queue_completed_at ada dan queue_status bukan completed)
            $isReactivated = $order->queue_completed_at && $order->queue_status !== 'completed';

            if ($isReactivated) {
                // Re-order: cek apakah ada addon MAKANAN (non-minuman) yang perlu diproses
                $foodAddonItems = $order->items->filter(function ($item) use ($drinkCategories) {
                    if (!$item->is_addon) return false; // bukan addon, skip
                    $category = strtolower($item->menuItem?->category ?? '');
                    return !in_array($category, $drinkCategories); // bukan minuman = makanan
                });

                if ($foodAddonItems->isEmpty()) {
                    // Tidak ada addon makanan → satu-satunya tambahan adalah minuman → order selesai
                    $order->queue_status = 'completed';
                    $order->queue_completed_at = now();
                }
                // Jika ada addon makanan, makanan harus selesai dulu (queue_status === 'completed')
                // Dalam kasus reactivated: queue_status adalah status MAKANAN addon
            } else {
                // Order normal:
                // Cek apakah ada item MAKANAN dalam order
                $hasFoodItems = $order->items->contains(function ($item) use ($drinkCategories) {
                    $category = strtolower($item->menuItem?->category ?? '');
                    return !in_array($category, $drinkCategories); // ada item non-minuman (makanan)
                });

                if (!$hasFoodItems) {
                    // Tidak ada makanan, semua item minuman → selesaikan order
                    $order->queue_status = 'completed';
                    $order->queue_completed_at = now();
                } elseif ($order->queue_status === 'completed') {
                    // Ada makanan DAN makanan sudah selesai → selesaikan order
                    $order->queue_completed_at = now();
                }
                // Jika ada makanan tapi makanan belum selesai → jangan keluarkan dari antrian
            }
        }

        $order->save();

        return response()->json([
            'message' => 'Drink queue status updated successfully',
            'order' => $order->load(['items.menuItem', 'user', 'table']),
            'auto_completed' => $order->queue_status === 'completed' && $order->queue_completed_at !== null,
        ]);
    }


    /**
     * Update order notes
     */
    public function updateNotes(Request $request, $id)
    {
        $request->validate([
            'notes' => 'nullable|string',
        ]);

        $order = Order::findOrFail($id);
        
        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->notes = $request->notes;
        $order->save();

        return response()->json([
            'message' => 'Notes updated successfully',
            'order' => $order->load(['items.menuItem', 'user', 'table'])
        ]);
    }

    /**
     * Get queue statistics - Today only
     */
    public function statistics(Request $request)
    {
        $user = Auth::user();
        $storeId = $request->input('store_id', $user->store_id);

        // Admin can view any store's statistics
        if ($user->role === 'admin' && $request->has('store_id')) {
            $storeId = $request->input('store_id');
        }

        $pending = Order::where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('queue_status', 'pending')
            ->whereDate('created_at', today()) // Only today
            ->count();

        // inProgress: queue_status = in_progress ATAU (queue_status = completed dengan queue_completed_at null)
        // Kasus kedua = makanan selesai, minuman belum selesai
        $inProgress = Order::where('store_id', $storeId)
            ->where('status', 'completed')
            ->whereDate('created_at', today()) // Only today
            ->where(function ($query) {
                $query->where('queue_status', 'in_progress')
                    ->orWhere(function ($q) {
                        $q->where('queue_status', 'completed')
                            ->whereNull('queue_completed_at');
                    });
            })
            ->count();

        $completedToday = Order::where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('queue_status', 'completed')
            ->whereNotNull('queue_completed_at') // Benar-benar selesai (makanan + minuman)
            ->whereDate('queue_completed_at', today())
            ->count();

        return response()->json([
            'pending' => $pending,
            'in_progress' => $inProgress,
            'completed_today' => $completedToday,
            'total_in_queue' => $pending + $inProgress,
        ]);
    }

    /**
     * Revert completed order back to queue
     */
    public function revertToQueue($id)
    {
        $order = Order::findOrFail($id);
        
        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->queue_status = 'pending';
        $order->drink_queue_status = 'pending';
        $order->queue_completed_at = null;
        $order->save();

        return response()->json([
            'message' => 'Order dikembalikan ke antrian',
            'order' => $order->load(['items.menuItem', 'user', 'table'])
        ]);
    }
}
