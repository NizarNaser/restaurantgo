<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Billing is Stripe-managed (see WebhookController), so "payments" here means
 * each tenant's current subscription/billing state rather than a raw charge
 * ledger — there's no local payments table to source individual transactions from.
 */
class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $subscriptions = Subscription::with('tenant:id,name,slug', 'plan:id,name,price_monthly,price_yearly')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('current_period_end')
            ->paginate($request->per_page ?? 20);

        return response()->json($subscriptions);
    }
}
