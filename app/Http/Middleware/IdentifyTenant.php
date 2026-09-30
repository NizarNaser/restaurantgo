<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdentifyTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $this->resolveTenant($request);

        if (! $tenant) {
            return response()->json(['message' => 'Tenant not found.'], 404);
        }

        if ($tenant->status === 'suspended') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        // Bind tenant to the app container for the lifetime of the request
        app()->instance('tenant', $tenant);
        app()->bind(Tenant::class, fn() => $tenant);

        // Set locale from tenant default — extract first tag from Accept-Language (e.g. "en_US,en;q=0.9" → "en")
        $rawLocale = $request->header('Accept-Language', $tenant->default_locale ?? 'en');
        $locale = substr(preg_replace('/[^a-zA-Z_-].*/', '', explode(',', $rawLocale)[0]), 0, 5);
        app()->setLocale($locale ?: ($tenant->default_locale ?? 'en'));

        return $next($request);
    }

    private function resolveTenant(Request $request): ?Tenant
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain', 'restaurantgo.com');

        // 3. API requests with tenant header (for dashboard) — check first for local dev
        if ($tenantId = $request->header('X-Tenant-Id')) {
            return Tenant::find($tenantId);
        }

        // 4. Authenticated user's tenant — works for localhost dev
        if ($request->user()?->tenant_id) {
            return Tenant::find($request->user()->tenant_id);
        }

        // 1. Custom domain (e.g., menu.myrestaurant.com)
        if (! str_ends_with($host, $baseDomain)) {
            return Tenant::where('custom_domain', $host)->first();
        }

        // 2. Subdomain (e.g., myrestaurant.restaurantgo.com)
        $subdomain = str_replace('.' . $baseDomain, '', $host);
        if ($subdomain && $subdomain !== $baseDomain) {
            return Tenant::where('subdomain', $subdomain)->first();
        }

        return null;
    }
}
