<?php

use App\Jobs\TranslateTenantContentJob;
use App\Models\AuditLog;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);

    $category = MenuCategory::create([
        'tenant_id' => $this->owner->tenant_id,
        'sort_order' => 0,
        'is_active' => true,
    ]);

    $this->item = MenuItem::create([
        'tenant_id'         => $this->owner->tenant_id,
        'menu_category_id'  => $category->id,
        'base_price'        => 10,
    ]);
});

it('syncs translations for a menu item', function () {
    $response = $this->postJson("/api/menu/items/{$this->item->id}/translations", [
        'translations' => [
            ['locale' => 'ar', 'name' => 'بيتزا مارغريتا', 'description' => 'لذيذة'],
            ['locale' => 'en', 'name' => 'Margherita Pizza'],
        ],
    ]);

    $response->assertOk();
    expect($this->item->translations()->count())->toBe(2);
    expect($this->item->translations()->where('locale', 'ar')->first()->name)->toBe('بيتزا مارغريتا');
    expect(AuditLog::where('action', 'menu_item.translations_updated')->count())->toBe(1);
});

it('auto-dispatches translation for every supported locale the item is missing', function () {
    Queue::fake();
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar', 'fr']]);

    $this->postJson("/api/menu/items/{$this->item->id}/translations", [
        'translations' => [['locale' => 'en', 'name' => 'Margherita Pizza']],
    ])->assertOk();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'fr');
});

it('auto-dispatches missing-locale translations when creating a menu item', function () {
    Queue::fake();
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar']]);

    $this->postJson('/api/menu/items', [
        'menu_category_id' => $this->item->menu_category_id,
        'translations' => [['locale' => 'en', 'name' => 'New Dish']],
    ])->assertCreated();

    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
});

it('auto-dispatches missing-locale translations when updating a menu item', function () {
    Queue::fake();
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar']]);
    $this->item->translations()->create(['locale' => 'en', 'name' => 'Old Name']);

    $this->putJson("/api/menu/items/{$this->item->id}", [
        'menu_category_id' => $this->item->menu_category_id,
        'translations' => [['locale' => 'en', 'name' => 'Updated Name']],
    ])->assertOk();

    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
});

it('does not dispatch a translation job for a locale the item already has', function () {
    Queue::fake();
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar']]);
    $this->item->translations()->create(['locale' => 'ar', 'name' => 'بيتزا']);

    $this->postJson("/api/menu/items/{$this->item->id}/translations", [
        'translations' => [['locale' => 'en', 'name' => 'Margherita Pizza']],
    ])->assertOk();

    Queue::assertNotPushed(TranslateTenantContentJob::class);
});

it('updates an existing translation instead of duplicating it', function () {
    $this->item->translations()->create(['locale' => 'en', 'name' => 'Old Name']);

    $this->postJson("/api/menu/items/{$this->item->id}/translations", [
        'translations' => [['locale' => 'en', 'name' => 'New Name']],
    ])->assertOk();

    expect($this->item->translations()->count())->toBe(1);
    expect($this->item->translations()->first()->name)->toBe('New Name');
});

it('syncs multi-currency prices for a menu item', function () {
    $response = $this->putJson("/api/menu/items/{$this->item->id}/prices", [
        'prices' => [
            ['currency' => 'usd', 'price' => 15.5],
            ['currency' => 'EUR', 'price' => 14],
        ],
    ]);

    $response->assertOk();
    expect($this->item->prices()->count())->toBe(2);
    expect($this->item->prices()->where('currency', 'USD')->first()->price)->toEqual(15.5);
    expect(AuditLog::where('action', 'menu_item.prices_updated')->count())->toBe(1);
});

it('rejects translations/prices for a menu item belonging to another tenant', function () {
    $otherTenant = \App\Models\Tenant::create([
        'name' => 'Other', 'slug' => 'other-2', 'subdomain' => 'other2',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    $otherCategory = MenuCategory::create(['tenant_id' => $otherTenant->id, 'sort_order' => 0]);
    $otherItem = MenuItem::create(['tenant_id' => $otherTenant->id, 'menu_category_id' => $otherCategory->id, 'base_price' => 5]);

    // The tenant global scope makes another tenant's item invisible to route-model
    // binding itself, so the request 404s before the controller's own guard ever runs.
    $this->postJson("/api/menu/items/{$otherItem->id}/translations", [
        'translations' => [['locale' => 'en', 'name' => 'Nope']],
    ])->assertNotFound();

    $this->putJson("/api/menu/items/{$otherItem->id}/prices", [
        'prices' => [['currency' => 'USD', 'price' => 1]],
    ])->assertNotFound();
});
