<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KitchenCategory;
use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Kelola kategori dapur (Bakso, Nasi Goreng, Mie Goreng, dst) per toko.
 * Dipakai untuk mengelompokkan item di nota dapur & papan antrian.
 */
class KitchenCategoryController extends Controller
{
    /**
     * Toko yang sedang dikelola. Admin boleh menunjuk toko lain lewat ?store_id=.
     */
    private function resolveStoreId(Request $request): ?int
    {
        $user = $request->user();

        if ($user->role === 'admin' && $request->filled('store_id')) {
            return (int) $request->input('store_id');
        }

        return $user->store_id ? (int) $user->store_id : null;
    }

    public function index(Request $request)
    {
        $storeId = $this->resolveStoreId($request);

        if (!$storeId) {
            return response()->json([]);
        }

        $categories = KitchenCategory::withoutGlobalScope('store')
            ->where('store_id', $storeId)
            ->withCount('menuItems')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $storeId = $this->resolveStoreId($request);

        if (!$storeId) {
            return response()->json(['message' => 'Toko belum dikonfigurasi'], 422);
        }

        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:50',
                // Nama unik per toko supaya tidak ada dua "Bakso" yang membingungkan.
                Rule::unique('kitchen_categories', 'name')->where(fn ($q) => $q->where('store_id', $storeId)),
            ],
            'color' => ['nullable', Rule::in(KitchenCategory::COLORS)],
            'sort_order' => 'nullable|integer|min:0',
        ], [
            'name.unique' => 'Kategori dapur dengan nama itu sudah ada.',
        ]);

        // Kategori baru diletakkan di urutan terakhir bila urutan tidak ditentukan.
        $sortOrder = $validated['sort_order']
            ?? (int) KitchenCategory::withoutGlobalScope('store')
                ->where('store_id', $storeId)
                ->max('sort_order') + 1;

        $category = KitchenCategory::create([
            'store_id' => $storeId,
            'name' => $validated['name'],
            'color' => $validated['color'] ?? 'orange',
            'sort_order' => $sortOrder,
        ]);

        return response()->json($category->loadCount('menuItems'), 201);
    }

    public function update(Request $request, $id)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $category = KitchenCategory::withoutGlobalScope('store')->findOrFail($id);

        if (!$this->canManage($request, $category)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => [
                'sometimes', 'string', 'max:50',
                Rule::unique('kitchen_categories', 'name')
                    ->where(fn ($q) => $q->where('store_id', $category->store_id))
                    ->ignore($category->id),
            ],
            'color' => ['nullable', Rule::in(KitchenCategory::COLORS)],
            'sort_order' => 'nullable|integer|min:0',
        ], [
            'name.unique' => 'Kategori dapur dengan nama itu sudah ada.',
        ]);

        $category->update(array_filter(
            $validated,
            fn ($value) => $value !== null
        ));

        return response()->json($category->loadCount('menuItems'));
    }

    public function destroy(Request $request, $id)
    {
        if (!$request->user()->hasPermission('manage_menu')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $category = KitchenCategory::withoutGlobalScope('store')->findOrFail($id);

        if (!$this->canManage($request, $category)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Menu yang memakai kategori ini tidak dihapus — hanya dilepas pengelompokannya
        // (kolomnya nullOnDelete), supaya menghapus kategori tidak pernah menghilangkan menu.
        $affected = MenuItem::withoutGlobalScope('store')
            ->where('kitchen_category_id', $category->id)
            ->count();

        $category->delete();

        return response()->json([
            'message' => 'Kategori dapur dihapus',
            'menu_items_uncategorized' => $affected,
        ]);
    }

    /**
     * Kategori hanya boleh diubah oleh admin atau orang dari toko yang sama.
     */
    private function canManage(Request $request, KitchenCategory $category): bool
    {
        $user = $request->user();

        return $user->role === 'admin' || (int) $user->store_id === (int) $category->store_id;
    }
}
