<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Riwayat audit log. Hanya admin (semua toko) dan owner (toko sendiri).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!in_array($user->role, ['admin', 'owner'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = AuditLog::query()->orderByDesc('created_at');

        if ($user->role === 'owner') {
            $query->where('store_id', $user->store_id);
        } elseif ($request->filled('store_id')) {
            $query->where('store_id', $request->store_id);
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->entity_type);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('user_name', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->input('per_page', 30)));
    }

    /**
     * Daftar aksi unik untuk dropdown filter di frontend.
     */
    public function actions(Request $request)
    {
        $user = $request->user();

        if (!in_array($user->role, ['admin', 'owner'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = AuditLog::query()->select('action')->distinct()->orderBy('action');

        if ($user->role === 'owner') {
            $query->where('store_id', $user->store_id);
        }

        return response()->json($query->pluck('action'));
    }
}
