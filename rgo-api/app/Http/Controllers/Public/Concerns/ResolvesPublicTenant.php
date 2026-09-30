<?php

namespace App\Http\Controllers\Public\Concerns;

use App\Models\Tenant;

trait ResolvesPublicTenant
{
    /**
     * Public pages are addressed by the tenant's slug or subdomain; only
     * active tenants are ever served.
     */
    protected function resolvePublicTenant(string $slug): Tenant
    {
        return Tenant::where(function ($q) use ($slug) {
                // A white-labelled tenant's own domain works as a drop-in
                // replacement for {slug} here — the frontend, when loaded
                // under a tenant's connected custom domain, passes that
                // hostname through as the :slug route parameter unchanged.
                $q->where('slug', $slug)->orWhere('subdomain', $slug)->orWhere('custom_domain', $slug);
            })
            ->where('status', 'active')
            ->firstOrFail();
    }

    /**
     * Locale requested via ?lang=, falling back to the tenant default.
     * Only ever returns a locale the tenant actually enabled — a customer
     * can't force a language the restaurant never configured/translated.
     */
    protected function resolvePublicLocale(Tenant $tenant): string
    {
        $requested = request()->query('lang');
        $supported = $tenant->supported_locales ?? [];

        if (is_string($requested) && preg_match('/^[a-zA-Z]{2}([_-][a-zA-Z]{2})?$/', $requested) && in_array($requested, $supported, true)) {
            return $requested;
        }

        return $tenant->default_locale ?? config('app.locale');
    }
}
