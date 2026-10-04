<?php

use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('exposes the service charge settings', function () {
    $this->tenant->update([
        'service_charge_rate' => 10,
        'service_charge_message' => 'A 10% service charge applies.',
        'service_charge_show_message' => true,
        'service_charge_apply_to_invoice' => true,
    ]);

    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonPath('service_charge_rate', '10.00')
        ->assertJsonPath('service_charge_message', 'A 10% service charge applies.')
        ->assertJsonPath('service_charge_show_message', true)
        ->assertJsonPath('service_charge_apply_to_invoice', true);
});

it('saves the service charge settings', function () {
    $this->putJson('/api/settings', [
        'name' => $this->tenant->name,
        'timezone' => $this->tenant->timezone,
        'default_currency' => $this->tenant->default_currency,
        'default_locale' => $this->tenant->default_locale,
        'supported_locales' => $this->tenant->supported_locales ?: ['en'],
        'service_charge_rate' => 12.5,
        'service_charge_message' => 'A 12.5% service charge applies to dine-in orders.',
        'service_charge_show_message' => true,
        'service_charge_apply_to_invoice' => false,
    ])->assertOk();

    $this->tenant->refresh();
    expect((float) $this->tenant->service_charge_rate)->toBe(12.5);
    expect($this->tenant->service_charge_message)->toBe('A 12.5% service charge applies to dine-in orders.');
    expect($this->tenant->service_charge_show_message)->toBeTrue();
    expect($this->tenant->service_charge_apply_to_invoice)->toBeFalse();
});

it('rejects a service charge rate above 100', function () {
    $this->putJson('/api/settings', [
        'name' => $this->tenant->name,
        'timezone' => $this->tenant->timezone,
        'default_currency' => $this->tenant->default_currency,
        'default_locale' => $this->tenant->default_locale,
        'supported_locales' => $this->tenant->supported_locales ?: ['en'],
        'service_charge_rate' => 150,
    ])->assertStatus(422);
});
