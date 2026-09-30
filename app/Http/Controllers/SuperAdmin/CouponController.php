<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json(
            Coupon::with('tenant:id,name')->orderByDesc('created_at')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);

        $coupon = Coupon::create($validated);
        $this->audit->log('coupon.created', $coupon);

        return response()->json($coupon, 201);
    }

    public function update(Request $request, Coupon $coupon): JsonResponse
    {
        $validated = $this->validated($request, $coupon->id);

        $coupon->update($validated);
        $this->audit->log('coupon.updated', $coupon);

        return response()->json($coupon);
    }

    public function destroy(Coupon $coupon): JsonResponse
    {
        $this->audit->log('coupon.deleted', $coupon);
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted.']);
    }

    private function validated(Request $request, ?int $ignoreCouponId = null): array
    {
        return $request->validate([
            'tenant_id'  => ['nullable', 'integer', 'exists:tenants,id'],
            'code'       => ['required', 'string', 'max:50', Rule::unique('coupons', 'code')->ignore($ignoreCouponId)],
            'type'       => ['required', Rule::in([Coupon::TYPE_PERCENT, Coupon::TYPE_FIXED])],
            'value'      => ['required', 'numeric', 'min:0'],
            'currency'   => ['nullable', 'string', 'size:3', 'required_if:type,' . Coupon::TYPE_FIXED],
            'max_uses'   => ['nullable', 'integer', 'min:1'],
            'expires_at' => ['nullable', 'date'],
            'is_active'  => ['boolean'],
        ]);
    }
}
