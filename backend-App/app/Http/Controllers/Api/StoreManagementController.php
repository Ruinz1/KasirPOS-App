<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;

class StoreManagementController extends Controller
{
    /**
     * Display a listing of all stores (Admin only).
     */
    public function index(Request $request)
    {
        $query = Store::with('owner')->withCount('users');

        if ($request->search) {
            $query->where('name', 'like', "%{$request->search}%")
                  ->orWhere('location', 'like', "%{$request->search}%");
        }

        return $query->latest()->paginate(15);
    }

    /**
     * Display the specified store.
     */
    public function show($id)
    {
        return Store::with('owner')->withCount('users')->findOrFail($id);
    }

    /**
     * Update the specified store.
     */
    public function update(Request $request, $id)
    {
        $store = Store::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'location' => 'nullable|string|max:500',
        ]);

        $store->update($validated);

        return response()->json($store->load('owner')->loadCount('users'));
    }

    /**
     * Remove the specified store from storage.
     */
    public function destroy($id)
    {
        $store = Store::findOrFail($id);
        
        // Prevent deletion if store has users
        if ($store->users()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete store with active users. Please reassign users first.'
            ], 400);
        }

        $store->delete();

        return response()->json(['message' => 'Store deleted successfully']);
    }

    /**
     * Get all owners without stores (for assignment).
     */
    public function availableOwners()
    {
        return User::where('role', 'owner')
                   ->whereNull('store_id')
                   ->get(['id', 'name', 'email']);
    }
}
