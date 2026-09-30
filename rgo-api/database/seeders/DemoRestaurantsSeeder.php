<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Plan;
use App\Models\Review;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * A handful of additional, varied tenants purely so the public directory
 * (browse by country/city) and each restaurant's own public page have
 * something realistic to show: a mapped location, a couple of signature
 * dishes, and a few written reviews alongside the star-only ones.
 */
class DemoRestaurantsSeeder extends Seeder
{
    public function run(): void
    {
        $starter = Plan::where('slug', 'starter')->firstOrFail();
        $pro = Plan::where('slug', 'pro')->firstOrFail();

        $restaurants = [
            [
                'name' => 'مطعم الأصالة', 'slug' => 'al-asala', 'subdomain' => 'al-asala', 'plan' => $pro,
                'seo_description' => 'مأكولات سعودية أصيلة بأجواء تراثية فاخرة في قلب الرياض.',
                'address' => 'شارع التحلية', 'city' => 'الرياض', 'country' => 'SA', 'phone' => '+966 11 234 5678',
                'lat' => 24.7136, 'lng' => 46.6753,
                'reviews' => [
                    [5, 'أجواء رائعة والطعام أصيل جدًا، أنصح بالكبسة!'],
                    [5, 'خدمة ممتازة وسريعة.'],
                    [4, null],
                    [5, 'المكان مناسب جدًا للعائلات.'],
                ],
                'dishes' => [
                    ['كبسة لحم غنم', 22.00, true],
                    ['مندي دجاج', 18.50, true],
                    ['قهوة عربية وتمر', 6.00, false],
                ],
            ],
            [
                'name' => 'Le Gourmet Beirut', 'slug' => 'le-gourmet-beirut', 'subdomain' => 'le-gourmet', 'plan' => $pro,
                'seo_description' => 'French-Lebanese fusion cuisine with a rooftop view over Beirut.',
                'address' => 'Hamra Street', 'city' => 'Beirut', 'country' => 'LB', 'phone' => '+961 1 987 654',
                'lat' => 33.8938, 'lng' => 35.5018,
                'reviews' => [
                    [5, 'Best rooftop dinner in Beirut, hands down.'],
                    [4, 'Lovely fusion menu, a bit pricey.'],
                    [5, null],
                ],
                'dishes' => [
                    ['Duck Confit', 32.00, true],
                    ['Truffle Risotto', 26.00, true],
                    ['Lebanese Mezze Platter', 19.00, false],
                ],
            ],
            [
                'name' => 'Dubai Spice House', 'slug' => 'dubai-spice-house', 'subdomain' => 'dubai-spice', 'plan' => $starter,
                'seo_description' => 'Bold Indian and Emirati spice blends in the heart of Downtown Dubai.',
                'address' => 'Sheikh Zayed Road', 'city' => 'Dubai', 'country' => 'AE', 'phone' => '+971 4 123 4567',
                'lat' => 25.2048, 'lng' => 55.2708,
                'reviews' => [
                    [4, 'Great flavors, generous portions.'],
                    [5, 'The biryani is unbeatable.'],
                    [4, null],
                    [4, null],
                    [5, 'Will definitely come back with friends.'],
                ],
                'dishes' => [
                    ['Butter Chicken', 16.00, true],
                    ['Lamb Biryani', 18.00, true],
                    ['Saffron Kunafa', 9.00, false],
                ],
            ],
            [
                'name' => 'Cairo Nile Bites', 'slug' => 'cairo-nile-bites', 'subdomain' => 'nile-bites', 'plan' => $starter,
                'seo_description' => 'أكلات مصرية شعبية أصيلة بإطلالة على النيل.',
                'address' => 'Corniche El Nil', 'city' => 'Cairo', 'country' => 'EG', 'phone' => '+20 2 555 1234',
                'lat' => 30.0444, 'lng' => 31.2357,
                'reviews' => [
                    [4, 'الكشري لذيذ جدًا وبسعر مناسب.'],
                    [3, 'الخدمة كانت بطيئة بعض الشيء.'],
                    [4, null],
                ],
                'dishes' => [
                    ['كشري مصري', 5.50, true],
                    ['ملوخية بالأرانب', 12.00, true],
                    ['أم علي', 4.50, false],
                ],
            ],
            [
                'name' => 'Istanbul Kebab Corner', 'slug' => 'istanbul-kebab-corner', 'subdomain' => 'istanbul-kebab', 'plan' => $starter,
                'seo_description' => 'Traditional Turkish kebabs and mezze in the Sultanahmet district.',
                'address' => 'Sultanahmet Meydanı', 'city' => 'Istanbul', 'country' => 'TR', 'phone' => '+90 212 555 0199',
                'lat' => 41.0082, 'lng' => 28.9784,
                'reviews' => [
                    [5, 'Authentic Adana kebab, just like home.'],
                    [5, null],
                    [5, 'Cozy place near Sultanahmet, loved it.'],
                    [4, null],
                ],
                'dishes' => [
                    ['Adana Kebab', 14.00, true],
                    ['Lahmacun', 7.00, true],
                    ['Baklava', 6.00, false],
                ],
            ],
            [
                'name' => 'Amman Garden Restaurant', 'slug' => 'amman-garden', 'subdomain' => 'amman-garden', 'plan' => $starter,
                'seo_description' => 'مطعم عائلي بحديقة خارجية يقدم المأكولات الأردنية التقليدية.',
                'address' => 'شارع الرينبو', 'city' => 'عمّان', 'country' => 'JO', 'phone' => '+962 6 456 7890',
                'lat' => 31.9454, 'lng' => 35.9284,
                'reviews' => [
                    [4, 'المنسف الأصلي بطعم البيت.'],
                    [4, null],
                    [5, 'حديقة جميلة ومكان هادئ.'],
                ],
                'dishes' => [
                    ['منسف أردني', 17.00, true],
                    ['ورق عنب', 8.00, true],
                    ['كنافة نابلسية', 6.50, false],
                ],
            ],
            [
                'name' => 'Casablanca Riad Kitchen', 'slug' => 'casablanca-riad', 'subdomain' => 'casa-riad', 'plan' => $starter,
                'seo_description' => 'Moroccan tagines and pastries served in a restored riad courtyard.',
                'address' => 'Ancienne Medina', 'city' => 'Casablanca', 'country' => 'MA', 'phone' => '+212 5 22 12 34 56',
                'lat' => 33.5731, 'lng' => -7.5898,
                'reviews' => [
                    [5, 'Beautiful riad courtyard, the tagine was superb.'],
                    [4, null],
                ],
                'dishes' => [
                    ['Chicken Tagine', 15.00, true],
                    ['Couscous Royal', 17.00, true],
                    ['Moroccan Mint Tea & Pastries', 5.00, false],
                ],
            ],
            [
                'name' => 'Jeddah Seafood House', 'slug' => 'jeddah-seafood-house', 'subdomain' => 'jeddah-seafood', 'plan' => $starter,
                'seo_description' => 'مأكولات بحرية طازجة على واجهة كورنيش جدة.',
                'address' => 'كورنيش جدة', 'city' => 'جدة', 'country' => 'SA', 'phone' => '+966 12 234 5678',
                'lat' => 21.4858, 'lng' => 39.1925,
                'reviews' => [
                    [5, 'أطيب سمك هامور جربته في جدة.'],
                    [4, null],
                    [5, 'إطلالة رائعة على البحر مع العشاء.'],
                ],
                'dishes' => [
                    ['سمك هامور مشوي', 28.00, true],
                    ['روبيان بالثوم', 24.00, true],
                    ['سمبوسة جمبري', 9.00, false],
                ],
            ],
            [
                'name' => 'Manama Pearl Restaurant', 'slug' => 'manama-pearl', 'subdomain' => 'manama-pearl', 'plan' => $starter,
                'seo_description' => 'Bahraini and Gulf specialties in the heart of Manama souq.',
                'address' => 'Bab Al Bahrain Avenue', 'city' => 'Manama', 'country' => 'BH', 'phone' => '+973 1 700 1234',
                'lat' => 26.2285, 'lng' => 50.5860,
                'reviews' => [
                    [4, 'Great machboos, very authentic.'],
                    [5, null],
                    [4, 'Friendly staff and cozy seating.'],
                ],
                'dishes' => [
                    ['Machboos Laham', 19.00, true],
                    ['Muhammar Rice', 10.00, true],
                    ['Balaleet', 7.00, false],
                ],
            ],
            [
                'name' => 'Baghdad Tigris Kitchen', 'slug' => 'baghdad-tigris-kitchen', 'subdomain' => 'tigris-kitchen', 'plan' => $starter,
                'seo_description' => 'مطعم عراقي تقليدي على ضفاف دجلة يقدم المسقوف والدولمة.',
                'address' => 'شارع أبو نواس', 'city' => 'بغداد', 'country' => 'IQ', 'phone' => '+964 1 234 5678',
                'lat' => 33.3152, 'lng' => 44.3661,
                'reviews' => [
                    [5, 'المسقوف بطعم أصيل ما يتعوض.'],
                    [4, null],
                    [5, 'أجواء عائلية رائعة على النهر.'],
                ],
                'dishes' => [
                    ['مسقوف سمك', 20.00, true],
                    ['دولمة عراقية', 13.00, true],
                    ['قيمر بعسل', 6.00, false],
                ],
            ],
            [
                'name' => 'Muscat Omani Table', 'slug' => 'muscat-omani-table', 'subdomain' => 'muscat-omani', 'plan' => $starter,
                'seo_description' => 'Traditional Omani shuwa and halwa served with a view of Muscat harbor.',
                'address' => 'Muttrah Corniche', 'city' => 'Muscat', 'country' => 'OM', 'phone' => '+968 24 123 456',
                'lat' => 23.5859, 'lng' => 58.4059,
                'reviews' => [
                    [5, 'The shuwa was slow-cooked to perfection.'],
                    [4, null],
                    [5, 'Beautiful harbor view, great service.'],
                ],
                'dishes' => [
                    ['Shuwa', 22.00, true],
                    ['Omani Halwa', 6.00, true],
                    ['Majboos Samak', 17.00, false],
                ],
            ],
            [
                'name' => 'La Table Tunisoise', 'slug' => 'la-table-tunisoise', 'subdomain' => 'table-tunisoise', 'plan' => $starter,
                'seo_description' => 'Authentic Tunisian couscous and brik in the old Medina of Tunis.',
                'address' => 'Rue de la Kasbah', 'city' => 'Tunis', 'country' => 'TN', 'phone' => '+216 71 123 456',
                'lat' => 36.8065, 'lng' => 10.1815,
                'reviews' => [
                    [4, 'Lovely brik and harissa, very spicy!'],
                    [5, null],
                    [4, 'Charming courtyard seating in the Medina.'],
                ],
                'dishes' => [
                    ['Couscous Poisson', 16.00, true],
                    ['Brik à l\'oeuf', 5.50, true],
                    ['Makroudh', 4.00, false],
                ],
            ],
        ];

        foreach ($restaurants as $r) {
            $tenant = Tenant::firstOrCreate(['slug' => $r['slug']], [
                'name'             => $r['name'],
                'plan_id'          => $r['plan']->id,
                'subdomain'        => $r['subdomain'],
                'status'           => 'active',
                'trial_ends_at'    => now()->addDays(14),
                'default_currency' => 'USD',
                // seo_description is now stored per locale — this seed data
                // is written in whichever language actually matches the
                // sample restaurant, so infer it rather than hardcoding one.
                'seo_description'  => [(preg_match('/\p{Arabic}/u', $r['seo_description']) ? 'ar' : 'en') => $r['seo_description']],
            ]);

            $owner = User::firstOrCreate([
                'email' => "owner@{$r['subdomain']}.com",
            ], [
                'name'      => $r['name'].' Owner',
                'tenant_id' => $tenant->id,
                'password'  => Hash::make('password'),
                'is_active' => true,
            ]);
            if (! $owner->hasRole('owner')) {
                $owner->assignRole('owner');
            }

            $branch = Branch::firstOrCreate([
                'tenant_id' => $tenant->id,
                'name'      => 'Main Branch',
            ], [
                'address'   => $r['address'],
                'city'      => $r['city'],
                'country'   => $r['country'],
                'phone'     => $r['phone'],
                'latitude'  => $r['lat'],
                'longitude' => $r['lng'],
                'is_active' => true,
            ]);

            if (Review::where('tenant_id', $tenant->id)->doesntExist()) {
                foreach ($r['reviews'] as $i => [$rating, $comment]) {
                    Review::create([
                        'tenant_id'     => $tenant->id,
                        'branch_id'     => $branch->id,
                        'customer_name' => 'Guest '.($i + 1),
                        'rating'        => $rating,
                        'comment'       => $comment,
                        'is_approved'   => true,
                    ]);
                }
            }

            if (MenuItem::where('tenant_id', $tenant->id)->doesntExist()) {
                $category = MenuCategory::create([
                    'tenant_id'  => $tenant->id,
                    'branch_id'  => $branch->id,
                    'sort_order' => 0,
                    'is_active'  => true,
                ]);

                foreach ($r['dishes'] as $i => [$name, $price, $featured]) {
                    $item = MenuItem::create([
                        'tenant_id'        => $tenant->id,
                        'menu_category_id' => $category->id,
                        'base_price'       => $price,
                        'is_available'     => true,
                        'is_featured'      => $featured,
                        'sort_order'       => $i,
                    ]);

                    $item->translations()->create([
                        'locale' => 'ar', 'name' => $name,
                    ]);
                    $item->translations()->create([
                        'locale' => 'en', 'name' => $name,
                    ]);
                }
            }
        }
    }
}
