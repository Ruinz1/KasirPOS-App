<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class EmployeeController extends Controller
{
    /**
     * Display a listing of employees
     */
    public function index(Request $request)
    {
        if (!$request->user()->hasPermission('manage_employees') && !$request->user()->hasPermission('view_reports')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = User::with('store')->orderBy('created_at', 'desc');

        // Admin can filter by store_id
        if ($request->has('store_id') && $request->user()->role === 'admin') {
            $query->where('store_id', $request->store_id);
        }

        // Filter by role if provided (e.g. ?role=karyawan)
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        // Filter by position (e.g. ?position=Kasir)
        if ($request->has('position')) {
            $query->whereJsonContains('positions', $request->position);
        }

        $employees = $query->get();

        // Add calculated salary
        $employees->each(function ($employee) {
            $employee->monthly_salary = $employee->calculateMonthlySalary();
        });

        return response()->json($employees);
    }

    /**
     * Store a newly created employee
     */
    public function store(Request $request)
    {
        if (!$request->user()->hasPermission('manage_employees')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,owner,karyawan',
            'positions' => 'nullable|array',
            'positions.*' => 'string|max:255',
            'salary_type' => 'required|in:auto,manual',
            'base_salary' => 'required_if:salary_type,manual|nullable|numeric|min:0',
            'bonus' => 'nullable|numeric|min:0',
            'store_id' => 'nullable|exists:stores,id',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['bonus'] = $validated['bonus'] ?? 0;
        
        // If admin didn't provide store_id, use current user's store_id
        if (!isset($validated['store_id']) && $request->user()->store_id) {
            $validated['store_id'] = $request->user()->store_id;
        }

        $employee = User::create($validated);

        return response()->json($employee->load('store'), 201);
    }

    /**
     * Display the specified employee
     */
    public function show(Request $request, User $user)
    {
        if (!$request->user()->hasPermission('manage_employees')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user->monthly_salary = $user->calculateMonthlySalary();
        
        return response()->json($user);
    }

    /**
     * Update the specified employee
     */
    public function update(Request $request, User $user)
    {
        if (!$request->user()->hasPermission('manage_employees')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:8',
            'role' => 'sometimes|in:admin,owner,karyawan',
            'positions' => 'nullable|array',
            'positions.*' => 'string|max:255',
            'salary_type' => 'sometimes|in:auto,manual',
            'base_salary' => 'nullable|numeric|min:0',
            'bonus' => 'nullable|numeric|min:0',
            'store_id' => 'nullable|exists:stores,id',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json($user->load('store'));
    }

    /**
     * Remove the specified employee
     */
    public function destroy(Request $request, User $user)
    {
        if (!$request->user()->hasPermission('manage_employees')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Prevent deleting yourself
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete yourself'], 400);
        }

        $user->delete();

        return response()->json(['message' => 'Employee deleted successfully']);
    }

    /**
     * Calculate salary for an employee
     */
    public function calculateSalary(Request $request, User $user)
    {
        if (!$request->user()->hasPermission('manage_employees')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $month = $request->input('month', now()->month);
        $year = $request->input('year', now()->year);

        $salary = $user->calculateMonthlySalary($month, $year);

        return response()->json([
            'employee' => $user->name,
            'month' => $month,
            'year' => $year,
            'salary_type' => $user->salary_type,
            'base_salary' => $user->salary_type === 'manual' ? $user->base_salary : null,
            'auto_calculation' => $user->salary_type === 'auto' ? (cal_days_in_month(CAL_GREGORIAN, $month, $year) * 50000) : null,
            'bonus' => $user->bonus,
            'total_salary' => $salary,
        ]);
    }
}
