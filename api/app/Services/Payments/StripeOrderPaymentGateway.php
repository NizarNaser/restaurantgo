<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Tenant;
use App\Services\StripeService;

/**
 * The only `OrderPaymentGateway` today — a thin adapter over the existing
 * `StripeService::createOrderCheckoutSession()`, which still owns every
 * Stripe-specific detail (minor-unit conversion, the platform commission,
 * writing `stripe_checkout_session_id` onto the order). This class exists
 * purely so `OrderCheckoutController` depends on the interface, not the
 * concrete Stripe class.
 */
class StripeOrderPaymentGateway implements OrderPaymentGateway
{
    public function __construct(private readonly StripeService $stripe)
    {
    }

    public function createCheckoutUrl(Tenant $tenant, Order $order, string $successUrl, string $cancelUrl): string
    {
        return $this->stripe->createOrderCheckoutSession($tenant, $order, $successUrl, $cancelUrl)->url;
    }
}
