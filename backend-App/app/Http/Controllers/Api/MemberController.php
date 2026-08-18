<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendMemberPointsInfoJob;
use App\Models\Member;
use App\Models\Order;
use App\Services\WhatsAppNotifier;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->user()->store_id;

        $query = Member::where('store_id', $storeId)
            ->withCount('orders')
            ->orderBy('total_points', 'desc');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function rfm(Request $request)
    {
        $storeId = $request->user()->store_id;
        $type = $request->input('type', 'spender'); // spender | frequency | inactive
        $inactiveDays = max(1, (int) $request->input('inactive_days', 60));

        $query = Member::where('store_id', $storeId)
            ->select('members.*')
            ->selectSub(
                Order::selectRaw('COUNT(*)')
                    ->whereColumn('member_id', 'members.id')
                    ->where('status', 'completed'),
                'frequency'
            )
            ->selectSub(
                Order::selectRaw('COALESCE(SUM(total), 0)')
                    ->whereColumn('member_id', 'members.id')
                    ->where('status', 'completed'),
                'monetary'
            )
            ->selectSub(
                Order::selectRaw('MAX(created_at)')
                    ->whereColumn('member_id', 'members.id')
                    ->where('status', 'completed'),
                'last_order_at'
            );

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $members = $query->get()->map(function ($member) use ($inactiveDays) {
            $member->frequency    = (int) $member->frequency;
            $member->monetary     = (float) $member->monetary;
            $member->recency_days = $member->last_order_at
                ? (int) now()->diffInDays($member->last_order_at, true)
                : null;
            $member->segment      = $this->classifySegment($member->frequency, $member->recency_days);
            return $member;
        });

        if ($type === 'inactive') {
            $members = $members
                ->filter(fn ($m) => $m->frequency > 0 && $m->recency_days !== null && $m->recency_days >= $inactiveDays)
                ->sortByDesc('recency_days');
        } elseif ($type === 'frequency') {
            $members = $members->sortByDesc('frequency');
        } else {
            $members = $members->sortByDesc('monetary');
        }

        return response()->json($members->values());
    }

    /**
     * Klasifikasi segmen RFM berdasarkan frekuensi dan recency.
     */
    private function classifySegment(int $frequency, ?int $recencyDays): array
    {
        if ($frequency === 0 || $recencyDays === null) {
            return ['key' => 'new', 'label' => 'Baru Daftar', 'color' => 'blue'];
        }
        if ($frequency >= 10 && $recencyDays <= 14) {
            return ['key' => 'champion', 'label' => 'Champion 🏆', 'color' => 'gold'];
        }
        if ($frequency >= 5 && $recencyDays <= 30) {
            return ['key' => 'loyal', 'label' => 'Loyal 💛', 'color' => 'yellow'];
        }
        if ($frequency >= 2 && $recencyDays <= 30) {
            return ['key' => 'potential', 'label' => 'Potential 🌱', 'color' => 'green'];
        }
        if ($recencyDays > 60) {
            return ['key' => 'lost', 'label' => 'Lost 💤', 'color' => 'gray'];
        }
        if ($recencyDays > 30) {
            return ['key' => 'at_risk', 'label' => 'At Risk ⚠️', 'color' => 'red'];
        }
        return ['key' => 'occasional', 'label' => 'Sesekali', 'color' => 'purple'];
    }

    public function store(Request $request)
    {
        $storeId = $request->user()->store_id;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
        ]);

        $existing = Member::where('store_id', $storeId)
            ->where('phone', $validated['phone'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Nomor telepon sudah terdaftar', 'member' => $existing], 409);
        }

        $member = Member::create([
            'store_id' => $storeId,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
        ]);

        $storeName = $request->user()->store->name ?? 'toko kami';
        WhatsAppNotifier::sendTemplate($member->phone, 'member_baru', [
            'customer_name' => $member->name,
            'bakso_bento_malang' => $storeName,
        ]);

        return response()->json($member, 201);
    }

    public function show(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $member->load([
            'orders' => fn($q) => $q->latest()->limit(20)->with('items.menuItem'),
            'pointTransactions' => fn($q) => $q->latest()->limit(50),
        ]);

        return response()->json($member);
    }

    /**
     * Riwayat pesanan member dengan filter periode & pagination.
     * GET /members/{member}/order-history?month=2026-08&per_page=20
     */
    public function orderHistory(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $query = $member->orders()
            ->where('status', 'completed')
            ->with(['items.menuItem:id,name,category', 'user:id,name']);

        if ($request->filled('month')) {
            // format: YYYY-MM
            [$year, $month] = explode('-', $request->input('month'));
            $query->whereYear('created_at', $year)->whereMonth('created_at', $month);
        }
        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $perPage = min((int)$request->input('per_page', 20), 100);
        $orders  = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($orders);
    }

    /**
     * Statistik lengkap member: total belanja, rata-rata, menu favorit, aktivitas bulanan, segmen.
     * GET /members/{member}/statistics
     */
    public function statistics(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $completedOrders = $member->orders()->where('status', 'completed');

        $totalOrders   = (clone $completedOrders)->count();
        $totalSpent    = (float)(clone $completedOrders)->sum('total');
        $avgOrderValue = $totalOrders > 0 ? round($totalSpent / $totalOrders, 2) : 0;
        $lastOrderAt   = (clone $completedOrders)->max('created_at');
        $firstOrderAt  = (clone $completedOrders)->min('created_at');
        $recencyDays   = $lastOrderAt ? (int)now()->diffInDays($lastOrderAt, true) : null;

        // Menu favorit (top 5 item paling sering dipesan)
        $favoriteMenus = \App\Models\OrderItem::whereIn(
                'order_id',
                $member->orders()->where('status', 'completed')->select('id')
            )
            ->select('menu_item_id', \Illuminate\Support\Facades\DB::raw('SUM(quantity) as total_qty'))
            ->with('menuItem:id,name,category')
            ->groupBy('menu_item_id')
            ->orderByDesc('total_qty')
            ->limit(5)
            ->get()
            ->map(fn($oi) => [
                'menu_item_id' => $oi->menu_item_id,
                'name'         => $oi->menuItem->name ?? '-',
                'category'     => $oi->menuItem->category ?? '-',
                'total_qty'    => (int)$oi->total_qty,
            ]);

        // Aktivitas bulanan (12 bulan terakhir)
        $monthlyActivity = (clone $completedOrders)
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as month, COUNT(*) as order_count, SUM(total) as total_spent')
            ->where('created_at', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $segment = $this->classifySegment($totalOrders, $recencyDays);

        return response()->json([
            'member'           => $member->only(['id', 'name', 'phone', 'total_points', 'lifetime_points', 'created_at']),
            'total_orders'     => $totalOrders,
            'total_spent'      => $totalSpent,
            'avg_order_value'  => $avgOrderValue,
            'first_order_at'   => $firstOrderAt,
            'last_order_at'    => $lastOrderAt,
            'recency_days'     => $recencyDays,
            'segment'          => $segment,
            'favorite_menus'   => $favoriteMenus,
            'monthly_activity' => $monthlyActivity,
        ]);
    }

    public function update(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
        ]);

        if (isset($validated['phone']) && $validated['phone'] !== $member->phone) {
            $existing = Member::where('store_id', $member->store_id)
                ->where('phone', $validated['phone'])
                ->where('id', '!=', $member->id)
                ->first();

            if ($existing) {
                return response()->json(['message' => 'Nomor telepon sudah terdaftar'], 409);
            }
        }

        $member->update($validated);

        return response()->json($member);
    }

    public function destroy(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);
        $member->delete();

        return response()->json(['message' => 'Member berhasil dihapus']);
    }

    /**
     * Kirim info poin + daftar reward ke WhatsApp member.
     * Dikirim async lewat queue job agar request tidak menunggu API WhatsApp;
     * status hasil kirim bisa dipoll lewat GET /members/{member}/wa-info-status.
     */
    public function sendPointsInfo(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $storeName = $request->user()->store->name ?? 'toko kami';

        $member->update([
            'wa_info_status' => 'queued',
            'wa_info_method' => null,
        ]);

        SendMemberPointsInfoJob::dispatch($member->id, $storeName);

        return response()->json(['message' => 'Info poin sedang dikirim ke WhatsApp member', 'status' => 'queued']);
    }

    /**
     * Status pengiriman WhatsApp info poin (dikirim async via queue job).
     * Dipoll frontend setelah tombol "Kirim Info Poin" ditekan.
     */
    public function waInfoStatus(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        return response()->json([
            'wa_info_status' => $member->wa_info_status,
            'wa_info_method' => $member->wa_info_method,
            'wa_info_sent_at' => $member->wa_info_sent_at,
        ]);
    }

    public function findByPhone(Request $request)
    {
        $storeId = $request->user()->store_id;

        $validated = $request->validate([
            'phone' => 'required|string',
        ]);

        $member = Member::where('store_id', $storeId)
            ->where('phone', $validated['phone'])
            ->first();

        if (!$member) {
            return response()->json(['message' => 'Member tidak ditemukan'], 404);
        }

        return response()->json($member);
    }

    public function transactions(Request $request, Member $member)
    {
        $this->authorizeStore($request, $member);

        $transactions = $member->pointTransactions()
            ->with('order')
            ->latest()
            ->paginate(20);

        return response()->json($transactions);
    }

    private function authorizeStore(Request $request, Member $member): void
    {
        if ($member->store_id !== $request->user()->store_id) {
            abort(403, 'Unauthorized');
        }
    }
}
