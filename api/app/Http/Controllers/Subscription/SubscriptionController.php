<?php

namespace App\Http\Controllers\Subscription;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Coupon;
use App\Models\Plan;
use App\Models\Subscription;
use App\Services\AuditService;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly StripeService $stripe,
        private readonly AuditService $audit,
    ) {}

    public function show(): JsonResponse
    {
        $tenant       = app('tenant');
        $subscription = $tenant->subscription;

        return response()->json([
            'plan'                 => new PlanResource($tenant->plan),
            'status'               => $subscription?->status ?? ($tenant->onTrial() ? 'trialing' : 'none'),
            'on_trial'             => $tenant->onTrial(),
            'trial_ends_at'        => optional($tenant->trial_ends_at)->toIso8601String(),
            'billing_interval'     => $subscription?->billing_interval,
            'current_period_end'   => optional($subscription?->current_period_end)->toIso8601String(),
            'cancel_at_period_end' => $subscription?->isEnding() ?? false,
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'plan_id'           => ['required', 'integer', 'exists:plans,id'],
            'billing_interval'  => ['required', Rule::in(['monthly', 'yearly'])],
            'coupon_code'       => ['nullable', 'string', 'max:50'],
            'success_url'       => ['required', 'url'],
            'cancel_url'        => ['required', 'url'],
        ]);

        $plan = Plan::findOrFail($data['plan_id']);
        abort_if(! $plan->is_active, 422, 'This plan is no longer available.');

        $session = $this->stripe->createCheckoutSession(
            $tenant,
            $plan,
            $data['billing_interval'],
            $data['coupon_code'] ?? null,
            $data['success_url'],
            $data['cancel_url'],
        );

        return response()->json(['checkout_url' => $session->url]);
    }

    /**
     * A $0 plan has nothing to charge, so there's no Stripe checkout to run —
     * switching onto one just needs to happen immediately. Any existing paid
     * subscription is cancelled outright (not at period end) since staying
     * on it would mean continuing to pay for a plan the tenant just left.
     */
    public function switchToFree(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
        ]);

        $plan = Plan::findOrFail($data['plan_id']);
        abort_if(! $plan->is_active, 422, 'This plan is no longer available.');
        abort_if((float) $plan->price_monthly !== 0.0 || (float) $plan->price_yearly !== 0.0, 422, 'This plan is not free.');

        $existing = $tenant->subscription;
        if ($existing && $existing->stripe_subscription_id && $existing->status !== Subscription::STATUS_CANCELED) {
            $this->stripe->cancel($existing, false);
        }

        Subscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'plan_id'                => $plan->id,
                'stripe_subscription_id' => null,
                'stripe_customer_id'     => $existing?->stripe_customer_id,
                'status'                 => Subscription::STATUS_ACTIVE,
                'billing_interval'       => 'monthly',
                'current_period_start'   => now(),
                'current_period_end'     => null,
                'trial_ends_at'          => null,
                'canceled_at'            => null,
            ],
        );

        $tenant->update(['plan_id' => $plan->id, 'trial_ends_at' => null, 'status' => 'active']);

        $this->audit->log('subscription.switched_to_free', $tenant, ['plan_id' => $plan->id]);

        return response()->json(['message' => 'You are now on the Free plan.']);
    }

    public function portal(Request $request): JsonResponse
    {
        $data = $request->validate(['return_url' => ['required', 'url']]);

        $session = $this->stripe->createBillingPortalSession(app('tenant'), $data['return_url']);

        return response()->json(['url' => $session->url]);
    }

    public function cancel(Request $request): JsonResponse
    {
        $tenant       = app('tenant');
        $subscription = $tenant->subscription;

        abort_if(! $subscription || $subscription->status === 'canceled', 422, 'No active subscription to cancel.');

        $atPeriodEnd = $request->boolean('at_period_end', true);
        $this->stripe->cancel($subscription, $atPeriodEnd);
        $this->audit->log('subscription.canceled', $subscription, ['new' => ['at_period_end' => $atPeriodEnd]]);

        return response()->json([
            'message' => $atPeriodEnd
                ? 'Your subscription will end at the close of the current billing period.'
                : 'Your subscription has been canceled.',
        ]);
    }

    public function resume(): JsonResponse
    {
        $subscription = app('tenant')->subscription;

        abort_if(! $subscription, 404, 'No subscription found.');

        $this->stripe->resume($subscription);
        $this->audit->log('subscription.resumed', $subscription);

        return response()->json(['message' => 'Subscription resumed.']);
    }

    public function validateCoupon(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:50']]);

        $coupon = Coupon::usableBy(app('tenant')->id)
            ->where('code', $data['code'])
            ->first();

        if (! $coupon || ! $coupon->isValid()) {
            return response()->json(['valid' => false, 'message' => 'This coupon is invalid or has expired.'], 422);
        }

        return response()->json([
            'valid'    => true,
            'code'     => $coupon->code,
            'type'     => $coupon->type,
            'value'    => (float) $coupon->value,
            'currency' => $coupon->currency,
        ]);
    }
}
