<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Auth\Concerns\BuildsAuthResponse;
use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    use BuildsAuthResponse;

    public function __construct(private readonly AuditService $audit)
    {
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

    public function suspend(Tenant $tenant): JsonResponse
    {
        $tenant->update(['status' => 'suspended']);
        $this->audit->log('tenant.suspended', $tenant);

        return response()->json(['message' => 'Tenant suspended.', 'tenant' => $tenant]);
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
