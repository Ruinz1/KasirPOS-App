<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use App\Models\Order;
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

        $members = $query->get()->map(function ($member) {
            $member->frequency = (int) $member->frequency;
            $member->monetary = (float) $member->monetary;
            $member->recency_days = $member->last_order_at
                ? (int) now()->diffInDays($member->last_order_at, true)
                : null;
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
