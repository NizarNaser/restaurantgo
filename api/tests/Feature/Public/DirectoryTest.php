<?php

beforeEach(function () {
    $this->seed();
});

it('lists active restaurants in the public directory', function () {
    $response = $this->getJson('/api/v1/directory/restaurants');

    $response->assertOk();
    $response->assertJsonFragment(['tenant_slug' => 'demo-restaurant', 'city' => 'Beirut']);
});

it('filters the directory by city', function () {
    $this->getJson('/api/v1/directory/restaurants?city=Beirut')
        ->assertOk()
        ->assertJsonFragment(['tenant_slug' => 'demo-restaurant']);

    $this->getJson('/api/v1/directory/restaurants?city=Nowhere')
        ->assertOk()
        ->assertJsonMissing(['tenant_slug' => 'demo-restaurant']);
});

it('returns country/city filter options', function () {
    $this->getJson('/api/v1/directory/filters')
        ->assertOk()
        ->assertJson(['LB' => ['Beirut']]);
});

it('ranks the top-rated restaurants by average rating, best first', function () {
    $response = $this->getJson('/api/v1/directory/top-rated?limit=3');

    $response->assertOk();
    $ratings = collect($response->json())->pluck('rating_average');

    expect($ratings->count())->toBeLessThanOrEqual(3);
    expect($ratings->values()->all())->toBe($ratings->sortDesc()->values()->all());
});
