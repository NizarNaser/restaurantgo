<?php

use App\Jobs\TranslateTenantContentJob;
use App\Models\MenuCategory;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar', 'fr']]);
});

it('auto-dispatches missing-locale translations when creating a category', function () {
    Queue::fake();

    $this->postJson('/api/menu/categories', ['name' => 'Starters'])->assertCreated();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'fr');
});

it('auto-dispatches missing-locale translations when updating a category', function () {
    $category = MenuCategory::create(['tenant_id' => $this->owner->tenant_id, 'sort_order' => 0]);
    $category->translations()->create(['locale' => 'en', 'name' => 'Starters']);

    Queue::fake();

    $this->putJson("/api/menu/categories/{$category->id}", ['name' => 'Appetizers'])->assertOk();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
});

it('does not dispatch translation jobs once every supported locale already has a translation', function () {
    $category = MenuCategory::create(['tenant_id' => $this->owner->tenant_id, 'sort_order' => 0]);
    $category->translations()->createMany([
        ['locale' => 'en', 'name' => 'Starters'],
        ['locale' => 'ar', 'name' => 'المقبلات'],
        ['locale' => 'fr', 'name' => 'Entrées'],
    ]);

    Queue::fake();

    $this->putJson("/api/menu/categories/{$category->id}", ['name' => 'Appetizers'])->assertOk();

    Queue::assertNotPushed(TranslateTenantContentJob::class);
});
