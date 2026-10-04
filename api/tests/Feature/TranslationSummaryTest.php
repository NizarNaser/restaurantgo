<?php

use App\Models\MenuCategory;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('includes the tenant\'s default locale in the translations summary, flagged as such', function () {
    // A Kyiv restaurant that writes content in Ukrainian first, also
    // supports English and Arabic — the dashboard's Translations page
    // previously dropped Ukrainian entirely since it's the default, which
    // read as "this restaurant only has two languages" even though it
    // configured three in Settings.
    $this->tenant->update(['default_locale' => 'uk', 'supported_locales' => ['uk', 'en', 'ar']]);
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0]);
    $category->translations()->create(['locale' => 'uk', 'name' => 'Закуски']);
    $category->translations()->create(['locale' => 'en', 'name' => 'Starters']);

    $response = $this->getJson('/api/translations/summary');

    $response->assertOk();
    $locales = collect($response->json('data'))->pluck('locale');
    expect($locales)->toContain('uk', 'en', 'ar');

    $uk = collect($response->json('data'))->firstWhere('locale', 'uk');
    expect($uk['is_default'])->toBeTrue();
    expect($uk['menu_categories']['translated'])->toBe(1);

    $en = collect($response->json('data'))->firstWhere('locale', 'en');
    expect($en['is_default'])->toBeFalse();

    $ar = collect($response->json('data'))->firstWhere('locale', 'ar');
    expect($ar['is_default'])->toBeFalse();
    // Arabic has no translation for this category yet — correctly flagged missing.
    expect($ar['menu_categories']['missing'])->toBe(1);
});
