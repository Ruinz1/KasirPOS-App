<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\RolePermission;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Define default permissions for roles
        $permissions = [
            'admin' => [
                'view_dashboard',
                'manage_orders',
                'manage_inventory',
                'view_inventory',
                'manage_menu',
                'view_menu',
                'view_reports',
                'manage_employees',
                'manage_capital' // Admin can assume full operational control
            ],
            'karyawan' => [
                'view_dashboard', // Minimal dashboard view
                'manage_orders',  // CRITICAL for POS
                'view_menu',      // CRITICAL for POS list
                'view_inventory', // Useful for checking stock availability
                'view_reports'    // Kasir can view their own reports
            ]
        ];

        // Clear existing permissions to avoid duplicates
        DB::table('role_permissions')->truncate();

        foreach ($permissions as $role => $rolePermissions) {
            foreach ($rolePermissions as $permission) {
                RolePermission::create([
                    'role' => $role,
                    'permission' => $permission
                ]);
            }
        }
    }
}
