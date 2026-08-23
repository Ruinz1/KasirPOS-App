<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItemBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class QueueController extends Controller
{
    /**
     * Jabatan yang boleh menahan/melanjutkan (hold) pesanan di antrian.
     * Harus sinkron dengan HOLD_QUEUE_POSITIONS di frontend (src/hooks/useAuth.ts).
     */
    private const HOLD_QUEUE_POSITIONS = ['Kitchen Assistant', 'Koki', 'Kasir', 'Manager', 'Supervisor', 'Admin'];

    /**
     * Cek apakah user boleh menahan/melanjutkan pesanan:
     * role admin/owner, atau karyawan dengan jabatan dapur/manajemen.
     */
    private function canHoldQueue($user): bool
    {
        if (in_array($user->role, ['admin', 'owner'])) {
            return true;
        }

        $positions = is_array($user->positions) ? $user->positions : [];

        return !empty(array_intersect(self::HOLD_QUEUE_POSITIONS, $positions));
    }

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

        $orders = Order::with(['items.menuItem', 'user', 'table', 'batches.items.menuItem'])
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->where(function ($query) {
                // Ambil order yang masih dalam antrian:
                // 1. queue_status pending atau in_progress
                // 2. queue_status completed TAPI queue_completed_at masih null
                //    (berarti makanan selesai tapi minuman belum)
                // 3. ATAU punya batch tambahan yang belum selesai (kartu terpisah)
                $query->whereIn('queue_status', ['pending', 'in_progress', 'hold'])
                    ->orWhere(function ($q) {
                        $q->where('queue_status', 'completed')
                            ->whereNull('queue_completed_at');
                    })
                    ->orWhereHas('batches', function ($q) {
                        $q->where(function ($inner) {
                            $inner->whereIn('queue_status', ['pending', 'in_progress', 'hold'])
                                ->orWhereIn('drink_queue_status', ['pending', 'hold']);
                        });
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
            'queue_status' => 'required|in:pending,in_progress,completed,hold',
            'hold_reason' => 'nullable|string',
        ]);

        $order = Order::with('items.menuItem')->findOrFail($id);

        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Validasi jabatan untuk aksi hold & resume (lanjutkan dari hold)
        $isHoldAction = $request->queue_status === 'hold';
        $isResumeAction = $order->queue_status === 'hold'
            && in_array($request->queue_status, ['pending', 'in_progress']);
        if (($isHoldAction || $isResumeAction) && !$this->canHoldQueue($user)) {
            return response()->json([
                'message' => 'Jabatan Anda tidak diizinkan menahan/melanjutkan pesanan',
            ], 403);
        }

        $drinkCategories = ['minuman', 'drink', 'beverage', 'drinks'];

        // Simpan status lama sebelum diubah untuk pengecekan isReactivated
        $previousQueueStatus = $order->queue_status;
        $previousQueueCompletedAt = $order->queue_completed_at;

        $order->queue_status = $request->queue_status;
        if ($request->has('hold_reason')) {
            $order->hold_reason = $request->hold_reason;
        }
        if ($request->queue_status !== 'hold') {
            $order->hold_reason = null;
        }

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
        } elseif ($request->queue_status === 'pending' || $request->queue_status === 'in_progress' || $request->queue_status === 'hold') {
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
            'drink_queue_status' => 'required|in:pending,completed,hold',
            'hold_reason' => 'nullable|string',
        ]);

        $order = Order::with('items.menuItem')->findOrFail($id);

        // Check if user has access to this store
        $user = Auth::user();
        if ($user->role !== 'admin' && $order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Validasi jabatan untuk aksi hold & resume (lanjutkan dari hold)
        $isHoldAction = $request->drink_queue_status === 'hold';
        $isResumeAction = $order->drink_queue_status === 'hold'
            && $request->drink_queue_status === 'pending';
        if (($isHoldAction || $isResumeAction) && !$this->canHoldQueue($user)) {
            return response()->json([
                'message' => 'Jabatan Anda tidak diizinkan menahan/melanjutkan pesanan',
            ], 403);
        }

        $drinkCategories = ['minuman', 'drink', 'beverage', 'drinks'];

        $order->drink_queue_status = $request->drink_queue_status;
        // Alasan hold minuman disimpan terpisah (drink_hold_reason) agar tidak
        // menimpa/menghapus alasan hold makanan (hold_reason).
        if ($request->has('hold_reason')) {
            $order->drink_hold_reason = $request->hold_reason;
        }
        if ($request->drink_queue_status !== 'hold') {
            $order->drink_hold_reason = null;
        }

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
     * Update status makanan untuk SATU batch tambahan (kartu terpisah di antrian).
     * Independen dari pesanan awal maupun batch tambahan lainnya.
     */
    public function updateBatchStatus(Request $request, $batchId)
    {
        $request->validate([
            'queue_status' => 'required|in:pending,in_progress,completed,hold',
            'hold_reason' => 'nullable|string',
        ]);

        $batch = OrderItemBatch::with('order')->findOrFail($batchId);

        $user = Auth::user();
        if ($user->role !== 'admin' && $batch->order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $isHoldAction = $request->queue_status === 'hold';
        $isResumeAction = $batch->queue_status === 'hold'
            && in_array($request->queue_status, ['pending', 'in_progress']);
        if (($isHoldAction || $isResumeAction) && !$this->canHoldQueue($user)) {
            return response()->json([
                'message' => 'Jabatan Anda tidak diizinkan menahan/melanjutkan pesanan',
            ], 403);
        }

        $batch->queue_status = $request->queue_status;
        if ($request->has('hold_reason')) {
            $batch->hold_reason = $request->hold_reason;
        }
        if ($request->queue_status !== 'hold') {
            $batch->hold_reason = null;
        }

        $this->syncBatchCompletedAt($batch);
        $batch->save();

        return response()->json([
            'message' => 'Batch queue status updated successfully',
            'batch' => $batch->fresh(),
        ]);
    }

    /**
     * Update status minuman untuk SATU batch tambahan.
     */
    public function updateBatchDrinkStatus(Request $request, $batchId)
    {
        $request->validate([
            'drink_queue_status' => 'required|in:pending,completed,hold',
            'hold_reason' => 'nullable|string',
        ]);

        $batch = OrderItemBatch::with('order')->findOrFail($batchId);

        $user = Auth::user();
        if ($user->role !== 'admin' && $batch->order->store_id !== $user->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $isHoldAction = $request->drink_queue_status === 'hold';
        $isResumeAction = $batch->drink_queue_status === 'hold'
            && $request->drink_queue_status === 'pending';
        if (($isHoldAction || $isResumeAction) && !$this->canHoldQueue($user)) {
            return response()->json([
                'message' => 'Jabatan Anda tidak diizinkan menahan/melanjutkan pesanan',
            ], 403);
        }

        $batch->drink_queue_status = $request->drink_queue_status;
        if ($request->has('hold_reason')) {
            $batch->drink_hold_reason = $request->hold_reason;
        }
        if ($request->drink_queue_status !== 'hold') {
            $batch->drink_hold_reason = null;
        }

        $this->syncBatchCompletedAt($batch);
        $batch->save();

        return response()->json([
            'message' => 'Batch drink queue status updated successfully',
            'batch' => $batch->fresh(),
        ]);
    }

    /**
     * Batch dianggap benar-benar selesai hanya jika semua section yang dimilikinya
     * (makanan &/ minuman) sudah selesai.
     */
    private function syncBatchCompletedAt(OrderItemBatch $batch): void
    {
        $drinkCategories = ['minuman', 'drink', 'beverage', 'drinks'];
        $items = $batch->items()->with('menuItem')->get();

        $hasFood = $items->contains(function ($item) use ($drinkCategories) {
            return !in_array(strtolower($item->menuItem?->category ?? ''), $drinkCategories);
        });
        $hasDrink = $items->contains(function ($item) use ($drinkCategories) {
            return in_array(strtolower($item->menuItem?->category ?? ''), $drinkCategories);
        });

        $foodDone = $batch->queue_status === 'completed';
        $drinkDone = $batch->drink_queue_status === 'completed';

        $allDone = $hasFood && $hasDrink
            ? ($foodDone && $drinkDone)
            : ($hasDrink ? $drinkDone : $foodDone);

        $batch->queue_completed_at = $allDone ? now() : null;
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
            ->whereIn('queue_status', ['pending', 'hold'])
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

        // Batch tambahan dihitung sebagai unit kerja tersendiri (satu kartu = satu unit).
        $batchQuery = OrderItemBatch::whereHas('order', function ($q) use ($storeId) {
            $q->where('store_id', $storeId)
                ->where('status', 'completed')
                ->whereDate('created_at', today());
        });

        $pending += (clone $batchQuery)->whereIn('queue_status', ['pending', 'hold'])->count();

        $inProgress += (clone $batchQuery)->where(function ($q) {
            $q->where('queue_status', 'in_progress')
                ->orWhere(function ($q2) {
                    $q2->where('queue_status', 'completed')->whereNull('queue_completed_at');
                });
        })->count();

        $completedToday += (clone $batchQuery)
            ->where('queue_status', 'completed')
            ->whereNotNull('queue_completed_at')
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
