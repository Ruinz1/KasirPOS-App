<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PointReward;
use Illuminate\Http\Request;

class PointRewardController extends Controller
{
    public function index(Request $request)
    {
        $storeId = $request->user()->store_id;

        $rewards = PointReward::where('store_id', $storeId)
            ->with('menuItem')
            ->orderBy('points_required')
            ->get();

        return response()->json($rewards);
    }

    public function store(Request $request)
    {
        $storeId = $request->user()->store_id;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'points_required' => 'required|integer|min:1',
            'menu_item_id' => 'nullable|exists:menu_items,id',
            'is_active' => 'boolean',
        ]);

        $reward = PointReward::create([
            ...$validated,
            'store_id' => $storeId,
        ]);

        $reward->load('menuItem');

        return response()->json($reward, 201);
    }

    public function update(Request $request, PointReward $pointReward)
    {
        if ($pointReward->store_id !== $request->user()->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'points_required' => 'sometimes|integer|min:1',
            'menu_item_id' => 'nullable|exists:menu_items,id',
            'is_active' => 'boolean',
        ]);

        $pointReward->update($validated);
        $pointReward->load('menuItem');

        return response()->json($pointReward);
    }

    public function destroy(Request $request, PointReward $pointReward)
    {
        if ($pointReward->store_id !== $request->user()->store_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $pointReward->delete();

        return response()->json(['message' => 'Reward berhasil dihapus']);
    }
}
