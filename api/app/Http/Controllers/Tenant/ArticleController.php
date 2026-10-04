<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\ArticleRequest;
use App\Http\Resources\ArticleResource;
use App\Models\Article;
use App\Services\AuditService;
use App\Services\OpenAiService;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ArticleController extends Controller
{
    private const TRANSLATE_SYSTEM_PROMPT = <<<'PROMPT'
        You translate a restaurant's blog post (title, HTML body, and optional excerpt) from one language to another. Preserve the HTML tags in the body exactly, translating only the text content. Preserve tone and any proper nouns (restaurant name, dish names conventionally kept in their original language). Respond with ONLY a valid JSON object of the exact shape {"title": "...", "content": "...", "excerpt": "..."} (excerpt may be an empty string) — no prose, no markdown code fences, nothing else.
        PROMPT;

    public function __construct(
        private readonly AuditService $audit,
        private readonly SeoService $seo,
    ) {}

    public function autoTranslate(Request $request, OpenAiService $openai): JsonResponse
    {
        $data = $request->validate([
            'source_locale' => ['required', 'string', 'max:10'],
            'target_locale' => ['required', 'string', 'max:10', 'different:source_locale'],
            'title'         => ['required', 'string', 'max:255'],
            'content'       => ['required', 'string'],
            'excerpt'       => ['nullable', 'string'],
        ]);

        $message = "Translate this restaurant blog post from {$data['source_locale']} to {$data['target_locale']}.\n"
            . "Title: {$data['title']}\n"
            . 'Excerpt: ' . ($data['excerpt'] ?? '') . "\n"
            . "Body (HTML):\n{$data['content']}";

        $reply   = $openai->chat([['role' => 'user', 'content' => $message]], self::TRANSLATE_SYSTEM_PROMPT);
        $decoded = json_decode($reply, true);
        abort_if(! is_array($decoded) || ! isset($decoded['title'], $decoded['content']), 422, 'Could not generate a translation, please try again.');

        return response()->json([
            'title'   => $decoded['title'],
            'content' => $decoded['content'],
            'excerpt' => $decoded['excerpt'] ?? '',
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $articles = Article::forTenant($tenant->id)
            ->with(['translations', 'author', 'media'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->branch_id, fn($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->search, fn($q) => $q->whereHas('translations', fn($t) =>
                $t->where('title', 'like', "%{$request->search}%")
                  ->orWhere('content', 'like', "%{$request->search}%")))
            ->orderByRaw('COALESCE(publish_at, created_at) DESC')
            ->paginate($request->per_page ?? 20);

        return response()->json(ArticleResource::collection($articles)->response()->getData(true));
    }

    public function store(ArticleRequest $request): JsonResponse
    {
        $tenant = app('tenant');

        $article = DB::transaction(function () use ($request, $tenant) {
            $article = Article::create([
                'tenant_id'       => $tenant->id,
                'branch_id'       => $request->branch_id,
                'author_id'       => $request->user()->id,
                'status'          => $request->status ?? Article::STATUS_DRAFT,
                'publish_at'      => $this->resolvePublishAt($request->status, $request->publish_at),
                'seo_title'       => $request->seo_title,
                'seo_description' => $request->seo_description,
                'seo_og_image'    => $request->seo_og_image,
            ]);

            $this->syncTranslations($article, $request->translations ?? []);

            return $article;
        });

        if ($request->hasFile('featured_image')) {
            $article->addMedia($request->file('featured_image'))->toMediaCollection('featured_image');
        }

        $this->audit->log('article.created', $article);
        $this->forgetSitemap();

        return response()->json(new ArticleResource($article->load('translations', 'author', 'media')), 201);
    }

    public function show(Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        return response()->json(new ArticleResource($article->load('translations', 'author', 'media')));
    }

    public function update(ArticleRequest $request, Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        DB::transaction(function () use ($request, $article) {
            $article->update(array_filter([
                'branch_id'       => $request->branch_id,
                'status'          => $request->status,
                'publish_at'      => $this->resolvePublishAt($request->status ?? $article->status, $request->publish_at),
                'seo_title'       => $request->seo_title,
                'seo_description' => $request->seo_description,
                'seo_og_image'    => $request->seo_og_image,
            ], fn($value) => ! is_null($value)));

            if ($request->has('translations')) {
                $this->syncTranslations($article, $request->translations);
            }
        });

        $this->audit->log('article.updated', $article);
        $this->forgetSitemap();

        return response()->json(new ArticleResource($article->fresh()->load('translations', 'author', 'media')));
    }

    public function destroy(Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        $this->audit->log('article.deleted', $article);
        $article->delete();
        $this->forgetSitemap();

        return response()->json(['message' => 'Article deleted.']);
    }

    /**
     * Publish immediately, or schedule when a future publish_at is supplied.
     */
    public function publish(Request $request, Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        $request->validate(['publish_at' => ['nullable', 'date']]);

        abort_if(
            $article->translations()->count() === 0,
            422,
            'Add at least one translation before publishing.'
        );

        $publishAt = $request->publish_at ? now()->parse($request->publish_at) : now();
        $scheduled = $publishAt->isFuture();

        $article->update([
            'status'     => $scheduled ? Article::STATUS_SCHEDULED : Article::STATUS_PUBLISHED,
            'publish_at' => $publishAt,
        ]);

        $this->audit->log($scheduled ? 'article.scheduled' : 'article.published', $article);
        $this->forgetSitemap();

        return response()->json(new ArticleResource($article->load('translations', 'author', 'media')));
    }

    public function unpublish(Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        $article->update(['status' => Article::STATUS_DRAFT]);
        $this->audit->log('article.unpublished', $article);
        $this->forgetSitemap();

        return response()->json(new ArticleResource($article->load('translations', 'author', 'media')));
    }

    public function uploadFeaturedImage(Request $request, Article $article): JsonResponse
    {
        $this->authorizeTenant($article);

        $request->validate(['file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:10240']]);

        $media = $article->addMedia($request->file('file'))->toMediaCollection('featured_image');

        return response()->json(['id' => $media->id, 'url' => $media->getUrl()], 201);
    }

    /**
     * An image to embed inline in a post's body (the content editor is raw
     * HTML — this is what backs its "insert image" button). Not tied to a
     * specific article: a post can carry any number of these over its
     * lifetime, and the editor needs somewhere to upload to even before a
     * brand-new article has been saved and has an id of its own yet, unlike
     * uploadFeaturedImage() above.
     */
    public function uploadContentImage(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240']]);

        $tenant = app('tenant');
        $file = $request->file('file');
        $filename = Str::random(40) . '.' . strtolower($file->getClientOriginalExtension());
        $path = $file->storeAs("tenants/{$tenant->id}/articles/content", $filename, 'public');

        return response()->json(['url' => Storage::disk('public')->url($path)], 201);
    }

    // ── Helpers ───────────────────────────────────────────────

    /**
     * @param  array<int, array<string, string|null>>  $translations
     */
    private function syncTranslations(Article $article, array $translations): void
    {
        foreach ($translations as $translation) {
            $existing = $article->translations()->where('locale', $translation['locale'])->first();

            // An existing slug is a published URL — only a caller who sends an
            // explicit slug gets to change it. New translations derive one
            // from the title.
            $requestedSlug = $translation['slug'] ?? null;

            $slug = $requestedSlug || ! $existing
                ? $this->seo->uniqueSlug($article->tenant_id, $requestedSlug ?: $translation['title'], $existing?->id)
                : $existing->slug;

            $article->translations()->updateOrCreate(
                ['locale' => $translation['locale']],
                [
                    'title'   => $translation['title'],
                    'slug'    => $slug,
                    'content' => $translation['content'],
                    'excerpt' => $translation['excerpt'] ?? null,
                ],
            );
        }
    }

    private function resolvePublishAt(?string $status, ?string $publishAt): ?string
    {
        if ($publishAt) {
            return $publishAt;
        }

        return $status === Article::STATUS_PUBLISHED ? now()->toDateTimeString() : null;
    }

    private function authorizeTenant(Article $article): void
    {
        abort_if((int) $article->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }

    /** The sitemap is cached for an hour; any content change invalidates it. */
    private function forgetSitemap(): void
    {
        cache()->forget('sitemap:tenant:' . app('tenant')->id);
    }
}
