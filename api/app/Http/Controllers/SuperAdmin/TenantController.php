<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Auth\Concerns\BuildsAuthResponse;
use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\WelcomeTenant;
use App\Services\AuditService;
use App\Services\StripeService;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class TenantController extends Controller
{
    use BuildsAuthResponse;

    public function __construct(
        private readonly AuditService $audit,
        private readonly TenantService $tenantService,
        private readonly StripeService $stripe,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $tenants = Tenant::with('plan', 'subscription')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 20);

        return response()->json($tenants);
    }

    public function show(Tenant $tenant): JsonResponse
    {
        return response()->json($tenant->load('plan', 'subscription', 'users', 'branches'));
    }

    /**
     * Platform staff creating a restaurant directly: skips the public
     * registration flow entirely, so the tenant starts active on the chosen
     * plan with no trial and no Stripe/PayPal checkout involved.
     */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['subdomain' => strtolower(trim((string) $request->input('subdomain')))]);

        $validated = $request->validate([
            'restaurant_name' => ['required', 'string', 'max:100'],
            'subdomain' => [
                'required', 'string', 'min:3', 'max:50', 'unique:tenants',
                'regex:/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/',
                Rule::notIn(config('app.reserved_subdomains', [])),
            ],
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'owner_name' => ['required', 'string', 'max:100'],
            'owner_email' => ['required', 'email', 'unique:users,email'],
            'owner_password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'timezone' => ['nullable', 'timezone'],
            'locale' => ['nullable', 'string', 'max:10'],
            'supported_locales' => ['nullable', 'array', 'min:1'],
            'supported_locales.*' => ['string', 'max:10'],
        ]);

        $plan = Plan::where('id', $validated['plan_id'])->where('is_active', true)->firstOrFail();
        $supportedLocales = $validated['supported_locales'] ?? ['ar', 'en'];
        $locale = $validated['locale'] ?? $supportedLocales[0];

        $tenant = DB::transaction(function () use ($validated, $plan, $supportedLocales, $locale) {
            $tenant = $this->tenantService->create([
                'name' => $validated['restaurant_name'],
                'subdomain' => $validated['subdomain'],
                'plan_id' => $plan->id,
                'trial_ends_at' => null,
                'status' => 'active',
                'default_locale' => $locale,
                'supported_locales' => $supportedLocales,
                'timezone' => $validated['timezone'] ?? 'UTC',
                'default_currency' => 'USD',
            ]);

            // Granted by an admin, not paid for — mark the subscription active
            // immediately regardless of the plan's price, same as the free-plan
            // path at signup, so CheckSubscription never treats it as expired.
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_interval' => 'monthly',
                'current_period_start' => now(),
            ]);

            $owner = User::create([
                'tenant_id' => $tenant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'password' => Hash::make($validated['owner_password']),
            ]);
            $owner->assignRole('owner');

            return $tenant;
        });

        $owner = $tenant->users()->role('owner')->firstOrFail();
        $owner->notify(new WelcomeTenant($tenant));

        $this->audit->log('tenant.created', $tenant, ['new' => ['plan_id' => $plan->id]]);

        return response()->json([
            'message' => 'Tenant created successfully.',
            'tenant' => $tenant->load('plan', 'subscription'),
        ], 201);
    }

    /**
     * Move a tenant onto a different plan without a checkout: used by
     * platform staff to grant/change plans manually (e.g. comped accounts,
     * manual upgrades/downgrades agreed outside Stripe).
     */
    public function updatePlan(Request $request, Tenant $tenant): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
        ]);

        $plan = Plan::where('id', $validated['plan_id'])->where('is_active', true)->firstOrFail();
        $previousPlanId = $tenant->plan_id;

        $existing = $tenant->subscription;
        if ($existing && $existing->stripe_subscription_id && $existing->status !== Subscription::STATUS_CANCELED) {
            $this->stripe->cancel($existing, false);
        }

        DB::transaction(function () use ($tenant, $plan, $existing) {
            Subscription::updateOrCreate(['tenant_id' => $tenant->id], [
                'plan_id' => $plan->id,
                'stripe_subscription_id' => null,
                'stripe_customer_id' => $existing?->stripe_customer_id,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_interval' => 'monthly',
                'current_period_start' => now(),
                'current_period_end' => null,
                'canceled_at' => null,
            ]);

            $tenant->update(['plan_id' => $plan->id, 'trial_ends_at' => null, 'status' => 'active']);
        });

        $this->audit->log('tenant.plan_changed', $tenant, [
            'old' => ['plan_id' => $previousPlanId],
            'new' => ['plan_id' => $plan->id],
        ]);

        return response()->json([
            'message' => 'Tenant plan updated.',
            'tenant' => $tenant->fresh(['plan', 'subscription']),
        ]);
    }

    public function suspend(Tenant $tenant): JsonResponse
    {
        $tenant->update(['status' => 'suspended']);
        $this->audit->log('tenant.suspended', $tenant);

        return response()->json(['message' => 'Tenant suspended.', 'tenant' => $tenant]);
    }

    /**
     * Platform staff removing a restaurant outright: cancels any live Stripe
     * subscription first (an untouched one would keep billing a tenant that
     * no longer exists), then soft-deletes the tenant — the same mechanism
     * GdprController::requestErasure uses for an owner-initiated deletion —
     * so it immediately disappears from the admin list and can no longer
     * resolve through IdentifyTenant.
     */
    public function destroy(Request $request, Tenant $tenant): JsonResponse
    {
        $request->validate([
            'confirm_subdomain' => ['required', 'string'],
        ]);

        abort_if($request->input('confirm_subdomain') !== $tenant->subdomain, 422, 'Confirmation text does not match the tenant subdomain.');

        $existing = $tenant->subscription;
        if ($existing && $existing->stripe_subscription_id && $existing->status !== Subscription::STATUS_CANCELED) {
            $this->stripe->cancel($existing, false);
        }

        $tenant->update(['status' => 'cancelled']);
        $tenant->delete();

        $this->audit->log('tenant.deleted', $tenant);

        return response()->json(['message' => 'Tenant deleted.']);
    }

    public function activate(Tenant $tenant): JsonResponse
    {
        $tenant->update(['status' => 'active']);
        $this->audit->log('tenant.activated', $tenant);

        return response()->json(['message' => 'Tenant activated.', 'tenant' => $tenant]);
    }

    public function impersonate(Tenant $tenant): JsonResponse
    {
        $owner = $tenant->users()->role('owner')->first() ?? $tenant->users()->first();

        abort_if(! $owner, 404, 'This tenant has no user to impersonate.');

        $token = $owner->createToken('impersonation', $this->getAbilities($owner))->plainTextToken;

        $this->audit->log('tenant.impersonated', $tenant, [
            'new' => ['impersonated_user_id' => $owner->id, 'impersonated_email' => $owner->email],
        ]);

        return response()->json([
            'token'  => $token,
            'user'   => $this->userPayload($owner),
            'tenant' => $owner->tenant?->only('id', 'name', 'subdomain', 'custom_domain', 'status', 'default_locale', 'default_currency'),
        ]);
    }

    public function metrics(): JsonResponse
    {
        return response()->json([
            'tenants_total'     => Tenant::count(),
            'tenants_active'    => Tenant::where('status', 'active')->count(),
            'tenants_suspended' => Tenant::where('status', 'suspended')->count(),
            'tenants_on_trial'  => Tenant::where('trial_ends_at', '>', now())->count(),
            'subscriptions_active' => Subscription::where('status', Subscription::STATUS_ACTIVE)->count(),
            'mrr' => (float) Subscription::query()
                ->where('status', Subscription::STATUS_ACTIVE)
                ->join('plans', 'plans.id', '=', 'subscriptions.plan_id')
                ->selectRaw('SUM(CASE WHEN billing_interval = ? THEN plans.price_monthly ELSE plans.price_yearly / 12 END) as mrr', ['monthly'])
                ->value('mrr') ?? 0,
        ]);
    }
}
