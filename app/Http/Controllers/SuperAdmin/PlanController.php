<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlanController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json(Plan::orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $validated['slug'] = $validated['slug'] ?? Str::slug($validated['name']);

        $plan = Plan::create($validated);
        $this->audit->log('plan.created', $plan);

        return response()->json($plan, 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $validated = $this->validated($request, $plan->id);

        $plan->update($validated);
        $this->audit->log('plan.updated', $plan);

        return response()->json($plan);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        abort_if(
            $plan->tenants()->exists() || $plan->subscriptions()->exists(),
            422,
            'This plan has tenants or subscriptions attached — deactivate it instead of deleting it.',
        );

        $this->audit->log('plan.deleted', $plan);
        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }

    private function validated(Request $request, ?int $ignorePlanId = null): array
    {
        return $request->validate([
            'name'                    => ['required', 'string', 'max:100'],
            'slug'                    => ['nullable', 'string', 'max:100', Rule::unique('plans', 'slug')->ignore($ignorePlanId)],
            'description'             => ['nullable', 'string'],
            'price_monthly'           => ['required', 'numeric', 'min:0'],
            'price_yearly'            => ['required', 'numeric', 'min:0'],
            'currency'                => ['required', 'string', 'size:3'],
            'max_branches'            => ['nullable', 'integer', 'min:0'],
            'max_menu_items'          => ['nullable', 'integer', 'min:0'],
            'max_users'               => ['nullable', 'integer', 'min:0'],
            'has_custom_domain'       => ['boolean'],
            'has_white_label'         => ['boolean'],
            'has_advanced_reports'    => ['boolean'],
            'has_api_access'          => ['boolean'],
            'has_qr_ordering'         => ['boolean'],
            'stripe_price_id_monthly' => ['nullable', 'string', 'max:255'],
            'stripe_price_id_yearly'  => ['nullable', 'string', 'max:255'],
            'is_active'               => ['boolean'],
            'sort_order'              => ['nullable', 'integer'],
        ]);
    }
}
