<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Services\SeoService;

class DashboardController extends Controller
{
    public function stats()
    {
        $tenant = app('tenant');

        $menuItemsCount = MenuItem::where('tenant_id', $tenant->id)->count();
        $categoriesCount = MenuCategory::where('tenant_id', $tenant->id)->count();
        $activeEmployeesCount = Employee::where('tenant_id', $tenant->id)->where('status', 'active')->count();
        $totalEmployeesCount = Employee::where('tenant_id', $tenant->id)->count();

        $totalMonthlySalary = Employee::where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->sum('base_salary');

        return response()->json([
            'tenant_slug'         => $tenant->slug,
            'tenant_name'         => $tenant->name,
            // Custom domain > subdomain > "/p/{slug}" fallback — see
            // SeoService::tenantBaseUrl() for the precedence.
            'public_url'          => app(SeoService::class)->tenantBaseUrl($tenant),
            'menu_items_count'    => $menuItemsCount,
            'categories_count'    => $categoriesCount,
            'active_employees'    => $activeEmployeesCount,
            'total_employees'     => $totalEmployeesCount,
            'monthly_salary_cost' => (float) $totalMonthlySalary,
        ]);
    }
}
