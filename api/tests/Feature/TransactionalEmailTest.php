<?php

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\PaymentFailed;
use App\Notifications\TenantSuspended;
use App\Notifications\WelcomeTenant;
use App\Services\StripeService;
use App\Services\TenantService;
use Illuminate\Support\Facades\Notification;
use Stripe\Event;

beforeEach(function () {
    $this->seed();
});

it('emails the new owner a welcome notification on registration', function () {
    Notification::fake();

    $this->postJson('/api/auth/register', [
        'restaurant_name'       => 'Welcome Bistro',
        'subdomain'             => 'welcome-bistro',
        'name'                  => 'New Owner',
        'email'                 => 'new-owner@example.com',
        'password'              => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales'     => ['en'],
    ])->assertCreated();

    $user = User::where('email', 'new-owner@example.com')->firstOrFail();
    Notification::assertSentTo($user, WelcomeTenant::class);
});

it('emails every owner when a tenant is suspended', function () {
    Notification::fake();

    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $tenant = Tenant::find($owner->tenant_id);

    app(TenantService::class)->suspend($tenant, 'Unpaid invoice');

    expect($tenant->fresh()->status)->toBe('suspended');
    Notification::assertSentTo($owner, TenantSuspended::class);
});

it('emails the tenant owner when a Stripe invoice payment fails', function () {
    Notification::fake();

    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $subscription = Subscription::create([
        'tenant_id'               => $owner->tenant_id,
        'plan_id'                 => Plan::first()->id,
        'stripe_subscription_id'  => 'sub_test_123',
        'status'                  => Subscription::STATUS_ACTIVE,
    ]);

    $event = Event::constructFrom([
        'id'   => 'evt_test_123',
        'type' => 'invoice.payment_failed',
        'data' => ['object' => [
            'subscription' => 'sub_test_123',
            'amount_due'   => 4900,
            'currency'     => 'usd',
        ]],
    ]);

    app(StripeService::class)->handleWebhookEvent($event);

    expect($subscription->fresh()->status)->toBe(Subscription::STATUS_PAST_DUE);
    Notification::assertSentTo($owner, PaymentFailed::class);
});
