<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Tenant;

/**
 * What any payment provider needs to offer to process a public (customer-
 * facing) order checkout — today only `StripeOrderPaymentGateway` exists,
 * but this is the seam a future region-specific gateway plugs into (e.g.
 * a mada-capable Saudi processor, or Tap Payments/Areeba for Lebanon —
 * see PAY-02 and Phase 4/5 in COMPLIANCE_SECURITY_PAYMENTS_PLAN.md)
 * without `OrderCheckoutController` having to know which provider is in
 * play for a given tenant.
 *
 * Deliberately narrow: this only covers the order-checkout step, not
 * Connect-style merchant onboarding (`ConnectController` already calls
 * `StripeService`/`PayPalService` directly for that, and those two don't
 * need unifying — each onboarding flow has its own dedicated endpoint) or
 * platform subscription billing (`SubscriptionController`, which stays on
 * Stripe regardless of a tenant's own country — that's the platform's own
 * billing relationship, not the tenant's).
 */
interface OrderPaymentGateway
{
    /**
     * Creates a hosted checkout session for this order and returns the URL
     * to redirect the customer to.
     */
    public function createCheckoutUrl(Tenant $tenant, Order $order, string $successUrl, string $cancelUrl): string;
}
