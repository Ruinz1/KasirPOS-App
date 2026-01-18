<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\CapitalController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\UserController;

// Public routes
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware(['auth:sanctum'])->group(function () {
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Inventory routes (all authenticated users can view, only admin/owner can modify)
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/{inventoryItem}', [InventoryController::class, 'show']);
    Route::get('/inventory/calculate/total-value', [InventoryController::class, 'calculateTotalValue']);
    Route::post('/inventory', [InventoryController::class, 'store']);
    Route::put('/inventory/{inventoryItem}', [InventoryController::class, 'update']);
    Route::delete('/inventory/{inventoryItem}', [InventoryController::class, 'destroy']);

    // Menu routes (all authenticated users can view, only admin/owner can modify)
    Route::get('/menu', [MenuController::class, 'index']);
    Route::get('/menu/{menuItem}', [MenuController::class, 'show']);
    Route::post('/menu', [MenuController::class, 'store']);
    Route::put('/menu/{menuItem}', [MenuController::class, 'update']);
    Route::delete('/menu/{menuItem}', [MenuController::class, 'destroy']);

    // Order routes (all authenticated users can create, kasir sees own, admin/owner sees all)
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::delete('/orders/{order}', [OrderController::class, 'destroy']);
    Route::get('/orders/report/sales', [OrderController::class, 'salesReport']);

    // Employee routes
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::get('/employees/{user}', [EmployeeController::class, 'show']);
    Route::put('/employees/{user}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{user}', [EmployeeController::class, 'destroy']);
    Route::get('/employees/{user}/salary', [EmployeeController::class, 'calculateSalary']);

    // Capital routes
    Route::get('/capital', [CapitalController::class, 'index']);
    Route::post('/capital', [CapitalController::class, 'store']);
    Route::get('/capital/{capitalRecord}', [CapitalController::class, 'show']);
    Route::put('/capital/{capitalRecord}', [CapitalController::class, 'update']);
    Route::delete('/capital/{capitalRecord}', [CapitalController::class, 'destroy']);
    Route::get('/capital/calculate/breakeven', [CapitalController::class, 'calculateBreakeven']);

    // Store routes
    Route::get('/store', [StoreController::class, 'show']);
    Route::post('/store', [StoreController::class, 'store']);
    Route::put('/store', [StoreController::class, 'update']);

    // Roles & Permissions routes (Admin Only)
    Route::middleware(['role:admin'])->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::put('/roles/{role}', [RoleController::class, 'update']);
    });

    // System User Management (Admin Only)
    Route::middleware(['role:admin'])->group(function () {
        Route::apiResource('users', UserController::class);
        
        // Store Management (Admin Only)
        Route::get('/stores-management', [App\Http\Controllers\Api\StoreManagementController::class, 'index']);
        Route::get('/stores-management/{id}', [App\Http\Controllers\Api\StoreManagementController::class, 'show']);
        Route::put('/stores-management/{id}', [App\Http\Controllers\Api\StoreManagementController::class, 'update']);
        Route::delete('/stores-management/{id}', [App\Http\Controllers\Api\StoreManagementController::class, 'destroy']);
        Route::get('/stores-management/available/owners', [App\Http\Controllers\Api\StoreManagementController::class, 'availableOwners']);
    });
});
