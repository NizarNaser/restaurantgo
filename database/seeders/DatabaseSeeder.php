<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PlansSeeder::class,
            RolesPermissionsSeeder::class,
            DemoTenantSeeder::class,
            DemoRestaurantsSeeder::class,
            DemoOrdersSeeder::class,
            AdvertisementsSeeder::class,
            PlatformStaffSeeder::class,
        ]);
    }
}

// ─────────────────────────────────────────────────────────────────────────────

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlansSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name'                => 'Free',
                'slug'                => 'free',
                'description'         => 'Try RestaurantGo at no cost, with limited menu size and a single branch.',
                'price_monthly'       => 0.00,
                'price_yearly'        => 0.00,
                'max_branches'        => 1,
                'max_menu_items'      => 20,
                'max_users'           => 1,
                'has_custom_domain'   => false,
                'has_white_label'     => false,
                'has_advanced_reports'=> false,
                'has_api_access'      => false,
                'sort_order'          => 0,
            ],
            [
                'name'                => 'Starter',
                'slug'                => 'starter',
                'description'         => 'Perfect for small restaurants getting started.',
                'price_monthly'       => 19.00,
                'price_yearly'        => 190.00,
                'max_branches'        => 1,
                'max_menu_items'      => 50,
                'max_users'           => 3,
                'has_custom_domain'   => false,
                'has_white_label'     => false,
                'has_advanced_reports'=> false,
                'has_api_access'      => false,
                'sort_order'          => 1,
            ],
            [
                'name'                => 'Pro',
                'slug'                => 'pro',
                'description'         => 'For growing restaurants that need more power.',
                'price_monthly'       => 49.00,
                'price_yearly'        => 490.00,
                'max_branches'        => 5,
                'max_menu_items'      => 500,
                'max_users'           => 15,
                'has_custom_domain'   => true,
                'has_white_label'     => false,
                'has_advanced_reports'=> true,
                'has_api_access'      => false,
                'sort_order'          => 2,
            ],
            [
                'name'                => 'Enterprise',
                'slug'                => 'enterprise',
                'description'         => 'Unlimited scale with white-label and full API access.',
                'price_monthly'       => 149.00,
                'price_yearly'        => 1490.00,
                'max_branches'        => null,
                'max_menu_items'      => null,
                'max_users'           => null,
                'has_custom_domain'   => true,
                'has_white_label'     => true,
                'has_advanced_reports'=> true,
                'has_api_access'      => true,
                'sort_order'          => 3,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
