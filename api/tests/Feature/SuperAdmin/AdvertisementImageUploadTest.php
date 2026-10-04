<?php

use App\Models\Advertisement;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('creates an advertisement with an uploaded image', function () {
    Storage::fake('public');

    $response = $this->post('/api/admin/advertisements', [
        'title'     => 'Weekend Brunch Promo',
        'placement' => 'home_hero',
        'image'     => UploadedFile::fake()->image('ad.jpg'),
    ]);

    $response->assertCreated();
    $url = $response->json('image_path');
    expect($url)->toContain('advertisements/');

    $path = parse_url($url, PHP_URL_PATH);
    $relative = preg_replace('#^/storage/#', '', $path);
    Storage::disk('public')->assertExists($relative);
});

it('still accepts a plain image URL when no file is uploaded', function () {
    $response = $this->postJson('/api/admin/advertisements', [
        'title'      => 'Weekend Brunch Promo',
        'placement'  => 'home_hero',
        'image_path' => 'https://example.com/already-hosted.jpg',
    ]);

    $response->assertCreated();
    expect($response->json('image_path'))->toBe('https://example.com/already-hosted.jpg');
});

it('replaces the old file on disk when updating with a new uploaded image', function () {
    Storage::fake('public');
    Storage::disk('public')->put('advertisements/old.jpg', 'old-contents');

    $ad = Advertisement::create([
        'title' => 'Existing Ad', 'placement' => 'home_hero',
        'image_path' => Storage::disk('public')->url('advertisements/old.jpg'),
    ]);

    $response = $this->post("/api/admin/advertisements/{$ad->id}", [
        '_method'   => 'PUT',
        'title'     => 'Existing Ad',
        'placement' => 'home_hero',
        'image'     => UploadedFile::fake()->image('new.jpg'),
    ]);

    $response->assertOk();
    Storage::disk('public')->assertMissing('advertisements/old.jpg');
    expect($response->json('image_path'))->not->toContain('old.jpg');
});
