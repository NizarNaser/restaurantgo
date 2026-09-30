<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\QrCode;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * A table QR code and a couple of sample dine-in orders in varying statuses
 * for "al-asala", so the Orders and Table QR Codes dashboard pages have
 * something real to show right after a fresh seed instead of looking empty.
 */
class DemoOrdersSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'al-asala')->first();
        if (! $tenant) {
            return;
        }

        $branch = $tenant->branches()->first();
        if (! $branch) {
            return;
        }

        $qrCode = QrCode::firstOrCreate(
            ['tenant_id' => $tenant->id, 'type' => QrCode::TYPE_TABLE, 'table_number' => '5'],
            ['branch_id' => $branch->id, 'target_url' => '']
        );
        if (! $qrCode->target_url) {
            $qrCode->update(['target_url' => rtrim(config('app.public_url'), '/') . '/p/' . $tenant->slug . '?qr=' . $qrCode->id]);
        }

        if (Order::where('tenant_id', $tenant->id)->exists()) {
            return;
        }

        $items = MenuItem::where('tenant_id', $tenant->id)->available()->take(2)->get();
        if ($items->isEmpty()) {
            return;
        }

        $sampleOrders = [
            ['status' => 'pending', 'customer_name' => 'Sara Al-Otaibi'],
            ['status' => 'preparing', 'customer_name' => 'Faisal Al-Harbi'],
        ];

        foreach ($sampleOrders as $sample) {
            $subtotal = 0;
            $order = Order::create([
                'tenant_id'      => $tenant->id,
                'branch_id'      => $branch->id,
                'qr_code_id'     => $qrCode->id,
                'table_number'   => $qrCode->table_number,
                'type'           => 'dine_in',
                'customer_name'  => $sample['customer_name'],
                'status'         => $sample['status'],
                'subtotal'       => 0,
                'total'          => 0,
                'currency'       => $tenant->default_currency ?? 'USD',
                'tracking_code'  => Str::upper(Str::random(8)),
            ]);

            foreach ($items as $item) {
                $unitPrice = $item->priceIn($order->currency);
                $lineSubtotal = round($unitPrice * 1, 2);
                $subtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id' => $item->id,
                    'name'         => $item->translation()?->name ?? $item->sku ?? 'Item',
                    'unit_price'   => $unitPrice,
                    'quantity'     => 1,
                    'subtotal'     => $lineSubtotal,
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);
        }
    }
}
