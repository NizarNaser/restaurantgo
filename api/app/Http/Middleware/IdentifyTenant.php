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

        // Accept-Language wins when present — extract its first tag (e.g.
        // "en_US,en;q=0.9" → "en"); the tenant's default_locale is only the
        // fallback when no header was sent at all. The dashboard explicitly
        // sends this header set to the admin's chosen UI language (see
        // dashboard/src/api/axios.ts), so it reflects a deliberate choice,
        // not just whatever the browser's own language happens to be.
        $rawLocale = $request->header('Accept-Language', $tenant->default_locale ?? 'en');
        $locale = substr(preg_replace('/[^a-zA-Z_-].*/', '', explode(',', $rawLocale)[0]), 0, 5);
        app()->setLocale($locale ?: ($tenant->default_locale ?? 'en'));

        return $next($request);
    }

    /**
     * Every route using this middleware is also behind `auth:sanctum` (see
     * routes/api.php), so an authenticated user's own `tenant_id` is always
     * the right — and only trustworthy — source of truth here. There used
     * to be an `X-Tenant-Id` header path "for local dev", checked *before*
     * this one and with no verification it matched the caller's own tenant:
     * since no frontend ever actually sent that header, it was dead for
     * every legitimate caller while staying fully live for an attacker —
     * any authenticated account, of any role, could read or write another
     * tenant's data (reservations, financials, payroll, settings) just by
     * sending a different tenant's ID in that header. Removed outright
     * rather than "fixed to match the user" — there's no legitimate case
     * where an authenticated request needs a tenant other than its own.
     */
    private function resolveTenant(Request $request): ?Tenant
    {
        $host = $request->getHost();
        $baseDomain = config('app.base_domain', 'restaurantgo.com');

        if ($request->user()?->tenant_id) {
            return Tenant::find($request->user()->tenant_id);
        }

        // Custom domain (e.g., menu.myrestaurant.com)
        if (! str_ends_with($host, $baseDomain)) {
            return Tenant::where('custom_domain', $host)->first();
        }

        // Subdomain (e.g., myrestaurant.restaurantgo.com)
        $subdomain = str_replace('.' . $baseDomain, '', $host);
        if ($subdomain && $subdomain !== $baseDomain) {
            return Tenant::where('subdomain', $subdomain)->first();
        }

        return null;
    }
}
