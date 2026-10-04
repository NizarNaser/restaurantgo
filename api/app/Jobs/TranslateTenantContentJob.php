<?php

namespace App\Jobs;

use App\Models\Article;
use App\Models\Department;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Tenant;
use App\Services\OpenAiService;
use App\Services\SeoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Fills in the one missing language for every menu item, menu category, and
 * published article a tenant already has — dispatched either from a single
 * item's "translate to all languages" button, or once when the owner adds a
 * new language in Settings. Runs on the queue (not inline in the request)
 * because translating dozens of rows means dozens of real OpenAI API
 * calls, easily taking minutes.
 *
 * IMPORTANT: this runs outside any HTTP request, so the `tenant` container
 * binding BelongsToTenant relies on is never set here — every query below
 * filters by tenant_id explicitly instead of depending on the global scope.
 */
class TranslateTenantContentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const MENU_ITEM_PROMPT = <<<'PROMPT'
        You translate restaurant menu copy (an item's name and description) from one language to another. Preserve tone, and don't translate proper nouns or dish names that are conventionally kept in their original language (e.g. "Margherita", "Pad Thai"). Respond with ONLY a valid JSON object of the exact shape {"name": "...", "description": "..."} — no prose, no markdown code fences, nothing else.
        PROMPT;

    private const MENU_CATEGORY_PROMPT = <<<'PROMPT'
        You translate a restaurant menu's section/category name (e.g. "Starters", "Desserts") from one language to another — keep it short and idiomatic, the way a native menu in the target language would phrase it. Respond with ONLY a valid JSON object of the exact shape {"name": "..."} — no prose, no markdown code fences, nothing else.
        PROMPT;

    private const ARTICLE_PROMPT = <<<'PROMPT'
        You translate a restaurant's blog post (title, HTML body, and optional excerpt) from one language to another. Preserve the HTML tags in the body exactly, translating only the text content. Preserve tone and any proper nouns (restaurant name, dish names conventionally kept in their original language). Respond with ONLY a valid JSON object of the exact shape {"title": "...", "content": "...", "excerpt": "..."} (excerpt may be an empty string) — no prose, no markdown code fences, nothing else.
        PROMPT;

    private const DEPARTMENT_PROMPT = <<<'PROMPT'
        You translate a restaurant's internal kitchen/bar department name (e.g. "Kitchen", "Bar", "Pastry") from one language to another — keep it short and idiomatic. Respond with ONLY a valid JSON object of the exact shape {"name": "..."} — no prose, no markdown code fences, nothing else.
        PROMPT;

    public function __construct(
        public readonly int $tenantId,
        public readonly string $targetLocale,
    ) {}

    /**
     * Dispatch one job per locale the tenant supports that this menu item,
     * category, or department doesn't have a translation row for yet —
     * called right after it's created or its translations are edited, so a
     * restaurant's menu ends up in every language it's configured for
     * without the owner having to separately visit Settings or translate
     * each row by hand.
     *
     * @param  \App\Models\MenuItem|\App\Models\MenuCategory|\App\Models\Department  $model  must already have a fresh (non-stale) `translations` relation loaded
     */
    public static function dispatchForMissingLocales(Tenant $tenant, $model): void
    {
        $have    = $model->translations->pluck('locale')->all();
        $missing = array_diff($tenant->supported_locales ?? [], $have);

        foreach ($missing as $locale) {
            self::dispatch($tenant->id, $locale);
        }
    }

    public function handle(OpenAiService $openai, SeoService $seo): void
    {
        if (! $openai->isConfigured()) {
            // Otherwise this job just vanishes with nothing to show for it —
            // the tenant's menu/blog silently stays untranslated into
            // $targetLocale with no error anywhere a human would see it.
            Log::warning('TranslateTenantContentJob: skipped, AI assistant is not configured', [
                'tenant_id' => $this->tenantId,
                'locale'    => $this->targetLocale,
            ]);

            return;
        }

        $this->translateMenuItems($openai);
        $this->translateMenuCategories($openai);
        $this->translateDepartments($openai);
        $this->translateArticles($openai, $seo);
    }

    private function translateMenuItems(OpenAiService $openai): void
    {
        MenuItem::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->with('translations')
            ->chunkById(20, function ($items) use ($openai) {
                foreach ($items as $item) {
                    if ($item->translations->contains('locale', $this->targetLocale)) {
                        continue;
                    }
                    $source = $item->translations->firstWhere('locale', 'en') ?? $item->translations->first();
                    if (! $source) {
                        continue;
                    }

                    $result = $this->translate($openai, self::MENU_ITEM_PROMPT, [
                        'source_locale' => $source->locale,
                        'target_locale' => $this->targetLocale,
                        'name'          => $source->name,
                        'description'   => $source->description,
                    ]);
                    if (! $result || ! isset($result['name'])) {
                        continue;
                    }

                    $item->translations()->create([
                        'locale'                => $this->targetLocale,
                        'name'                   => $result['name'],
                        'description'            => $result['description'] ?? null,
                        'is_machine_translated' => true,
                    ]);
                }
            });
    }

    private function translateMenuCategories(OpenAiService $openai): void
    {
        MenuCategory::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->with('translations')
            ->chunkById(20, function ($categories) use ($openai) {
                foreach ($categories as $category) {
                    if ($category->translations->contains('locale', $this->targetLocale)) {
                        continue;
                    }
                    $source = $category->translations->firstWhere('locale', 'en') ?? $category->translations->first();
                    if (! $source) {
                        continue;
                    }

                    $result = $this->translate($openai, self::MENU_CATEGORY_PROMPT, [
                        'source_locale' => $source->locale,
                        'target_locale' => $this->targetLocale,
                        'name'          => $source->name,
                    ]);
                    if (! $result || ! isset($result['name'])) {
                        continue;
                    }

                    $category->translations()->create([
                        'locale'                => $this->targetLocale,
                        'name'                   => $result['name'],
                        'is_machine_translated' => true,
                    ]);
                }
            });
    }

    private function translateDepartments(OpenAiService $openai): void
    {
        Department::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->with('translations')
            ->chunkById(20, function ($departments) use ($openai) {
                foreach ($departments as $department) {
                    if ($department->translations->contains('locale', $this->targetLocale)) {
                        continue;
                    }
                    $source = $department->translations->firstWhere('locale', 'en') ?? $department->translations->first();
                    if (! $source) {
                        continue;
                    }

                    $result = $this->translate($openai, self::DEPARTMENT_PROMPT, [
                        'source_locale' => $source->locale,
                        'target_locale' => $this->targetLocale,
                        'name'          => $source->name,
                    ]);
                    if (! $result || ! isset($result['name'])) {
                        continue;
                    }

                    $department->translations()->create([
                        'locale'                => $this->targetLocale,
                        'name'                   => $result['name'],
                        'is_machine_translated' => true,
                    ]);
                }
            });
    }

    private function translateArticles(OpenAiService $openai, SeoService $seo): void
    {
        Article::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->where('status', Article::STATUS_PUBLISHED)
            ->with('translations')
            ->chunkById(20, function ($articles) use ($openai, $seo) {
                foreach ($articles as $article) {
                    if ($article->translations->contains('locale', $this->targetLocale)) {
                        continue;
                    }
                    $source = $article->translations->firstWhere('locale', 'en') ?? $article->translations->first();
                    if (! $source) {
                        continue;
                    }

                    $result = $this->translate($openai, self::ARTICLE_PROMPT, [
                        'source_locale' => $source->locale,
                        'target_locale' => $this->targetLocale,
                        'title'         => $source->title,
                        'content'       => $source->content,
                        'excerpt'       => $source->excerpt,
                    ]);
                    if (! $result || ! isset($result['title'], $result['content'])) {
                        continue;
                    }

                    $article->translations()->create([
                        'locale'                => $this->targetLocale,
                        'title'                  => $result['title'],
                        'slug'                   => $seo->uniqueSlug($this->tenantId, $result['title']),
                        'content'                => $result['content'],
                        'excerpt'                => $result['excerpt'] ?? null,
                        'is_machine_translated' => true,
                    ]);
                }
            });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function translate(OpenAiService $openai, string $systemPrompt, array $payload): ?array
    {
        try {
            $message = collect($payload)->map(fn($v, $k) => ucfirst(str_replace('_', ' ', $k)).': '.($v ?? ''))->implode("\n");
            $reply   = $openai->chat([['role' => 'user', 'content' => $message]], $systemPrompt);
            $decoded = json_decode($reply, true);

            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable $e) {
            // One item failing to translate (rate limit, malformed reply,
            // API hiccup) shouldn't stop the rest of the tenant's content
            // from being translated — just skip it and move on.
            Log::warning('TranslateTenantContentJob: skipped one row', [
                'tenant_id' => $this->tenantId,
                'locale'    => $this->targetLocale,
                'error'     => $e->getMessage(),
            ]);

            return null;
        }
    }
}
