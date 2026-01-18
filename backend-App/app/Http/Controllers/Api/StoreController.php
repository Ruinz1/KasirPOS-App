<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Store;

use Illuminate\Support\Facades\Storage;

class StoreController extends Controller
{
    /**
     * Get the current user's store details
     */
    public function show(Request $request) {
        $user = $request->user();
        if ($user->store_id) {
            return Store::withCount('users')->with('owner')->findOrFail($user->store_id);
        }
        return response()->json(['message' => 'No store associated'], 404);
    }

    /**
     * Create a new store (and set current user as owner)
     */
    public function store(Request $request) {
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'image' => 'nullable|image|max:2048', // 2MB Max
        ]);

        $user = $request->user();
        
        if ($user->ownedStore()->exists()) {
             return response()->json(['message' => 'User already owns a store'], 400);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('stores', 'public');
        }

        $store = Store::create([
            'name' => $request->name,
            'location' => $request->location,
            'owner_id' => $user->id,
            'image' => $imagePath,
        ]);

        $user->store_id = $store->id;
        $user->save();

        return response()->json($store, 201);
    }
    
    /**
     * Update store details
     */
    public function update(Request $request) {
        $user = $request->user();
         if (!$user->store_id) {
            return response()->json(['message' => 'No store found'], 404);
        }
        
        if (!$user->hasPermission('manage_capital') && !$user->isOwner()) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $store = Store::findOrFail($user->store_id);
        
        $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'image' => 'nullable|image|max:2048',
        ]);
        
        $data = $request->only('name', 'location');

        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($store->image) {
                Storage::disk('public')->delete($store->image);
            }
            $data['image'] = $request->file('image')->store('stores', 'public');
        }
        
        $store->update($data);
        
        return response()->json($store);
    }
}
