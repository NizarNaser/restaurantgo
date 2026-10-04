<?php

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);

    $category = MenuCategory::create(['tenant_id' => $this->owner->tenant_id, 'sort_order' => 0, 'is_active' => true]);
    $this->item = MenuItem::create(['tenant_id' => $this->owner->tenant_id, 'menu_category_id' => $category->id, 'base_price' => 10]);
    $this->item->translations()->createMany([
        // Insertion order deliberately puts a non-requested locale first, so
        // a test that passed with ->translations->first() (the old,
        // locale-blind code) would still pass by coincidence — the
        // Accept-Language assertions below are what actually prove locale
        // resolution works.
        ['locale' => 'uk', 'name' => 'Омлет класичний'],
        ['locale' => 'en', 'name' => 'Classic Omelette'],
        ['locale' => 'ar', 'name' => 'أومليت كلاسيكي'],
    ]);
});

it('resolves a menu item\'s name to the Accept-Language locale, not just the first translation row', function () {
    $this->getJson('/api/menu/items', ['Accept-Language' => 'ar'])
        ->assertOk()
        ->assertJsonPath('data.0.name', 'أومليت كلاسيكي');

    $this->getJson('/api/menu/items', ['Accept-Language' => 'en'])
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Classic Omelette');
});

it('falls back to english when the requested locale has no translation', function () {
    $this->getJson('/api/menu/items', ['Accept-Language' => 'fr'])
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Classic Omelette');
});

it('falls back to whatever translation exists when neither the requested locale nor english is available', function () {
    $this->item->translations()->whereIn('locale', ['en', 'ar'])->delete();

    $this->getJson('/api/menu/items', ['Accept-Language' => 'fr'])
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Омлет класичний');
});
