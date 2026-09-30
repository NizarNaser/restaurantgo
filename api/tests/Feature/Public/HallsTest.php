<?php

use App\Models\Hall;
use App\Models\Table;
use App\Models\Tenant;

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
});

it('lists a tenant\'s active halls publicly, with no auth needed', function () {
    Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall', 'sort_order' => 0]);
    Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Hidden Hall', 'sort_order' => 1, 'is_active' => false]);

    $response = $this->getJson('/api/v1/public/demo-restaurant/halls');

    $response->assertOk();
    $response->assertJsonCount(1);
    $response->assertJsonPath('0.name', 'Main Hall');
});

it('lists tables with status but without staff-only fields like who opened it or its bill', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $owner = \App\Models\User::where('email', 'owner@demo.com')->firstOrFail();
    Table::create([
        'tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T1',
        'status' => Table::STATUS_OCCUPIED, 'opened_by_user_id' => $owner->id, 'opened_at' => now(),
    ]);

    $response = $this->getJson("/api/v1/public/demo-restaurant/tables?hall_id={$hall->id}");

    $response->assertOk();
    $response->assertJsonPath('0.table_number', 'T1');
    $response->assertJsonPath('0.status', 'occupied');
    $response->assertJsonMissingPath('0.opened_by');
    $response->assertJsonMissingPath('0.current_order');
});

it('404s for a slug that does not resolve to a tenant', function () {
    $this->getJson('/api/v1/public/no-such-restaurant/halls')->assertNotFound();
});
