<?php

use App\Jobs\TranslateTenantContentJob;
use App\Models\Article;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
    $this->owner->tenant->update(['supported_locales' => ['en', 'ar', 'fr']]);
});

it('auto-dispatches missing-locale translations when creating an article', function () {
    Queue::fake();

    $this->postJson('/api/articles', [
        'translations' => [
            ['locale' => 'en', 'title' => 'Our New Summer Menu', 'content' => '<p>Summer is here.</p>'],
        ],
    ])->assertCreated();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'fr');
});

it('auto-dispatches missing-locale translations when updating an article', function () {
    $article = Article::create(['tenant_id' => $this->owner->tenant_id, 'author_id' => $this->owner->id, 'status' => Article::STATUS_DRAFT]);
    $article->translations()->create(['locale' => 'en', 'title' => 'Our New Summer Menu', 'slug' => 'our-new-summer-menu', 'content' => '<p>Summer is here.</p>']);

    Queue::fake();

    $this->putJson("/api/articles/{$article->id}", [
        'translations' => [
            ['locale' => 'en', 'title' => 'Our New Summer Menu (Updated)', 'content' => '<p>Summer is really here.</p>'],
        ],
    ])->assertOk();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
});

it('does not dispatch translation jobs once every supported locale already has a translation', function () {
    $article = Article::create(['tenant_id' => $this->owner->tenant_id, 'author_id' => $this->owner->id, 'status' => Article::STATUS_DRAFT]);
    $article->translations()->createMany([
        ['locale' => 'en', 'title' => 'Our New Summer Menu', 'slug' => 'our-new-summer-menu', 'content' => '<p>Summer is here.</p>'],
        ['locale' => 'ar', 'title' => 'قائمة الصيف الجديدة', 'slug' => 'our-new-summer-menu-ar', 'content' => '<p>الصيف هنا.</p>'],
        ['locale' => 'fr', 'title' => 'Notre nouveau menu d\'été', 'slug' => 'our-new-summer-menu-fr', 'content' => '<p>L\'été est là.</p>'],
    ]);

    Queue::fake();

    $this->putJson("/api/articles/{$article->id}", [
        'translations' => [
            ['locale' => 'en', 'title' => 'Our New Summer Menu (Updated)', 'content' => '<p>Summer is really here.</p>'],
        ],
    ])->assertOk();

    Queue::assertNotPushed(TranslateTenantContentJob::class);
});
