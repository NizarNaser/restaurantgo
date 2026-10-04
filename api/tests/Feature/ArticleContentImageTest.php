<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('uploads an inline content image and returns its URL, with no article required', function () {
    Storage::fake('public');

    $response = $this->postJson('/api/articles/content-image', [
        'file' => UploadedFile::fake()->image('plate.jpg'),
    ]);

    $response->assertCreated();
    $url = $response->json('url');
    expect($url)->toContain("tenants/{$this->owner->tenant_id}/articles/content/");

    $path = parse_url($url, PHP_URL_PATH);
    $relative = preg_replace('#^/storage/#', '', $path);
    Storage::disk('public')->assertExists($relative);
});

it('rejects a non-image file', function () {
    Storage::fake('public');

    $this->postJson('/api/articles/content-image', [
        'file' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
    ])->assertStatus(422);
});
