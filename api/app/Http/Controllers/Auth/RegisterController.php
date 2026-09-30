<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\WelcomeTenant;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterController extends Controller
{
    public function __construct(private readonly TenantService $tenantService) {}

    public function __invoke(Request $request): JsonResponse
    {
        // Subdomains are case-insensitive DNS labels — normalize before
        // validating so "Pizza"/"pizza" collide instead of both passing
        // `unique:tenants` and racing each other for the same hostname.
        $request->merge(['subdomain' => strtolower(trim((string) $request->input('subdomain')))]);

        $validated = $request->validate([
            'restaurant_name' => ['required', 'string', 'max:100'],
            'subdomain' => [
                'required', 'string', 'min:3', 'max:50', 'unique:tenants',
                // DNS label: lowercase letters/digits, hyphens only in the
                // middle — no leading/trailing/doubled hyphen, no underscore.
                'regex:/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/',
                Rule::notIn(config('app.reserved_subdomains', [])),
            ],
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'timezone' => ['nullable', 'timezone'],
            'locale' => ['nullable', 'string', 'max:10'],
            'supported_locales' => ['required', 'array', 'min:1'],
            'supported_locales.*' => ['string', 'max:10'],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
        ]);

        DB::beginTransaction();
        try {
            // 1. Resolve the chosen plan, defaulting to Starter when none was picked
            //    (e.g. older clients that predate the registration plan step).
            $plan = isset($validated['plan_id'])
                ? Plan::where('id', $validated['plan_id'])->where('is_active', true)->firstOrFail()
                : Plan::where('slug', 'starter')->firstOrFail();

            // A free plan has nothing to bill, so it starts active immediately
            // instead of on a trial that would otherwise lapse into
            // SUBSCRIPTION_EXPIRED once CheckSubscription stops treating it as trialing.
            $isFree = (float) $plan->price_monthly === 0.0 && (float) $plan->price_yearly === 0.0;

            // 2. Create tenant
            $tenant = $this->tenantService->create([
                'name' => $validated['restaurant_name'],
                'subdomain' => $validated['subdomain'],
                'plan_id' => $plan->id,
                'trial_ends_at' => $isFree ? null : now()->addMonths(3),
                'status' => 'active',
                'default_locale' => $validated['locale'] ?? $validated['supported_locales'][0],
                'supported_locales' => $validated['supported_locales'],
                'timezone' => $validated['timezone'] ?? 'UTC',
                'default_currency' => 'USD',
            ]);

            if ($isFree) {
                Subscription::create([
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'status' => Subscription::STATUS_ACTIVE,
                    'billing_interval' => 'monthly',
                    'current_period_start' => now(),
                ]);
            }

            // 3. Create owner user
            $user = User::create([
                'tenant_id' => $tenant->id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
            ]);
            $user->assignRole('owner');

            DB::commit();

            $user->notify(new WelcomeTenant($tenant));

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'message' => $isFree
                    ? 'Account created successfully.'
                    : 'Account created successfully. Your 3-month trial has started.',
                'token' => $token,
                'user' => $user->only('id', 'name', 'email'),
                'tenant' => $tenant->only('id', 'name', 'subdomain', 'slug'),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
