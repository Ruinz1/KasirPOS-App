<?php

use Illuminate\Support\Facades\Route;
use App\Models\User;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/test-employees', function () {
    // Simulate owner user
    $owner = User::where('role', 'owner')->first();
    
    if (!$owner) {
        return response()->json(['error' => 'No owner found']);
    }
    
    // Query as owner would
    $employees = User::where('store_id', $owner->store_id)
                     ->where('role', 'karyawan')
                     ->get(['id', 'name', 'role', 'store_id']);
    
    return response()->json([
        'owner' => [
            'id' => $owner->id,
            'name' => $owner->name,
            'store_id' => $owner->store_id,
        ],
        'employees' => $employees,
        'count' => $employees->count(),
    ]);
});
