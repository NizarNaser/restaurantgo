<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Plan;
use App\Models\Tenant;
use App\Services\InventoryService;

function makeCompletableOrder(): Order
{
    $tenant = Tenant::create([
        'name' => 'Inventory Test Tenant', 'slug' => 'inventory-test-' . uniqid(),
        'subdomain' => 'inventory-test-' . uniqid(),
        'plan_id' => Plan::firstOrCreate(['slug' => 'test-plan'], ['name' => 'Test Plan'])->id,
        'status' => 'active', 'default_locale' => 'en',
    ]);

    $order = Order::create([
        'tenant_id' => $tenant->id, 'type' => Order::TYPE_DINE_IN, 'source' => 'staff',
        'status' => 'pending', 'subtotal' => 20, 'total' => 20,
        'currency' => 'USD', 'tracking_code' => strtoupper(uniqid()),
    ]);

    OrderItem::create([
        'order_id' => $order->id, 'menu_item_id' => null, 'name' => 'Deleted item',
        'unit_price' => 20, 'quantity' => 1, 'subtotal' => 20,
    ]);

    return $order;
}

it('marks an order as stock-deducted exactly once', function () {
    $order = makeCompletableOrder();
    $service = app(InventoryService::class);

    $service->deductForOrder($order);

    expect($order->fresh()->stock_deducted_at)->not->toBeNull();
});

it('is a no-op when called again with the caller\'s already-stale in-memory copy', function () {
    // Mirrors the actual race: two calls each holding their own copy of the
    // order loaded before either one set stock_deducted_at — the second
    // call's in-memory check is stale, so the fix must re-check under a
    // fresh, locked read inside the transaction rather than trusting it.
    $order = makeCompletableOrder();
    $staleCopyA = Order::findOrFail($order->id);
    $staleCopyB = Order::findOrFail($order->id);
    $service = app(InventoryService::class);

    $service->deductForOrder($staleCopyA);
    $firstDeductedAt = $order->fresh()->stock_deducted_at;

    $service->deductForOrder($staleCopyB);
    $secondDeductedAt = $order->fresh()->stock_deducted_at;

    expect($firstDeductedAt)->not->toBeNull();
    expect($secondDeductedAt->eq($firstDeductedAt))->toBeTrue();
});
