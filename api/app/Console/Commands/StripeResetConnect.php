<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;

/**
 * Clears a tenant's Stripe Connect account id/status locally so the next
 * "Finish setup" click creates a fresh account — e.g. after one was created
 * in the wrong country, which Stripe doesn't allow changing after the fact.
 * Does not touch anything on Stripe's side; the old account, if any, is
 * left as-is there and simply becomes orphaned from this tenant.
 */
class StripeResetConnect extends Command
{
    protected $signature = 'stripe:reset-connect {tenant_id}';

    protected $description = "Clear a tenant's stripe_connect_* fields so a new Connect account is created next time";

    public function handle(): int
    {
        $tenant = Tenant::find($this->argument('tenant_id'));

        if (! $tenant) {
            $this->error("No tenant found with id {$this->argument('tenant_id')}.");
            return self::FAILURE;
        }

        $previousAccountId = $tenant->stripe_connect_account_id;

        $tenant->update([
            'stripe_connect_account_id'        => null,
            'stripe_connect_charges_enabled'   => false,
            'stripe_connect_details_submitted' => false,
        ]);

        $this->info("Cleared Stripe Connect data for tenant #{$tenant->id} ({$tenant->name})."
            . ($previousAccountId ? " Previous account was {$previousAccountId} — left untouched on Stripe." : ' It had no Connect account yet.'));

        return self::SUCCESS;
    }
}
