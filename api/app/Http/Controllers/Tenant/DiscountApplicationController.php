<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\DiscountApplication;
use App\Models\DiscountCard;
use App\Models\Order;
use App\Services\AuditService;
use App\Services\Currency;
use App\Services\StaffAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The discount workflow: only an owner/manager (gated by the "manage
 * discount cards" permission at the route level) can even request a
 * discount be applied — regular staff have no discount permission at all.
 * Approval on top of that still requires an owner/manager credential
 * (their own password, or a different owner/manager's access code — the
 * shared-terminal case), so a manager's own request still needs an
 * explicit second confirmation before it takes effect.
 */
class DiscountApplicationController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly StaffAccessService $staffAccess,
    ) {
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        $this->authorizeTenantOrder($order);
        abort_if(in_array($order->status, ['completed', 'cancelled']), 422, 'This order is already closed.');
        $this->guardNoApprovedDiscount($order);

        $data = $request->validate([
            'discount_card_id' => ['required', 'integer', 'exists:discount_cards,id'],
            'mode'             => ['required', Rule::in([DiscountApplication::MODE_DEDUCT, DiscountApplication::MODE_ACCUMULATE])],
        ]);

        $card = DiscountCard::where('tenant_id', app('tenant')->id)->where('is_active', true)->findOrFail($data['discount_card_id']);
        $amount = Currency::round(((float) $order->subtotal) * ((float) $card->discount_percentage) / 100, $order->currency);

        $application = DiscountApplication::create([
            'order_id'             => $order->id,
            'discount_card_id'     => $card->id,
            'requested_by_user_id' => $request->user()->id,
            'mode'                 => $data['mode'],
            'discount_percentage'  => $card->discount_percentage,
            'amount'               => $amount,
            'status'               => DiscountApplication::STATUS_PENDING,
        ]);

        $this->audit->log('discount_application.requested', $application);

        return response()->json($application, 201);
    }

    public function approve(Request $request, DiscountApplication $discountApplication): JsonResponse
    {
        $this->authorizeTenant($discountApplication);

        $approver = $this->staffAccess->resolveApprover($request);
        abort_unless($approver, 401, 'Could not verify an owner/manager credential.');
        abort_unless($approver->hasRole(['owner', 'manager']), 403, 'Only an owner or manager can approve a discount.');

        // The "already pending?" and "no stacked discount?" checks used to
        // run before this transaction, against a plain (unlocked) read —
        // two near-simultaneous approve() calls (the same request retried,
        // or two staff on a shared terminal) could both pass both checks
        // before either one's write committed, applying the discount twice.
        // Locking the application and order rows here forces the second
        // caller to wait for the first to finish, then see its result.
        DB::transaction(function () use ($discountApplication, $approver) {
            $application = DiscountApplication::whereKey($discountApplication->id)->lockForUpdate()->firstOrFail();
            abort_if($application->status !== DiscountApplication::STATUS_PENDING, 422, 'This request has already been handled.');

            $order = Order::whereKey($application->order_id)->lockForUpdate()->firstOrFail();
            $this->guardNoApprovedDiscount($order);

            $card = DiscountCard::whereKey($application->discount_card_id)->lockForUpdate()->firstOrFail();

            if ($application->mode === DiscountApplication::MODE_DEDUCT) {
                $newDiscountAmount = (float) $order->discount_amount + (float) $application->amount;
                $order->update([
                    'discount_card_id' => $card->id,
                    'discount_amount'  => $newDiscountAmount,
                    'total'            => (float) $order->subtotal - $newDiscountAmount,
                ]);
            } else {
                $card->accumulate((float) $application->amount);
            }

            $application->update([
                'status'              => DiscountApplication::STATUS_APPROVED,
                'approved_by_user_id' => $approver->id,
                'approved_at'         => now(),
            ]);
        });

        $discountApplication->refresh();
        $this->audit->log('discount_application.approved', $discountApplication, [], $approver);

        return response()->json($discountApplication);
    }

    public function reject(DiscountApplication $discountApplication): JsonResponse
    {
        $this->authorizeTenant($discountApplication);
        abort_if($discountApplication->status !== DiscountApplication::STATUS_PENDING, 422, 'This request has already been handled.');

        $discountApplication->update(['status' => DiscountApplication::STATUS_REJECTED]);
        $this->audit->log('discount_application.rejected', $discountApplication);

        return response()->json($discountApplication);
    }

    /** Spends previously-accumulated card credit against a later order — same credential check as approve(). */
    public function redeem(Request $request, Order $order): JsonResponse
    {
        $this->authorizeTenantOrder($order);
        abort_if(in_array($order->status, ['completed', 'cancelled']), 422, 'This order is already closed.');

        $data = $request->validate([
            'discount_card_id' => ['required', 'integer', 'exists:discount_cards,id'],
            'amount'           => ['required', 'numeric', 'gt:0'],
        ]);

        $approver = $this->staffAccess->resolveApprover($request);
        abort_unless($approver, 401, 'Could not verify an owner/manager credential.');
        abort_unless($approver->hasRole(['owner', 'manager']), 403, 'Only an owner or manager can approve redeeming card credit.');

        // The balance check and guardNoApprovedDiscount() used to both run
        // outside this transaction, against plain (unlocked) reads — two
        // near-simultaneous redeem() calls against the same card (a shared
        // terminal, a double-tap) could both pass the same stale balance
        // check before either decrement committed, spending more credit
        // than the card actually held. Locking the card and order rows
        // forces the second caller to wait and then re-check against the
        // first caller's already-applied result.
        $application = DB::transaction(function () use ($order, $data, $approver, $request) {
            $lockedOrder = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            $this->guardNoApprovedDiscount($lockedOrder);

            $card = DiscountCard::where('tenant_id', app('tenant')->id)
                ->whereKey($data['discount_card_id'])
                ->lockForUpdate()
                ->firstOrFail();

            abort_if($data['amount'] > (float) $card->accumulated_balance, 422, "This card's accumulated credit is lower than that amount.");

            $card->redeem($data['amount']);

            $newDiscountAmount = (float) $lockedOrder->discount_amount + $data['amount'];
            $lockedOrder->update([
                'discount_card_id' => $card->id,
                'discount_amount'  => $newDiscountAmount,
                'total'            => (float) $lockedOrder->subtotal - $newDiscountAmount,
            ]);

            return DiscountApplication::create([
                'order_id'             => $lockedOrder->id,
                'discount_card_id'     => $card->id,
                'requested_by_user_id' => $request->user()->id,
                'mode'                 => DiscountApplication::MODE_REDEEM,
                'amount'               => $data['amount'],
                'status'               => DiscountApplication::STATUS_APPROVED,
                'approved_by_user_id'  => $approver->id,
                'approved_at'          => now(),
            ]);
        });

        $this->audit->log('discount_application.redeemed', $application, [], $approver);

        return response()->json($application, 201);
    }

    /** Only one active discount per order — no stacking. */
    private function guardNoApprovedDiscount(Order $order): void
    {
        abort_if(
            $order->discountApplications()->where('status', DiscountApplication::STATUS_APPROVED)->exists(),
            422,
            'This order already has an approved discount.'
        );
    }

    private function authorizeTenant(DiscountApplication $application): void
    {
        abort_if((int) $application->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }

    private function authorizeTenantOrder(Order $order): void
    {
        abort_if((int) $order->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
