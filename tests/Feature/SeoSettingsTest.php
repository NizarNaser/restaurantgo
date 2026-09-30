<?php

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemTranslation;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('saves a menu item\'s own SEO fields per locale', function () {
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);

    $response = $this->postJson('/api/menu/items', [
        'menu_category_id' => $category->id,
        'is_available'      => true,
        'translations'      => [['locale' => 'en', 'name' => 'Grilled Salmon']],
        'seo_title'         => ['en' => 'Grilled Salmon — Best in Town', 'ar' => 'سلمون مشوي — الأفضل في المدينة'],
        'seo_description'   => ['en' => 'Fresh Atlantic salmon, grilled to order.'],
        'seo_og_image'      => 'https://example.com/salmon.jpg',
    ]);

    $response->assertCreated();
    $item = MenuItem::findOrFail($response->json('id'));
    expect($item->seo_title)->toBe(['en' => 'Grilled Salmon — Best in Town', 'ar' => 'سلمون مشوي — الأفضل في المدينة']);
    expect($item->seo_description)->toBe(['en' => 'Fresh Atlantic salmon, grilled to order.']);
    expect($item->seo_og_image)->toBe('https://example.com/salmon.jpg');
});

it('rejects a plain string for a per-locale SEO field', function () {
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);

    $this->postJson('/api/menu/items', [
        'menu_category_id' => $category->id,
        'translations'      => [['locale' => 'en', 'name' => 'X']],
        'seo_title'         => 'Not an object',
    ])->assertStatus(422);
});

it('exposes a menu item\'s per-locale SEO fields back through the admin resource', function () {
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $item = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id, 'base_price' => 10,
        'seo_title' => ['en' => 'Custom Title', 'ar' => 'عنوان مخصص'], 'seo_description' => ['en' => 'Custom description'], 'seo_og_image' => 'https://example.com/x.jpg',
    ]);

    $response = $this->getJson('/api/menu/items?per_page=50');
    $response->assertOk();
    $payload = collect($response->json('data'))->firstWhere('id', $item->id);
    expect($payload['seo_title'])->toBe(['en' => 'Custom Title', 'ar' => 'عنوان مخصص']);
    expect($payload['seo_description'])->toBe(['en' => 'Custom description']);
    expect($payload['seo_og_image'])->toBe('https://example.com/x.jpg');
});

it('prefers a menu item\'s own SEO fields on its public detail page, falling back otherwise', function () {
    $this->tenant->update(['supported_locales' => ['en', 'ar']]);
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);

    $withSeo = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id, 'base_price' => 10, 'is_available' => true,
        'seo_title' => ['en' => 'Custom SEO Title', 'ar' => 'عنوان سيو مخصص'],
        'seo_description' => ['en' => 'Custom SEO description', 'ar' => 'وصف سيو مخصص'],
        'seo_og_image' => 'https://example.com/custom.jpg',
    ]);
    MenuItemTranslation::create(['menu_item_id' => $withSeo->id, 'locale' => 'en', 'name' => 'Plain Name', 'description' => 'Plain description']);

    $withoutSeo = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id, 'base_price' => 10, 'is_available' => true,
    ]);
    MenuItemTranslation::create(['menu_item_id' => $withoutSeo->id, 'locale' => 'en', 'name' => 'Fallback Name', 'description' => 'Fallback description']);

    $withSeoResponse = $this->getJson("/api/v1/public/{$this->tenant->slug}/menu/items/{$withSeo->id}");
    $withSeoResponse->assertOk();
    expect($withSeoResponse->json('seo.title'))->toBe('Custom SEO Title');
    expect($withSeoResponse->json('seo.description'))->toBe('Custom SEO description');
    expect($withSeoResponse->json('seo.og.og:image'))->toBe('https://example.com/custom.jpg');

    // Asking in a different locale returns that locale's own copy.
    $arResponse = $this->getJson("/api/v1/public/{$this->tenant->slug}/menu/items/{$withSeo->id}?lang=ar");
    $arResponse->assertOk();
    expect($arResponse->json('seo.title'))->toBe('عنوان سيو مخصص');

    $withoutSeoResponse = $this->getJson("/api/v1/public/{$this->tenant->slug}/menu/items/{$withoutSeo->id}");
    $withoutSeoResponse->assertOk();
    expect($withoutSeoResponse->json('seo.title'))->toContain('Fallback Name');
    expect($withoutSeoResponse->json('seo.description'))->toBe('Fallback description');
});

it('lets an owner save and read back the tenant\'s per-locale SEO copy and Google Search Console verification code', function () {
    $response = $this->putJson('/api/settings', [
        'name' => $this->tenant->name,
        'timezone' => $this->tenant->timezone ?? 'UTC',
        'default_currency' => $this->tenant->default_currency ?? 'USD',
        'default_locale' => 'en',
        'supported_locales' => ['en', 'ar'],
        'seo_title' => ['en' => 'My Restaurant', 'ar' => 'مطعمي'],
        'seo_description' => ['en' => 'The best food in town.', 'ar' => 'ألذ طعام في المدينة.'],
        'google_site_verification' => 'abc123verificationcode',
    ]);

    $response->assertOk();
    expect($this->tenant->fresh()->google_site_verification)->toBe('abc123verificationcode');
    expect($this->tenant->fresh()->seo_title)->toBe(['en' => 'My Restaurant', 'ar' => 'مطعمي']);

    $show = $this->getJson('/api/settings');
    $show->assertOk();
    $show->assertJsonPath('google_site_verification', 'abc123verificationcode');
    $show->assertJsonPath('seo_title.ar', 'مطعمي');
});

it('renders the tenant\'s Google verification code and locale-matched SEO copy into the public menu payload', function () {
    $this->tenant->update([
        'google_site_verification' => 'tenant-verify-xyz',
        'seo_title' => ['en' => 'English Title', 'ar' => 'عنوان عربي'],
        'supported_locales' => ['en', 'ar'],
    ]);

    $response = $this->getJson("/api/v1/public/{$this->tenant->slug}/menu?lang=ar");
    $response->assertOk();
    $response->assertJsonPath('seo.google_site_verification', 'tenant-verify-xyz');
    expect($response->json('seo.title'))->toContain('عنوان عربي');
});
