<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuItem;
use App\Models\Order;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderCheckoutController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly StripeService $stripe)
    {
    }

    /**
     * Delivery is the only order type paid for online today — dine-in stays
     * cash/pay-at-table via Public\OrderController, and takeout was dropped
     * from scope, so `type` isn't a client input here.
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
            'delivery_address_line'   => ['required', 'string', 'max:255'],
            'delivery_city'           => ['required', 'string', 'max:120'],
            'delivery_instructions'   => ['nullable', 'string', 'max:500'],
            'success_url'             => ['required', 'url'],
            'cancel_url'              => ['required', 'url'],
        ]);

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

        $order = DB::transaction(function () use ($tenant, $menuItems, $data) {
            $currency = $tenant->default_currency ?? 'USD';

            $order = Order::create([
                'tenant_id'              => $tenant->id,
                'branch_id'              => $data['branch_id'] ?? null,
                'qr_code_id'             => null,
                'table_number'           => null,
                'type'                   => Order::TYPE_DELIVERY,
                'source'                 => 'customer',
                'customer_name'          => $data['customer_name'],
                'customer_phone'         => $data['customer_phone'],
                'status'                 => 'pending',
                'payment_status'         => Order::PAYMENT_STATUS_PENDING,
                'notes'                  => $data['notes'] ?? null,
                'subtotal'               => 0,
                'total'                  => 0,
                'currency'               => $currency,
                'tracking_code'          => Str::upper(Str::random(8)),
                'delivery_address_line'  => $data['delivery_address_line'],
                'delivery_city'          => $data['delivery_city'],
                'delivery_instructions'  => $data['delivery_instructions'] ?? null,
            ]);

            $subtotal = 0;
            foreach ($data['items'] as $line) {
                $menuItem = $menuItems[$line['menu_item_id']];
                $unitPrice = $menuItem->priceIn($currency);
                $lineSubtotal = round($unitPrice * $line['quantity'], 2);
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

        $successUrl = rtrim($data['success_url'], '/') . '/' . $order->id . '?code=' . $order->tracking_code . '&payment=success';

        $session = $this->stripe->createOrderCheckoutSession($tenant, $order->load('items'), $successUrl, $data['cancel_url']);

        return response()->json([
            'order_id'      => $order->id,
            'tracking_code' => $order->tracking_code,
            'total'         => $order->total,
            'currency'      => $order->currency,
            'checkout_url'  => $session->url,
        ], 201);
    }
}
