<?php

namespace App\Console\Commands;

use App\Models\Plan;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Stripe\StripeClient;

/**
 * Creates a Stripe Product + monthly/yearly recurring Prices for every local
 * Plan that doesn't have them yet, and stores the resulting price ids.
 * Idempotent — safe to re-run; a plan that already has both ids is skipped,
 * so this can be run again after adding a new plan without touching the
 * ones already synced.
 */
#[Signature('app:sync-stripe-plans')]
#[Description('Create/sync Stripe Products & Prices for local subscription plans')]
class SyncStripePlans extends Command
{
    public function handle(): int
    {
        if (! config('services.stripe.secret')) {
            $this->error('STRIPE_SECRET is not configured.');
            return self::FAILURE;
        }

        $stripe = new StripeClient(config('services.stripe.secret'));

        foreach (Plan::orderBy('sort_order')->get() as $plan) {
            if ($plan->stripe_price_id_monthly && $plan->stripe_price_id_yearly) {
                $this->line("- {$plan->name}: already synced, skipping.");
                continue;
            }

            $product = $stripe->products->create([
                'name'        => "RestaurantGo {$plan->name}",
                'description' => $plan->description,
                'metadata'    => ['plan_id' => $plan->id, 'plan_slug' => $plan->slug],
            ]);

            $currency = strtolower($plan->currency ?: 'usd');

            $monthlyPrice = $stripe->prices->create([
                'product'     => $product->id,
                'currency'    => $currency,
                'unit_amount' => (int) round(((float) $plan->price_monthly) * 100),
                'recurring'   => ['interval' => 'month'],
                'metadata'    => ['plan_id' => $plan->id],
            ]);

            $yearlyPrice = $stripe->prices->create([
                'product'     => $product->id,
                'currency'    => $currency,
                'unit_amount' => (int) round(((float) $plan->price_yearly) * 100),
                'recurring'   => ['interval' => 'year'],
                'metadata'    => ['plan_id' => $plan->id],
            ]);

            $plan->update([
                'stripe_price_id_monthly' => $monthlyPrice->id,
                'stripe_price_id_yearly'  => $yearlyPrice->id,
            ]);

            $this->info("- {$plan->name}: created product {$product->id} (monthly {$monthlyPrice->id}, yearly {$yearlyPrice->id}).");
        }

        return self::SUCCESS;
    }
}
