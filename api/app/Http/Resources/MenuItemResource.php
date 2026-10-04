<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->menu_category_id ?? $this->category_id,
            'is_available' => $this->is_available,
            'is_featured' => $this->is_featured,
            // translation() resolves the current locale, falling back to 'en'
            // then whatever exists — ->translations->first() used to just
            // grab an arbitrary (insertion-order) row regardless of locale.
            'name' => $this->translation()?->name ?? 'Unnamed',
            'description' => $this->translation()?->description,
            'weight' => $this->weight,
            'tags' => $this->tags ?? [],
            'price' => $this->prices->first()?->price ?? $this->base_price ?? 0,
            'image_url' => $this->imageUrl(),
            'image_thumb_url' => $this->imageUrl('thumb'),
            'image_card_url' => $this->imageUrl('card'),
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'seo_og_image' => $this->seo_og_image,
            // Full multi-locale/multi-currency arrays, alongside the flattened
            // `name`/`description`/`price` above the list view and public pages
            // already rely on — the edit form is what actually reads these.
            'translations' => $this->whenLoaded('translations', fn () => $this->translations->map(fn ($t) => [
                'locale'      => $t->locale,
                'name'        => $t->name,
                'description' => $t->description,
                'ingredients' => $t->ingredients,
            ])),
            'prices' => $this->whenLoaded('prices', fn () => $this->prices->map(fn ($p) => [
                'currency' => $p->currency,
                'price'    => $p->price,
            ])),
        ];
    }
}
