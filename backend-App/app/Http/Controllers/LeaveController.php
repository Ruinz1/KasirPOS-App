<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Leave;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\LeavesExport;

class LeaveController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Leave::with(['user', 'approver']);

        // If owner or admin, can see all (in their store)
        // If employee, can only see their own
        if ($user->canEdit()) { 
             if ($user->store_id) {
                 $query->where('store_id', $user->store_id);
             }
        } else {
             $query->where('user_id', $user->id);
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string',
        ]);

        $user = $request->user();
        
        $status = 'pending';
        $approved_by = null;
        
        // If owner requests, auto-approve
        if ($user->isOwner()) {
            $status = 'approved';
            $approved_by = $user->id;
        }

        $leave = Leave::create([
            'user_id' => $user->id,
            'store_id' => $user->store_id,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'reason' => $request->reason,
            'status' => $status,
            'approved_by' => $approved_by,
        ]);

        return response()->json($leave, 201);
    }

    public function update(Request $request, $id)
    {
        $leave = Leave::findOrFail($id);
        $user = $request->user();

        // Only owner/admin can approve/reject
        if (!$user->canEdit()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'status' => 'required|in:approved,rejected',
            'rejection_reason' => 'nullable|required_if:status,rejected|string',
        ]);

        $leave->update([
            'status' => $request->status,
            'approved_by' => $user->id,
            'rejection_reason' => $request->rejection_reason,
        ]);

        return response()->json($leave);
    }

    public function destroy(Request $request, $id)
    {
        $leave = Leave::findOrFail($id);
        $user = $request->user();

        if ($user->id !== $leave->user_id && !$user->canEdit()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($leave->status !== 'pending' && !$user->canEdit()) {
             return response()->json(['message' => 'Cannot delete processed request'], 400);
        }

        $leave->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }

    public function batchStore(Request $request)
    {
        $user = $request->user();
        if (!$user->canEdit()) { // Only admin/owner can batch create
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'leaves' => 'required|array',
            'leaves.*.user_id' => 'required|exists:users,id',
            'leaves.*.start_date' => 'required|date',
            'leaves.*.end_date' => 'required|date|after_or_equal:leaves.*.start_date',
            'leaves.*.reason' => 'nullable|string',
        ]);

        $createdCount = 0;
        
        foreach ($request->leaves as $leaveData) {
            // Check for potential duplicates?
            // For now, trust the input or simple check
            $exists = Leave::where('user_id', $leaveData['user_id'])
                ->where('start_date', $leaveData['start_date'])
                ->exists();
                
            if ($exists) continue; // Skip duplicates
            
            Leave::create([
                'user_id' => $leaveData['user_id'],
                'store_id' => $user->store_id, // Assign to current store
                'start_date' => $leaveData['start_date'],
                'end_date' => $leaveData['end_date'],
                'reason' => $leaveData['reason'] ?? 'Jadwal Rutin',
                'status' => 'approved', // Auto-approved since owner/admin created it
                'approved_by' => $user->id,
            ]);
            $createdCount++;
        }

        return response()->json(['message' => "$createdCount cuti berhasil dibuat."], 201);
    }

    public function export(Request $request)
    {
        $user = $request->user();
         if (!$user->canEdit()) {
             return response()->json(['message' => 'Unauthorized'], 403);
         }
         
        $query = Leave::with(['user', 'approver']);
        if ($user->store_id) {
             $query->where('store_id', $user->store_id);
        }
        
        $data = $query->latest()->get();

        return Excel::download(new LeavesExport($data), 'leaves-' . now()->format('Y-m-d') . '.xlsx');
    }
}
