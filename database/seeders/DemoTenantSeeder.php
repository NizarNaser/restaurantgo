<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\Review;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Plan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoTenantSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ensure we have a starter plan
        $plan = Plan::where('slug', 'starter')->first();
        if (! $plan) {
            $plan = Plan::create([
                'name' => 'Starter',
                'slug' => 'starter',
                'price_monthly' => 19.00,
                'price_yearly' => 190.00,
                'currency' => 'USD',
                'is_active' => true,
                'sort_order' => 1,
            ]);
        }

        // Create a demo tenant
        $tenant = Tenant::firstOrCreate([
            'slug' => 'demo-restaurant',
        ], [
            'name' => 'Demo Restaurant',
            'plan_id' => $plan->id,
            'subdomain' => 'demo',
            'status' => 'active',
            'trial_ends_at' => now()->addDays(30),
        ]);

        // Create an admin user for the tenant
        $user = User::firstOrCreate([
            'email' => 'owner@demo.com',
        ], [
            'name' => 'Demo Owner',
            'tenant_id' => $tenant->id,
            'password' => Hash::make('password'),
            'is_active' => true,
        ]);

        // Assign owner role (assuming role exists via RolesPermissionsSeeder)
        $user->assignRole('owner');

        // A branch so the public page has somewhere to source its contact block from.
        $branch = Branch::firstOrCreate([
            'tenant_id' => $tenant->id,
            'name'      => 'Main Branch',
        ], [
            'address'       => '123 Culinary Ave',
            'city'          => 'Beirut',
            'country'       => 'LB',
            'phone'         => '+961 1 234 567',
            'working_hours' => [
                'mon' => '10:00-23:00', 'tue' => '10:00-23:00', 'wed' => '10:00-23:00',
                'thu' => '10:00-23:00', 'fri' => '10:00-00:00', 'sat' => '10:00-00:00', 'sun' => '12:00-22:00',
            ],
            'is_active' => true,
        ]);

        // Feature the first couple of items and seed a few reviews so the
        // public page's trending section and ratings aren't empty on first look.
        $items = MenuItem::where('tenant_id', $tenant->id)->orderBy('id')->get();

        $items->take(2)->each(fn(MenuItem $item) => $item->update(['is_featured' => true]));

        if ($items->isNotEmpty() && Review::where('tenant_id', $tenant->id)->doesntExist()) {
            $firstItem = $items->first();

            Review::create([
                'tenant_id' => $tenant->id, 'menu_item_id' => $firstItem->id,
                'customer_name' => 'Layla H.', 'rating' => 5,
                'comment' => 'Absolutely delicious, will order again!', 'is_approved' => true,
            ]);
            Review::create([
                'tenant_id' => $tenant->id, 'menu_item_id' => $firstItem->id,
                'customer_name' => 'Omar T.', 'rating' => 4,
                'comment' => 'Great flavor, portion could be a bit bigger.', 'is_approved' => true,
            ]);
            Review::create([
                'tenant_id' => $tenant->id, 'menu_item_id' => null, 'branch_id' => $branch->id,
                'customer_name' => 'Sara K.', 'rating' => 5,
                'comment' => 'Friendly staff and fast service every time.', 'is_approved' => true,
            ]);
        }
    }
}
