<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateTenantContentJob;
use App\Models\Article;
use App\Models\Department;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Powers the dashboard's Translations page: how complete each supported
 * language is across the menu/blog, and the button that kicks off AI
 * translation for a whole new language at once.
 */
class TranslationController extends Controller
{
    public function bulkTranslate(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'target_locale' => ['required', 'string', 'max:10', Rule::in($tenant->supported_locales ?? [])],
        ]);

        TranslateTenantContentJob::dispatch($tenant->id, $data['target_locale']);

        return response()->json(['message' => 'Translation started — this can take a few minutes.'], 202);
    }

    public function summary(): JsonResponse
    {
        $tenant   = app('tenant');
        $locales  = $tenant->supported_locales ?? [];
        $default  = $tenant->default_locale ?? 'en';

        $items       = MenuItem::forTenant($tenant->id)->with('translations')->get();
        $categories  = MenuCategory::where('tenant_id', $tenant->id)->with('translations')->get();
        $departments = Department::where('tenant_id', $tenant->id)->with('translations')->get();
        $articles    = Article::where('tenant_id', $tenant->id)->where('status', Article::STATUS_PUBLISHED)->with('translations')->get();

        $result = [];
        foreach ($locales as $locale) {
            $needsReview = [];

            $itemStats = $this->countFor($items, $locale, 'name', $needsReview, 'menu_item');
            $catStats  = $this->countFor($categories, $locale, 'name', $needsReview, 'menu_category');
            $deptStats = $this->countFor($departments, $locale, 'name', $needsReview, 'department');
            $artStats  = $this->countFor($articles, $locale, 'title', $needsReview, 'article');

            $result[] = [
                'locale'            => $locale,
                // The owner's declared "written in this language first"
                // locale — still shown with its own coverage (an item can
                // easily end up missing even its own source language, e.g.
                // one only ever entered in a different locale), just
                // labelled differently on the dashboard so it doesn't read
                // as "this language needs translating too".
                'is_default'        => $locale === $default,
                'menu_items'        => $itemStats,
                'menu_categories'   => $catStats,
                'departments'       => $deptStats,
                'articles'          => $artStats,
                'needs_review'      => $needsReview,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function markReviewed(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'   => ['required', Rule::in(['menu_item', 'menu_category', 'department', 'article'])],
            'id'     => ['required', 'integer'],
            'locale' => ['required', 'string', 'max:10'],
        ]);

        $tenant = app('tenant');

        $translation = match ($data['type']) {
            'menu_item'     => MenuItem::forTenant($tenant->id)->findOrFail($data['id'])->translations()->where('locale', $data['locale'])->firstOrFail(),
            'menu_category' => MenuCategory::where('tenant_id', $tenant->id)->findOrFail($data['id'])->translations()->where('locale', $data['locale'])->firstOrFail(),
            'department'    => Department::where('tenant_id', $tenant->id)->findOrFail($data['id'])->translations()->where('locale', $data['locale'])->firstOrFail(),
            'article'       => Article::where('tenant_id', $tenant->id)->findOrFail($data['id'])->translations()->where('locale', $data['locale'])->firstOrFail(),
        };

        $translation->update(['is_machine_translated' => false]);

        return response()->json(['message' => 'Marked as reviewed.']);
    }

    /**
     * @param  \Illuminate\Support\Collection  $models
     * @param  array<int, array<string, mixed>>  &$needsReview
     * @return array{total: int, translated: int, missing: int, needs_review: int}
     */
    private function countFor($models, string $locale, string $labelField, array &$needsReview, string $type): array
    {
        $total      = $models->count();
        $translated = 0;
        $review     = 0;

        foreach ($models as $model) {
            $translation = $model->translations->firstWhere('locale', $locale);
            if (! $translation) {
                continue;
            }
            $translated++;
            if ($translation->is_machine_translated) {
                $review++;
                $sourceTranslation = $model->translations->firstWhere('locale', 'en') ?? $model->translations->first();
                $needsReview[] = [
                    'type'   => $type,
                    'id'     => $model->id,
                    'locale' => $locale,
                    'name'   => $sourceTranslation?->{$labelField} ?? $translation->{$labelField},
                ];
            }
        }

        return [
            'total'        => $total,
            'translated'   => $translated,
            'missing'      => $total - $translated,
            'needs_review' => $review,
        ];
    }
}
