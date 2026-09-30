<?php

namespace Database\Seeders;

use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PlatformStaffSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate([
            'email' => 'admin@restaurantgo.com',
        ], [
            'tenant_id' => null,
            'name'      => 'Platform Admin',
            'password'  => Hash::make('password'),
            'is_active' => true,
        ]);

        if (! $user->hasRole('super_admin')) {
            $user->assignRole('super_admin');
        }

        Staff::firstOrCreate([
            'user_id' => $user->id,
        ], [
            'name'       => 'Platform Admin',
            'email'      => 'admin@restaurantgo.com',
            'position'   => 'Platform Administrator',
            'department' => 'Operations',
            'base_salary'=> 0,
            'currency'   => 'USD',
            'hire_date'  => now(),
            'status'     => 'active',
        ]);
    }
}
