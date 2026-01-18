<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RolePermission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    // Define available roles and permissions
    private $roles = ['owner', 'admin', 'kasir'];
    
    private $permissions = [
        [
            'key' => 'view_dashboard',
            'label' => 'Lihat Dashboard',
            'group' => 'Dashboard'
        ],
        [
            'key' => 'manage_inventory',
            'label' => 'Kelola Inventori (Stok & Alat)',
            'group' => 'Inventori'
        ],
        [
            'key' => 'view_inventory',
            'label' => 'Lihat Inventori',
            'group' => 'Inventori'
        ],
        [
            'key' => 'manage_menu',
            'label' => 'Kelola Menu',
            'group' => 'Menu'
        ],
        [
            'key' => 'manage_orders',
            'label' => 'Akses POS (Buat Transaksi)',
            'group' => 'Transaksi'
        ],
        [
            'key' => 'view_reports',
            'label' => 'Lihat Laporan',
            'group' => 'Laporan'
        ],
        [
            'key' => 'manage_employees',
            'label' => 'Kelola Karyawan & Gaji',
            'group' => 'Karyawan'
        ],
        [
            'key' => 'manage_capital',
            'label' => 'Kelola Modal & Analisis',
            'group' => 'Keuangan'
        ],
        [
            'key' => 'delete_transactions',
            'label' => 'Hapus Data Transaksi',
            'group' => 'Bahaya'
        ],
    ];

    /**
     * Get all roles with their current permissions
     */
    public function index(Request $request)
    {
        if (!$request->user()->canEdit()) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get all active permissions from DB
        $rolePermissions = RolePermission::all()->groupBy('role');

        $result = [];
        foreach ($this->roles as $role) {
            $activePermissions = isset($rolePermissions[$role]) 
                ? $rolePermissions[$role]->pluck('permission')->toArray() 
                : [];

            // If owner, by default give all if DB is empty or ensure they have all
            // Ideally owner always has all. But let's allow config for flexibility, 
            // except maybe 'manage_roles' which is implicit for owner.
            
            $result[] = [
                'name' => $role,
                'permissions' => $activePermissions
            ];
        }

        return response()->json([
            'roles' => $result,
            'available_permissions' => $this->permissions
        ]);
    }

    /**
     * Update permissions for a specific role
     */
    public function update(Request $request, string $role)
    {
        if (!$request->user()->canEdit()) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!in_array($role, $this->roles)) {
            return response()->json(['message' => 'Invalid role'], 400);
        }

        $formattedPermissions = $request->validate([
            'permissions' => 'present|array',
            'permissions.*' => 'string'
        ]);

        DB::transaction(function () use ($role, $formattedPermissions) {
            // Remove all existing permissions for this role
            RolePermission::where('role', $role)->delete();

            // Add new permissions
            $toInsert = [];
            foreach ($formattedPermissions['permissions'] as $permission) {
                // Verify permission exists in our defined list
                $validPermission = false;
                foreach ($this->permissions as $p) {
                    if ($p['key'] === $permission) {
                        $validPermission = true;
                        break;
                    }
                }

                if ($validPermission) {
                    $toInsert[] = [
                        'role' => $role,
                        'permission' => $permission,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }

            if (!empty($toInsert)) {
                RolePermission::insert($toInsert);
            }
        });

        return response()->json(['message' => 'Permissions updated successfully']);
    }
}
