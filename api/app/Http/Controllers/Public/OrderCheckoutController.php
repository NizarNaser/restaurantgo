<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuItem;
use App\Models\Order;
use App\Services\Currency;
use App\Services\Payments\OrderPaymentGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrderCheckoutController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly OrderPaymentGateway $paymentGateway)
    {
    }

    /**
     * Delivery and pickup orders from the public site (dine-in goes through
     * Public\OrderController). Paid either online (Stripe checkout) or — if
     * the restaurant opted in — in cash at hand-over. Online ordering of
     * either kind still requires an active Connect account.
     */
    public function store(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        abort_if(! $tenant->hasActiveConnectAccount(), 422, "Online ordering isn't available for this restaurant yet.");

        $data = $request->validate([
            'items'                   => ['required', 'array', 'min:1'],
            'items.*.menu_item_id'    => ['required', 'integer'],
            'items.*.quantity'        => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes'           => ['nullable', 'string', 'max:500'],
            'customer_name'           => ['required', 'string', 'max:255'],
            'customer_phone'          => ['required', 'string', 'max:50'],
            'notes'                   => ['nullable', 'string', 'max:1000'],
            'branch_id'               => ['nullable', 'integer', 'exists:branches,id'],
            // Both optional so older clients keep getting online delivery.
            'type'                    => ['nullable', Rule::in([Order::TYPE_DELIVERY, Order::TYPE_PICKUP])],
            'payment_method'          => ['nullable', Rule::in([Order::PAYMENT_METHOD_ONLINE, Order::PAYMENT_METHOD_CASH])],
            'delivery_address_line'   => ['required_unless:type,' . Order::TYPE_PICKUP, 'nullable', 'string', 'max:255'],
            'delivery_city'           => ['required_unless:type,' . Order::TYPE_PICKUP, 'nullable', 'string', 'max:120'],
            'delivery_instructions'   => ['nullable', 'string', 'max:500'],
            'success_url'             => ['required_unless:payment_method,' . Order::PAYMENT_METHOD_CASH, 'nullable', 'url'],
            'cancel_url'              => ['required_unless:payment_method,' . Order::PAYMENT_METHOD_CASH, 'nullable', 'url'],
        ]);

        $type = $data['type'] ?? Order::TYPE_DELIVERY;
        $paymentMethod = $data['payment_method'] ?? Order::PAYMENT_METHOD_ONLINE;
        $isCash = $paymentMethod === Order::PAYMENT_METHOD_CASH;
        $isDelivery = $type === Order::TYPE_DELIVERY;

        abort_if($isCash && ! $tenant->acceptsCashOrders(), 422, "This restaurant doesn't accept cash payments.");

        $menuItems = MenuItem::where('tenant_id', $tenant->id)
            ->available()
            ->whereIn('id', collect($data['items'])->pluck('menu_item_id'))
            ->get()
            ->keyBy('id');

        abort_unless(
            collect($data['items'])->every(fn ($line) => $menuItems->has($line['menu_item_id'])),
            422,
            'One or more items are no longer available.'
        );

        $order = DB::transaction(function () use ($tenant, $menuItems, $data, $type, $paymentMethod, $isCash, $isDelivery) {
            $currency = $tenant->default_currency ?? 'USD';

            $order = Order::create([
                'tenant_id'              => $tenant->id,
                'branch_id'              => $data['branch_id'] ?? null,
                'qr_code_id'             => null,
                'table_number'           => null,
                'type'                   => $type,
                'source'                 => 'customer',
                'customer_name'          => $data['customer_name'],
                'customer_phone'         => $data['customer_phone'],
                'status'                 => 'pending',
                // A cash order goes to the kitchen right away; an online one
                // waits for the Stripe webhook.
                'payment_status'         => $isCash ? null : Order::PAYMENT_STATUS_PENDING,
                'payment_method'         => $paymentMethod,
                'notes'                  => $data['notes'] ?? null,
                'subtotal'               => 0,
                'total'                  => 0,
                'currency'               => $currency,
                'tracking_code'          => Str::upper(Str::random(8)),
                'delivery_address_line'  => $isDelivery ? $data['delivery_address_line'] : null,
                'delivery_city'          => $isDelivery ? $data['delivery_city'] : null,
                'delivery_instructions'  => $isDelivery ? ($data['delivery_instructions'] ?? null) : null,
            ]);

            $subtotal = 0;
            foreach ($data['items'] as $line) {
                $menuItem = $menuItems[$line['menu_item_id']];
                $unitPrice = $menuItem->priceIn($currency);
                $lineSubtotal = Currency::round($unitPrice * $line['quantity'], $currency);
                $subtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'name'         => $menuItem->translation()?->name ?? $menuItem->sku ?? 'Item',
                    'unit_price'   => $unitPrice,
                    'quantity'     => $line['quantity'],
                    'subtotal'     => $lineSubtotal,
                    'notes'        => $line['notes'] ?? null,
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);

            return $order;
        });

        $checkoutUrl = null;
        if (! $isCash) {
            $successUrl = rtrim($data['success_url'], '/') . '/' . $order->id . '?code=' . $order->tracking_code . '&payment=success';
            $checkoutUrl = $this->paymentGateway->createCheckoutUrl($tenant, $order->load('items'), $successUrl, $data['cancel_url']);
        }

        return response()->json([
            'order_id'      => $order->id,
            'tracking_code' => $order->tracking_code,
            'total'         => $order->total,
            'currency'      => $order->currency,
            'type'          => $order->type,
            'payment_method' => $order->payment_method,
            // Null for cash orders — the client goes straight to tracking.
            'checkout_url'  => $checkoutUrl,
        ], 201);
    }
}
