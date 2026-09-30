<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\QrCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    use ResolvesPublicTenant;

    public function store(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        // A staff member previewing their own restaurant's public menu while
        // logged into the dashboard (e.g. via Settings > "Open Public Menu")
        // already has a known identity — don't ask them for a name/phone the
        // way an anonymous customer scanning a table's QR code would need to.
        $staffUser = $request->user('sanctum');
        $isStaffOrder = $staffUser && (int) $staffUser->tenant_id === (int) $tenant->id;

        $data = $request->validate([
            'qr_code_id' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'customer_name' => [$isStaffOrder ? 'nullable' : 'required', 'string', 'max:255'],
            'customer_phone' => [$isStaffOrder ? 'nullable' : 'required', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $qrCode = QrCode::where('id', $data['qr_code_id'])
            ->where('tenant_id', $tenant->id)
            ->where('type', QrCode::TYPE_TABLE)
            ->firstOrFail();

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

        $order = DB::transaction(function () use ($tenant, $qrCode, $menuItems, $data, $isStaffOrder, $staffUser) {
            $currency = $tenant->default_currency ?? 'USD';

            $order = Order::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $qrCode->branch_id,
                'qr_code_id' => $qrCode->id,
                'table_number' => $qrCode->table_number,
                'type' => 'dine_in',
                'source' => $isStaffOrder ? 'staff' : 'customer',
                'opened_by_user_id' => $isStaffOrder ? $staffUser->id : null,
                'customer_name' => $data['customer_name'] ?? ($isStaffOrder ? $staffUser->name : null),
                'customer_phone' => $data['customer_phone'] ?? null,
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
                'subtotal' => 0,
                'total' => 0,
                'currency' => $currency,
                'tracking_code' => Str::upper(Str::random(8)),
            ]);

            $subtotal = 0;
            foreach ($data['items'] as $line) {
                $menuItem = $menuItems[$line['menu_item_id']];
                $unitPrice = $menuItem->priceIn($currency);
                $lineSubtotal = round($unitPrice * $line['quantity'], 2);
                $subtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'name' => $menuItem->translation()?->name ?? $menuItem->sku ?? 'Item',
                    'unit_price' => $unitPrice,
                    'quantity' => $line['quantity'],
                    'subtotal' => $lineSubtotal,
                    'notes' => $line['notes'] ?? null,
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);

            return $order;
        });

        return response()->json([
            'order_id' => $order->id,
            'tracking_code' => $order->tracking_code,
            'status' => $order->status,
            'total' => $order->total,
            'currency' => $order->currency,
        ], 201);
    }

    public function show(string $slug, Order $order): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        abort_unless(
            (int) $order->tenant_id === (int) $tenant->id
                && hash_equals($order->tracking_code, (string) request()->query('code')),
            404
        );

        return response()->json([
            'order_id' => $order->id,
            'status' => $order->status,
            'total' => $order->total,
            'currency' => $order->currency,
            'type' => $order->type,
            'payment_status' => $order->payment_status,
            'delivery_address_line' => $order->delivery_address_line,
            'delivery_city' => $order->delivery_city,
            'delivery_instructions' => $order->delivery_instructions,
            'items' => $order->items->map(fn ($item) => [
                'name' => $item->name,
                'quantity' => $item->quantity,
                'subtotal' => $item->subtotal,
            ]),
        ]);
    }
}
