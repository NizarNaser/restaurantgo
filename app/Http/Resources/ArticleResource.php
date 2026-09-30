<?php

namespace App\Http\Resources;

use App\Services\SeoService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $seo         = app(SeoService::class);
        $tenant      = $this->tenant ?? app('tenant');
        $translation = $this->translation();

        return [
            'id'              => $this->id,
            'branch_id'       => $this->branch_id,
            'status'          => $this->status,
            'publish_at'      => optional($this->publish_at)->toIso8601String(),
            'author'          => $this->whenLoaded('author', fn() => [
                'id'   => $this->author?->id,
                'name' => $this->author?->name,
            ]),
            'title'           => $translation?->title,
            'slug'            => $translation?->slug,
            'excerpt'         => $translation?->excerpt,
            'locale'          => $translation?->locale,
            'locales'         => $this->translations->pluck('locale'),
            'featured_image'  => $this->getFirstMediaUrl('featured_image') ?: null,
            'seo_title'       => $this->seo_title,
            'seo_description' => $this->seo_description,
            'seo_og_image'    => $this->seo_og_image,
            'url'             => $translation && $tenant ? $seo->articleUrl($tenant, $translation) : null,
            'translations'    => $this->translations->map(fn($t) => [
                'id'      => $t->id,
                'locale'  => $t->locale,
                'title'   => $t->title,
                'slug'    => $t->slug,
                'content' => $t->content,
                'excerpt' => $t->excerpt,
            ])->values(),
            'created_at'      => optional($this->created_at)->toIso8601String(),
            'updated_at'      => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
