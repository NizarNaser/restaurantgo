<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Define a basic set of permissions for the SaaS platform
        $permissions = [
            'manage tenants',
            'manage users',
            'manage plans',
            'manage coupons',
            'manage menus',
            'manage orders',
            'view reports',
            // Halls & Tables (dine-in POS)
            'manage tables',
            'manage halls',
            'transfer tables',
            // Warehouse: ingredients, semi-finished goods, recipes, stock ledger
            'manage inventory',
            // Order/invoice deletion — split so only the owner can delete a
            // paid invoice, while a manager can still cancel an unpaid one.
            'delete orders',
            'delete invoices',
            // Open/close a work shift
            'manage shifts',
            // Customer loyalty/discount cards
            'manage discount cards',
            // Live kitchen/bar order screens
            'use kitchen display',
            // Platform (company-side) permissions — held by super admin / internal staff accounts.
            'manage staff',
            'manage payments',
            'manage advertisements',
            'manage contact messages',
            'view audit logs',
            // The platform's own marketing site (the `web` app itself) —
            // distinct from any one tenant's SEO, which each restaurant
            // owner manages themselves.
            'manage platform settings',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm]);
        }

        // Owner role – all tenant-side permissions
        $owner = Role::firstOrCreate(['name' => 'owner']);
        $owner->syncPermissions([
            'manage tenants', 'manage users', 'manage plans', 'manage menus', 'manage orders', 'view reports',
            'manage tables', 'manage halls', 'transfer tables', 'manage inventory',
            'delete orders', 'delete invoices', 'manage shifts', 'manage discount cards', 'use kitchen display',
        ]);

        // Manager role – limited permissions, but still full floor/staff control
        $manager = Role::firstOrCreate(['name' => 'manager']);
        $manager->syncPermissions([
            'manage menus',
            'manage orders',
            'view reports',
            'manage users', 'manage tables', 'manage halls', 'transfer tables', 'manage inventory',
            'delete orders', 'manage shifts', 'manage discount cards', 'use kitchen display',
        ]);

        // Staff role – customer-facing floor staff take and progress orders,
        // nothing else administrative.
        $staff = Role::firstOrCreate(['name' => 'staff']);
        $staff->syncPermissions(['manage orders', 'use kitchen display']);

        // Waiter / bartender – can open/manage dine-in tables, nothing else.
        $waiter = Role::firstOrCreate(['name' => 'waiter']);
        $waiter->syncPermissions(['manage tables', 'use kitchen display']);

        $bartender = Role::firstOrCreate(['name' => 'bartender']);
        $bartender->syncPermissions(['manage tables', 'use kitchen display']);

        // Kitchen display – a dedicated kiosk login for a screen mounted in
        // the kitchen/bar: only ever sees the KDS screen, never the admin
        // dashboard (see DashboardLayout's redirect for this role).
        $kitchenDisplay = Role::firstOrCreate(['name' => 'kitchen_display']);
        $kitchenDisplay->syncPermissions(['use kitchen display']);

        // Super admin – full access to the company admin panel across all tenants.
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin']);
        $superAdmin->syncPermissions(Permission::all());

        // Finance – company-side billing/payroll visibility, no tenant suspension power.
        $financeManager = Role::firstOrCreate(['name' => 'finance_manager']);
        $financeManager->syncPermissions(['manage payments', 'manage staff', 'view reports']);

        // Support – read access to tenants and the contact inbox, nothing destructive.
        $supportAgent = Role::firstOrCreate(['name' => 'support_agent']);
        $supportAgent->syncPermissions(['manage contact messages', 'view reports']);
    }
}
