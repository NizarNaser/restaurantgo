<?php

namespace Database\Seeders;

use App\Models\Advertisement;
use Illuminate\Database\Seeder;

/**
 * A few permanent demo ads for the homepage hero carousel (`home_hero`),
 * so the ad rotation/manual controls have something real to show instead
 * of falling back to the "advertise here" placeholder.
 */
class AdvertisementsSeeder extends Seeder
{
    public function run(): void
    {
        $ads = [
            [
                'title'           => 'مطعم الأصالة — عروض نهاية الأسبوع',
                'advertiser_name' => 'مطعم الأصالة',
                'link_url'        => 'http://localhost:5173/p/al-asala',
                'sort_order'      => 1,
            ],
            [
                'title'           => 'Le Gourmet Beirut — Rooftop Dinner Special',
                'advertiser_name' => 'Le Gourmet Beirut',
                'link_url'        => 'http://localhost:5173/p/le-gourmet-beirut',
                'sort_order'      => 2,
            ],
            [
                'title'           => 'Dubai Spice House — احجز طاولتك الآن',
                'advertiser_name' => 'Dubai Spice House',
                'link_url'        => 'http://localhost:5173/p/dubai-spice-house',
                'sort_order'      => 3,
            ],
        ];

        foreach ($ads as $ad) {
            Advertisement::firstOrCreate(
                ['placement' => 'home_hero', 'title' => $ad['title']],
                $ad + ['placement' => 'home_hero', 'is_active' => true, 'image_path' => null]
            );
        }
    }
}
