<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\MenuItemRequest;
use App\Http\Resources\MenuItemResource;
use App\Jobs\TranslateTenantContentJob;
use App\Models\Ingredient;
use App\Models\MenuItem;
use App\Models\RecipeLine;
use App\Models\SemiFinishedGood;
use App\Services\AuditService;
use App\Services\OpenAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MenuItemController extends Controller
{
    private const TRANSLATE_SYSTEM_PROMPT = <<<'PROMPT'
        You translate restaurant menu copy (an item's name and description) from one language to another. Preserve tone, and don't translate proper nouns or dish names that are conventionally kept in their original language (e.g. "Margherita", "Pad Thai"). Respond with ONLY a valid JSON object of the exact shape {"name": "...", "description": "..."} — no prose, no markdown code fences, nothing else.
        PROMPT;

    public function __construct(private readonly AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $items = MenuItem::forTenant($tenant->id)
            ->with(['translations', 'prices', 'category', 'media'])
            ->when($request->category_id, fn($q) => $q->where('menu_category_id', $request->category_id))
            ->when($request->search, fn($q) => $q->whereHas('translations', fn($t) =>
                $t->where('name', 'like', "%{$request->search}%")))
            ->when($request->has('is_available'), fn($q) => $q->where('is_available', $request->boolean('is_available')))
            ->orderBy('sort_order')
            ->paginate($request->per_page ?? 20);

        return response()->json(MenuItemResource::collection($items)->response()->getData(true));
    }

    public function store(MenuItemRequest $request): JsonResponse
    {
        $tenant  = app('tenant');

        // Plan limit check
        $plan = $tenant->plan;
        if ($plan->max_menu_items && MenuItem::forTenant($tenant->id)->count() >= $plan->max_menu_items) {
            return response()->json([
                'message' => "You've reached your plan limit of {$plan->max_menu_items} menu items. Please upgrade.",
                'code'    => 'PLAN_LIMIT_REACHED',
            ], 403);
        }

        $item = MenuItem::create(array_merge(
            $request->validated(),
            ['tenant_id' => $tenant->id]
        ));

        // Sync translations
        foreach ($request->translations ?? [] as $translation) {
            $item->translations()->updateOrCreate(
                ['locale' => $translation['locale']],
                $translation
            );
        }

        // Sync multi-currency prices
        foreach ($request->prices ?? [] as $price) {
            $item->prices()->updateOrCreate(
                ['currency' => $price['currency']],
                ['price' => $price['price']]
            );
        }

        // Attach uploaded media
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $item->addMedia($image)->toMediaCollection('images');
            }
        }

        TranslateTenantContentJob::dispatchForMissingLocales($tenant, $item->load('translations'));

        $this->audit->log('menu_item.created', $item);

        return response()->json(new MenuItemResource($item->load('translations', 'prices', 'media')), 201);
    }

    public function show(MenuItem $item): JsonResponse
    {
        $this->authorizeTenant($item);
        return response()->json(new MenuItemResource($item->load('translations', 'prices', 'category', 'media', 'reviews')));
    }

    public function update(MenuItemRequest $request, MenuItem $item): JsonResponse
    {
        $this->authorizeTenant($item);

        $item->update($request->validated());

        foreach ($request->translations ?? [] as $translation) {
            $item->translations()->updateOrCreate(
                ['locale' => $translation['locale']],
                $translation
            );
        }

        foreach ($request->prices ?? [] as $price) {
            $item->prices()->updateOrCreate(
                ['currency' => $price['currency']],
                ['price' => $price['price']]
            );
        }

        TranslateTenantContentJob::dispatchForMissingLocales(app('tenant'), $item->load('translations'));

        $this->audit->log('menu_item.updated', $item);

        return response()->json(new MenuItemResource($item->load('translations', 'prices', 'media')));
    }

    public function destroy(MenuItem $item): JsonResponse
    {
        $this->authorizeTenant($item);
        $this->audit->log('menu_item.deleted', $item);
        $item->delete();
        return response()->json(['message' => 'Menu item deleted.']);
    }

    public function uploadMedia(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizeTenant($menuItem);
        $request->validate(['file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,mp4,webm', 'max:51200']]);

        $type = str_contains($request->file('file')->getMimeType(), 'video') ? 'video' : 'images';
        $media = $menuItem->addMedia($request->file('file'))->toMediaCollection($type);

        return response()->json(['id' => $media->id, 'url' => $media->getUrl()], 201);
    }

    public function syncTranslations(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizeTenant($menuItem);

        $validated = $request->validate([
            'translations'                 => ['required', 'array', 'min:1'],
            'translations.*.locale'        => ['required', 'string', 'max:10'],
            'translations.*.name'          => ['required', 'string', 'max:255'],
            'translations.*.description'   => ['nullable', 'string'],
            'translations.*.ingredients'   => ['nullable', 'string'],
        ]);

        foreach ($validated['translations'] as $translation) {
            $menuItem->translations()->updateOrCreate(
                ['locale' => $translation['locale']],
                $translation
            );
        }

        TranslateTenantContentJob::dispatchForMissingLocales(app('tenant'), $menuItem->load('translations'));

        $this->audit->log('menu_item.translations_updated', $menuItem);

        return response()->json($menuItem->translations()->get());
    }

    public function syncPrices(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizeTenant($menuItem);

        $validated = $request->validate([
            'prices'            => ['required', 'array', 'min:1'],
            'prices.*.currency' => ['required', 'string', 'size:3'],
            'prices.*.price'    => ['required', 'numeric', 'min:0'],
        ]);

        foreach ($validated['prices'] as $price) {
            $menuItem->prices()->updateOrCreate(
                ['currency' => strtoupper($price['currency'])],
                ['price' => $price['price']]
            );
        }

        $this->audit->log('menu_item.prices_updated', $menuItem);

        return response()->json($menuItem->prices()->get());
    }

    /**
     * Ad-hoc translation, not tied to an existing MenuItem row — the item
     * editor uses this for both creating a new item and editing one, and
     * never persists the result itself; the owner reviews it via the normal
     * form fields and saves (or discards it) through the existing save flow.
     */
    public function autoTranslate(Request $request, OpenAiService $openai): JsonResponse
    {
        $data = $request->validate([
            'source_locale' => ['required', 'string', 'max:10'],
            'target_locale' => ['required', 'string', 'max:10', 'different:source_locale'],
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['nullable', 'string'],
        ]);

        $message = "Translate this restaurant menu item from {$data['source_locale']} to {$data['target_locale']}.\n"
            . "Name: {$data['name']}\n"
            . 'Description: ' . ($data['description'] ?? '');

        $reply = $openai->chat([['role' => 'user', 'content' => $message]], self::TRANSLATE_SYSTEM_PROMPT);

        $decoded = json_decode($reply, true);
        abort_if(! is_array($decoded) || ! isset($decoded['name']), 422, 'Could not generate a translation, please try again.');

        return response()->json([
            'name'        => $decoded['name'],
            'description' => $decoded['description'] ?? '',
        ]);
    }

    /** This item's recipe card — which ingredients/semi-finished goods prepare it. */
    public function showRecipe(MenuItem $item): JsonResponse
    {
        $this->authorizeTenant($item);

        return response()->json(
            $item->recipeLines()->with('componentable')->orderBy('sort_order')->get()
        );
    }

    public function syncRecipe(Request $request, MenuItem $item): JsonResponse
    {
        $this->authorizeTenant($item);

        $data = $request->validate([
            'lines'                        => ['present', 'array'],
            'lines.*.componentable_type'   => ['required', Rule::in(['ingredient', 'semi_finished_good'])],
            'lines.*.componentable_id'     => ['required', 'integer'],
            'lines.*.gross_quantity'       => ['required', 'numeric', 'gt:0'],
            'lines.*.net_quantity'         => ['nullable', 'numeric', 'gt:0'],
        ]);

        DB::transaction(function () use ($item, $data) {
            $item->recipeLines()->delete();

            foreach ($data['lines'] as $index => $line) {
                $type = $line['componentable_type'] === 'ingredient'
                    ? Ingredient::class
                    : SemiFinishedGood::class;

                $componentable = $type::where('tenant_id', app('tenant')->id)->findOrFail($line['componentable_id']);

                RecipeLine::create([
                    'recipeable_type'    => MenuItem::class,
                    'recipeable_id'      => $item->id,
                    'componentable_type' => $type,
                    'componentable_id'   => $componentable->id,
                    'gross_quantity'     => $line['gross_quantity'],
                    'net_quantity'       => $line['net_quantity'] ?? null,
                    'sort_order'         => $index,
                ]);
            }
        });

        $this->audit->log('menu_item.recipe_updated', $item, ['lines' => count($data['lines'])]);

        return response()->json($item->recipeLines()->with('componentable')->orderBy('sort_order')->get());
    }

    private function authorizeTenant(MenuItem $item): void
    {
        abort_if((int) $item->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
