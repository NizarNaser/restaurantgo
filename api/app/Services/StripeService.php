<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Notifications\PaymentFailed;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\BillingPortal\Session as BillingPortalSession;
use Stripe\Checkout\Session as CheckoutSession;
use Stripe\Event;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;
use Stripe\Subscription as StripeSubscription;

/**
 * Everything that talks to Stripe: customers, checkout, the billing portal,
 * and the webhook events that keep a tenant's Subscription row in sync with
 * what Stripe actually billed.
 *
 * Subscriptions are the source of truth on Stripe's side — this service
 * never flips a tenant to "active" itself outside of a webhook, so a
 * checkout redirect that the customer never completes changes nothing here.
 */
class StripeService
{
    private ?StripeClient $client = null;

    public function isConfigured(): bool
    {
        return (bool) config('services.stripe.secret');
    }

    private function assertConfigured(): void
    {
        abort_if(! $this->isConfigured(), 422, 'Payments are not configured for this platform yet.');
    }

    /**
     * Built lazily, and only once a caller has confirmed Stripe is actually
     * configured — constructing it eagerly would need a key even for the
     * codepaths (like reading a locally-tracked subscription) that never
     * call Stripe at all.
     */
    private function client(): StripeClient
    {
        return $this->client ??= new StripeClient(config('services.stripe.secret'));
    }

    // ── Customers ─────────────────────────────────────────────

    public function getOrCreateCustomer(Tenant $tenant): string
    {
        if ($existing = $tenant->stripeCustomerId()) {
            return $existing;
        }

        $this->assertConfigured();

        $owner = $tenant->users()->role('owner')->first();

        $customer = $this->client()->customers->create([
            'name'     => $tenant->name,
            'email'    => $owner?->email,
            'metadata' => ['tenant_id' => (string) $tenant->id],
        ]);

        $tenant->setStripeCustomerId($customer->id);

        return $customer->id;
    }

    // ── Connect (per-tenant accounts, for delivery/takeout payouts) ─────────

    /**
     * A Standard Connect account — Stripe hosts onboarding/KYC and the
     * account's own dashboard, keeping the platform's compliance surface
     * minimal. Idempotent: returns the existing account once one exists
     * rather than creating a second.
     */
    public function getOrCreateConnectAccount(Tenant $tenant): string
    {
        if ($tenant->stripe_connect_account_id) {
            return $tenant->stripe_connect_account_id;
        }

        $this->assertConfigured();

        $owner = $tenant->users()->role('owner')->first();

        try {
            $account = $this->client()->accounts->create([
                'type'     => 'standard',
                'country'  => $tenant->country ?? $tenant->country_code ?? config('services.stripe.connect_country', 'DE'),
                'email'    => $owner?->email,
                'metadata' => ['tenant_id' => (string) $tenant->id],
            ]);
        } catch (ApiErrorException $e) {
            // Most commonly: the platform's own Stripe account hasn't
            // activated Connect yet (a one-time step at dashboard.stripe.com/connect)
            // — surface Stripe's own message rather than a raw 500.
            abort(422, $e->getMessage());
        }

        $tenant->update(['stripe_connect_account_id' => $account->id]);

        return $account->id;
    }

    /**
     * A Stripe-hosted onboarding link. Safe to call again for an account
     * that started onboarding but didn't finish — Stripe resumes it where
     * the owner left off rather than starting over.
     */
    public function createConnectAccountLink(Tenant $tenant, string $returnUrl, string $refreshUrl): string
    {
        $this->assertConfigured();

        $accountId = $this->getOrCreateConnectAccount($tenant);

        try {
            $link = $this->client()->accountLinks->create([
                'account'     => $accountId,
                'refresh_url' => $refreshUrl,
                'return_url'  => $returnUrl,
                'type'        => 'account_onboarding',
            ]);
        } catch (ApiErrorException $e) {
            abort(422, $e->getMessage());
        }

        return $link->url;
    }

    // ── Checkout ──────────────────────────────────────────────

    public function createCheckoutSession(
        Tenant $tenant,
        Plan $plan,
        string $billingInterval,
        ?string $couponCode,
        string $successUrl,
        string $cancelUrl,
    ): CheckoutSession {
        $this->assertConfigured();

        $priceId = $billingInterval === 'yearly' ? $plan->stripe_price_id_yearly : $plan->stripe_price_id_monthly;
        abort_if(! $priceId, 422, "The {$plan->name} plan isn't available for online purchase yet. Contact support.");

        $metadata = [
            'tenant_id'        => (string) $tenant->id,
            'plan_id'          => (string) $plan->id,
            'billing_interval' => $billingInterval,
        ];

        $params = [
            'customer'            => $this->getOrCreateCustomer($tenant),
            'mode'                => 'subscription',
            'line_items'          => [['price' => $priceId, 'quantity' => 1]],
            'success_url'         => $successUrl,
            'cancel_url'          => $cancelUrl,
            'client_reference_id' => (string) $tenant->id,
            'subscription_data'   => ['metadata' => $metadata],
            'metadata'            => $metadata,
        ];

        if ($couponCode) {
            $coupon = Coupon::usableBy($tenant->id)->where('code', $couponCode)->first();
            abort_if(! $coupon || ! $coupon->isValid(), 422, 'This coupon is invalid or has expired.');
            abort_unless($coupon->tryReserve(), 422, 'This coupon has just reached its usage limit.');

            $params['discounts'] = [['coupon' => $this->stripeCouponIdFor($coupon)]];
            $params['metadata']['coupon_code'] = $coupon->code;
            $params['subscription_data']['metadata']['coupon_code'] = $coupon->code;
        } else {
            $params['allow_promotion_codes'] = true;
        }

        return $this->client()->checkout->sessions->create($params);
    }

    /**
     * A direct charge on the tenant's own connected account — Standard
     * accounts own their charges/disputes/refunds in their own dashboard, so
     * the charge itself must live there, not on the platform account. The
     * platform's cut is carved out via `application_fee_amount` rather than
     * a separate transfer. Order pricing is dynamic per request, so line
     * items are built from `price_data` instead of pre-created Stripe Prices.
     */
    public function createOrderCheckoutSession(Tenant $tenant, Order $order, string $successUrl, string $cancelUrl): CheckoutSession
    {
        $this->assertConfigured();

        abort_if(! $tenant->hasActiveConnectAccount(), 422, "Online ordering isn't available for this restaurant yet.");

        $metadata = [
            'kind'      => 'order_payment',
            'order_id'  => (string) $order->id,
            'tenant_id' => (string) $tenant->id,
        ];

        $lineItems = $order->items->map(fn ($item) => [
            'price_data' => [
                'currency'     => strtolower($order->currency),
                'unit_amount'  => $this->toMinorUnits((float) $item->unit_price, $order->currency),
                'product_data' => ['name' => $item->name],
            ],
            'quantity' => $item->quantity,
        ])->all();

        $params = [
            'mode'               => 'payment',
            'line_items'         => $lineItems,
            'success_url'        => $successUrl,
            'cancel_url'         => $cancelUrl,
            'client_reference_id' => (string) $order->id,
            'metadata'           => $metadata,
            'payment_intent_data' => [
                'application_fee_amount' => $this->applicationFeeFor($order),
                'metadata'                => $metadata,
            ],
        ];

        $session = $this->client()->checkout->sessions->create(
            $params,
            ['stripe_account' => $tenant->stripe_connect_account_id],
        );

        $order->update([
            'stripe_checkout_session_id' => $session->id,
            // applicationFeeFor() returns Stripe minor units (cents, fils,
            // or whole units depending on the order's currency) — converting
            // it back with a flat /100 undercharges-on-paper three-decimal
            // currencies 10x and overstates zero-decimal ones 100x, the same
            // class of bug as the minor-unit conversion itself.
            'platform_fee_amount'        => Currency::fromMinorUnits($this->applicationFeeFor($order), $order->currency),
        ]);

        return $session;
    }

    private function applicationFeeFor(Order $order): int
    {
        $percent = (float) config('services.stripe.order_commission_percent', 0);

        return (int) round($this->toMinorUnits((float) $order->total, $order->currency) * ($percent / 100));
    }

    /**
     * Stripe's minor-unit amount depends on the currency: most are 2-decimal
     * (cents), a handful are 3-decimal (e.g. a Kuwaiti Dinar's fils), and a
     * few are zero-decimal (e.g. Japanese Yen has no subunit at all). A flat
     * *100 silently overcharges zero-decimal currencies 100x and undercharges
     * three-decimal currencies 10x — both reachable today via the currency
     * picker in Settings, not hypothetical future cases.
     */
    private function toMinorUnits(float $amount, string $currency): int
    {
        return Currency::toMinorUnits($amount, $currency);
    }

    /**
     * Stripe has no concept of our local percent/fixed coupon rows, so mirror
     * one over as a real Stripe coupon the first time it's used. The id is
     * derived from our code, so repeat checkouts reuse the same Stripe object
     * instead of creating duplicates.
     */
    private function stripeCouponIdFor(Coupon $coupon): string
    {
        $stripeCouponId = 'local_' . $coupon->code;

        try {
            $this->client()->coupons->retrieve($stripeCouponId);

            return $stripeCouponId;
        } catch (ApiErrorException) {
            // Doesn't exist yet — fall through and create it.
        }

        $params = [
            'id'       => $stripeCouponId,
            'duration' => 'once',
            'name'     => $coupon->code,
        ];

        if ($coupon->type === Coupon::TYPE_PERCENT) {
            $params['percent_off'] = (float) $coupon->value;
        } else {
            $currency = $coupon->currency ?? 'usd';
            $params['amount_off'] = $this->toMinorUnits((float) $coupon->value, $currency);
            $params['currency']   = strtolower($currency);
        }

        $this->client()->coupons->create($params);

        return $stripeCouponId;
    }

    // ── Billing portal ────────────────────────────────────────

    public function createBillingPortalSession(Tenant $tenant, string $returnUrl): BillingPortalSession
    {
        $this->assertConfigured();

        return $this->client()->billingPortal->sessions->create([
            'customer'   => $this->getOrCreateCustomer($tenant),
            'return_url' => $returnUrl,
        ]);
    }

    // ── Cancel / resume ───────────────────────────────────────

    public function cancel(Subscription $subscription, bool $atPeriodEnd = true): void
    {
        if (! $subscription->stripe_subscription_id) {
            $subscription->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);

            return;
        }

        $this->assertConfigured();

        if ($atPeriodEnd) {
            $this->client()->subscriptions->update($subscription->stripe_subscription_id, [
                'cancel_at_period_end' => true,
            ]);
            $subscription->update(['canceled_at' => now()]);
        } else {
            $this->client()->subscriptions->cancel($subscription->stripe_subscription_id);
            $subscription->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);
        }
    }

    public function resume(Subscription $subscription): void
    {
        abort_if(! $subscription->stripe_subscription_id, 422, 'No Stripe subscription to resume.');

        $this->assertConfigured();

        $this->client()->subscriptions->update($subscription->stripe_subscription_id, [
            'cancel_at_period_end' => false,
        ]);

        $subscription->update(['canceled_at' => null]);
    }

    // ── Webhooks ──────────────────────────────────────────────

    public function handleWebhookEvent(Event $event): void
    {
        match ($event->type) {
            'checkout.session.completed'    => $this->onCheckoutCompleted($event->data->object),
            'customer.subscription.updated' => $this->onSubscriptionUpdated($event->data->object),
            'customer.subscription.deleted' => $this->onSubscriptionDeleted($event->data->object),
            'invoice.payment_failed'        => $this->onPaymentFailed($event->data->object),
            'invoice.payment_succeeded'     => $this->onPaymentSucceeded($event->data->object),
            'account.updated'               => $this->onConnectAccountUpdated($event->data->object),
            default                         => Log::info('Unhandled Stripe webhook event', ['type' => $event->type]),
        };
    }

    private function onCheckoutCompleted(object $session): void
    {
        if (($session->metadata->kind ?? null) === 'order_payment') {
            $this->onOrderCheckoutCompleted($session);

            return;
        }

        $tenantId = $session->metadata->tenant_id ?? $session->client_reference_id ?? null;
        $tenant   = $tenantId ? Tenant::find($tenantId) : null;

        if (! $tenant || ! $session->subscription) {
            return;
        }

        $planId   = $session->metadata->plan_id ?? $tenant->plan_id;
        $interval = $session->metadata->billing_interval ?? 'monthly';

        $stripeSub = $this->client()->subscriptions->retrieve($session->subscription);

        Subscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'plan_id'                => $planId,
                'stripe_subscription_id' => $stripeSub->id,
                'stripe_customer_id'     => $session->customer,
                'status'                 => $stripeSub->status,
                'billing_interval'       => $interval,
                'current_period_start'   => Carbon::createFromTimestamp($stripeSub->current_period_start),
                'current_period_end'     => Carbon::createFromTimestamp($stripeSub->current_period_end),
                'trial_ends_at'          => null,
                'canceled_at'            => null,
            ],
        );

        $tenant->update(['plan_id' => $planId, 'trial_ends_at' => null, 'status' => 'active']);

        // used_count was already reserved atomically in
        // createSubscriptionCheckoutSession(), before this checkout session
        // was even created — incrementing it again here, on completion,
        // was the race: several concurrent checkouts could all read the
        // same stale used_count and all get the coupon applied before any
        // of them completed.
    }

    private function onOrderCheckoutCompleted(object $session): void
    {
        $orderId = $session->metadata->order_id ?? $session->client_reference_id ?? null;
        $order   = $orderId ? Order::find($orderId) : null;

        if (! $order || $order->isPaid()) {
            return;
        }

        $order->update([
            'payment_status'           => Order::PAYMENT_STATUS_PAID,
            'stripe_payment_intent_id' => $session->payment_intent,
            'paid_at'                  => now(),
        ]);
    }

    private function onSubscriptionUpdated(StripeSubscription $stripeSub): void
    {
        $subscription = Subscription::where('stripe_subscription_id', $stripeSub->id)->first();

        if (! $subscription) {
            return;
        }

        $subscription->update([
            'status'                => $stripeSub->status,
            'current_period_start'  => Carbon::createFromTimestamp($stripeSub->current_period_start),
            'current_period_end'    => Carbon::createFromTimestamp($stripeSub->current_period_end),
            'canceled_at'           => $stripeSub->cancel_at_period_end
                ? ($subscription->canceled_at ?? now())
                : null,
        ]);

        if (in_array($stripeSub->status, ['active', 'trialing'], true)) {
            $subscription->tenant?->update(['status' => 'active']);
        }
    }

    private function onConnectAccountUpdated(object $account): void
    {
        Tenant::where('stripe_connect_account_id', $account->id)
            ->first()
            ?->update([
                'stripe_connect_charges_enabled'   => (bool) $account->charges_enabled,
                'stripe_connect_details_submitted' => (bool) $account->details_submitted,
            ]);
    }

    /**
     * Pulls a tenant's Connect account status directly from Stripe and
     * syncs it locally. Used as a fallback for when the account.updated
     * webhook hasn't flipped charges_enabled/details_submitted yet — e.g.
     * because it's delivered to the separate Connected Accounts webhook
     * endpoint, which isn't guaranteed to be configured — so the dashboard
     * doesn't show "pending" forever while nothing is actually wrong.
     */
    public function syncConnectAccount(Tenant $tenant): void
    {
        if (! $tenant->stripe_connect_account_id) {
            return;
        }

        $this->assertConfigured();

        try {
            $account = $this->client()->accounts->retrieve($tenant->stripe_connect_account_id);
        } catch (ApiErrorException $e) {
            Log::warning('Failed to sync Stripe Connect account status', [
                'tenant_id' => $tenant->id,
                'error'     => $e->getMessage(),
            ]);

            return;
        }

        $this->onConnectAccountUpdated($account);
    }

    private function onSubscriptionDeleted(StripeSubscription $stripeSub): void
    {
        Subscription::where('stripe_subscription_id', $stripeSub->id)
            ->first()
            ?->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);
    }

    private function onPaymentFailed(object $invoice): void
    {
        if (! $invoice->subscription) {
            return;
        }

        $subscription = Subscription::where('stripe_subscription_id', $invoice->subscription)->first();

        if (! $subscription) {
            return;
        }

        $subscription->update(['status' => Subscription::STATUS_PAST_DUE]);

        $amount = isset($invoice->amount_due) ? $invoice->amount_due / 100 : null;

        $subscription->tenant?->users()->role('owner')->get()
            ->each->notify(new PaymentFailed($amount, $invoice->currency ?? null));
    }

    private function onPaymentSucceeded(object $invoice): void
    {
        if (! $invoice->subscription) {
            return;
        }

        $subscription = Subscription::where('stripe_subscription_id', $invoice->subscription)->first();

        if ($subscription && $subscription->status !== Subscription::STATUS_ACTIVE) {
            $subscription->update(['status' => Subscription::STATUS_ACTIVE]);
        }
    }
}
