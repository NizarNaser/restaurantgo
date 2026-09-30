<?php

namespace App\Services;

use App\Models\Tenant;
use App\Notifications\TenantSuspended;
use Illuminate\Support\Str;

class TenantService
{
    public function create(array $data): Tenant
    {
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

        return Tenant::create($data);
    }

    public function suspend(Tenant $tenant, ?string $reason = null): void
    {
        $tenant->update(['status' => 'suspended']);

        $tenant->users()->role('owner')->get()
            ->each->notify(new TenantSuspended($tenant, $reason));
    }

    public function activate(Tenant $tenant): void
    {
        $tenant->update(['status' => 'active']);
    }

    public function setCustomDomain(Tenant $tenant, string $domain): void
    {
        // Verify domain ownership (DNS TXT record check)
        if (! $this->verifyDomainOwnership($domain, $tenant->subdomain)) {
            abort(422, 'Domain ownership could not be verified. Please add the required DNS TXT record.');
        }

        // Ensure no other tenant claims this domain
        abort_if(
            Tenant::where('custom_domain', $domain)->where('id', '!=', $tenant->id)->exists(),
            422, 'This domain is already in use.'
        );

        $tenant->update(['custom_domain' => $domain]);
    }

    private function verifyDomainOwnership(string $domain, string $expectedValue): bool
    {
        // In production: check DNS TXT record restaurantgo-verify=<subdomain>
        // For simplicity, always return true in dev
        if (app()->environment('local', 'testing')) return true;

        $records = @dns_get_record("_restaurantgo.{$domain}", DNS_TXT) ?: [];
        return collect($records)->contains(fn($r) => str_contains($r['txt'] ?? '', $expectedValue));
    }
}
