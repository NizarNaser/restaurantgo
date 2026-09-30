<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\DiscountCard;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiscountCardController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $cards = DiscountCard::where('tenant_id', app('tenant')->id)->orderByDesc('created_at')->get();

        return response()->json($cards);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'card_number'          => ['required', 'string', 'max:100', Rule::unique('discount_cards')->where('tenant_id', app('tenant')->id)],
            'customer_name'        => ['required', 'string', 'max:255'],
            'customer_birth_date'  => ['nullable', 'date'],
            'customer_phone'       => ['nullable', 'string', 'max:50'],
            'customer_email'       => ['nullable', 'email', 'max:255'],
            'discount_percentage'  => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $card = DiscountCard::create(array_merge($data, [
            'tenant_id'              => app('tenant')->id,
            'registered_by_user_id'  => $request->user()->id,
        ]));

        $this->audit->log('discount_card.created', $card);

        return response()->json($card, 201);
    }

    public function update(Request $request, DiscountCard $discountCard): JsonResponse
    {
        $this->authorizeTenant($discountCard);

        $data = $request->validate([
            'customer_name'        => ['sometimes', 'string', 'max:255'],
            'customer_birth_date'  => ['sometimes', 'nullable', 'date'],
            'customer_phone'       => ['sometimes', 'nullable', 'string', 'max:50'],
            'customer_email'       => ['sometimes', 'nullable', 'email', 'max:255'],
            'discount_percentage'  => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'is_active'            => ['sometimes', 'boolean'],
        ]);

        $discountCard->update($data);
        $this->audit->log('discount_card.updated', $discountCard, $data);

        return response()->json($discountCard);
    }

    public function destroy(DiscountCard $discountCard): JsonResponse
    {
        $this->authorizeTenant($discountCard);

        $this->audit->log('discount_card.deleted', $discountCard);
        $discountCard->delete();

        return response()->json(['message' => 'Discount card deleted.']);
    }

    /** Any staff taking an order can look up a card by number to offer the discount. */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate(['card_number' => ['required', 'string']]);

        $card = DiscountCard::where('tenant_id', app('tenant')->id)
            ->where('card_number', $request->card_number)
            ->where('is_active', true)
            ->first();

        abort_if(! $card, 404, 'No active discount card found with that number.');

        return response()->json($card);
    }

    private function authorizeTenant(DiscountCard $card): void
    {
        abort_if((int) $card->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
