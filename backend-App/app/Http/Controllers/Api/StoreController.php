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
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'delivery_base_fee' => 'nullable|integer|min:0',
            'delivery_fee_per_km' => 'nullable|integer|min:0',
            'delivery_max_km' => 'nullable|integer|min:0',
            'parking_fee_motor' => 'nullable|integer|min:0',
            'parking_fee_mobil' => 'nullable|integer|min:0',
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
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'delivery_base_fee' => $request->delivery_base_fee ?? 0,
            'delivery_fee_per_km' => $request->delivery_fee_per_km ?? 2000,
            'delivery_max_km' => $request->delivery_max_km,
            'parking_fee_motor' => $request->parking_fee_motor ?? 2000,
            'parking_fee_mobil' => $request->parking_fee_mobil ?? 3000,
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
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'delivery_base_fee' => 'nullable|integer|min:0',
            'delivery_fee_per_km' => 'nullable|integer|min:0',
            'delivery_max_km' => 'nullable|integer|min:0',
            'parking_fee_motor' => 'nullable|integer|min:0',
            'parking_fee_mobil' => 'nullable|integer|min:0',
            'queue_enabled' => 'nullable|boolean',
            'parking_checkout_enabled' => 'nullable|boolean',
        ]);

        $data = $request->only(
            'name', 'location',
            'latitude', 'longitude',
            'delivery_base_fee', 'delivery_fee_per_km', 'delivery_max_km',
            'parking_fee_motor', 'parking_fee_mobil'
        );

        if ($request->has('queue_enabled')) {
            $data['queue_enabled'] = $request->boolean('queue_enabled');
        }
        if ($request->has('parking_checkout_enabled')) {
            $data['parking_checkout_enabled'] = $request->boolean('parking_checkout_enabled');
        }

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

    /**
     * Hitung estimasi ongkir berdasarkan koordinat pelanggan.
     * POST /api/delivery/calculate
     * Body: { customer_lat, customer_lng }
     */
    public function calculateDeliveryFee(Request $request)
    {
        $validated = $request->validate([
            'customer_lat' => 'required|numeric|between:-90,90',
            'customer_lng' => 'required|numeric|between:-180,180',
        ]);

        $user = $request->user();
        if (!$user->store_id) {
            return response()->json(['message' => 'Toko belum dikonfigurasi'], 404);
        }

        $store = Store::findOrFail($user->store_id);

        if (!$store->latitude || !$store->longitude) {
            return response()->json([
                'message' => 'Koordinat toko belum diset. Silakan set di halaman Profil Toko.',
                'needs_store_location' => true,
            ], 422);
        }

        $distanceKm = $store->calculateDistance(
            (float)$validated['customer_lat'],
            (float)$validated['customer_lng']
        );

        // Cek batas jarak maksimum
        if ($store->delivery_max_km && $distanceKm > $store->delivery_max_km) {
            return response()->json([
                'message' => "Jarak {$distanceKm} km melebihi batas pengiriman ({$store->delivery_max_km} km)",
                'distance_km' => $distanceKm,
                'exceeds_max' => true,
            ], 422);
        }

        $fee = $store->calculateDeliveryFee($distanceKm);

        return response()->json([
            'distance_km' => $distanceKm,
            'delivery_fee' => $fee,
            'base_fee' => $store->delivery_base_fee ?? 0,
            'fee_per_km' => $store->delivery_fee_per_km ?? 2000,
            'store_lat' => $store->latitude,
            'store_lng' => $store->longitude,
            'exceeds_max' => false,
        ]);
    }
}
