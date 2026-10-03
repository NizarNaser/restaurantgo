<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateTenantContentJob;
use App\Models\MenuCategory;
use App\Services\OpenAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuCategoryController extends Controller
{
    private const TRANSLATE_SYSTEM_PROMPT = <<<'PROMPT'
        You translate a restaurant menu's section/category name (e.g. "Starters", "Desserts") from one language to another — keep it short and idiomatic, the way a native menu in the target language would phrase it. Respond with ONLY a valid JSON object of the exact shape {"name": "..."} — no prose, no markdown code fences, nothing else.
        PROMPT;

    public function autoTranslate(Request $request, OpenAiService $openai): JsonResponse
    {
        $data = $request->validate([
            'source_locale' => ['required', 'string', 'max:10'],
            'target_locale' => ['required', 'string', 'max:10', 'different:source_locale'],
            'name'          => ['required', 'string', 'max:255'],
        ]);

        $message = "Translate this restaurant menu category name from {$data['source_locale']} to {$data['target_locale']}.\n"
            . "Name: {$data['name']}";

        $reply   = $openai->chat([['role' => 'user', 'content' => $message]], self::TRANSLATE_SYSTEM_PROMPT);
        $decoded = json_decode($reply, true);
        abort_if(! is_array($decoded) || ! isset($decoded['name']), 422, 'Could not generate a translation, please try again.');

        return response()->json(['name' => $decoded['name']]);
    }
    public function index(Request $request): JsonResponse
    {
        $tenant = app('tenant');
        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->with(['translations'])
            ->withCount('items')
            ->orderBy('sort_order')
            ->get()
            ->map(function ($cat) {
                $cat->name = $cat->translation()->name ?? 'Unnamed';
                return $cat;
            });
            
        return response()->json(['data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = app('tenant');
        
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ]);

        $validated['tenant_id'] = $tenant->id;
        
        $category = MenuCategory::create($validated);
        
        // Not app()->getLocale(): that's derived from the raw Accept-Language
        // header the admin's browser happens to send (e.g. "en-US"), which
        // almost never matches one of this tenant's plain supported_locales
        // codes ("en") — silently stranding every new category's only
        // translation under a locale nothing ever looks up.
        $category->translations()->create([
            'locale' => $tenant->default_locale ?? 'en',
            'name' => $request->name,
            'description' => $request->description,
        ]);

        TranslateTenantContentJob::dispatchForMissingLocales($tenant, $category->load('translations'));

        $category->name = $request->name;

        return response()->json(['data' => $category], 201);
    }

    public function show(MenuCategory $category): JsonResponse
    {
        $this->authorizeTenant($category);
        $category->name = $category->translation()->name ?? 'Unnamed';
        return response()->json(['data' => $category]);
    }

    public function update(Request $request, MenuCategory $category): JsonResponse
    {
        $this->authorizeTenant($category);
        
        $validated = $request->validate([
            'name' => ['string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
        ]);

        $category->update($validated);
        
        if ($request->has('name') || $request->has('description')) {
            $category->translations()->updateOrCreate(
                ['locale' => app('tenant')->default_locale ?? 'en'],
                [
                    'name' => $request->name ?? $category->translation()->name,
                    'description' => $request->description ?? $category->translation()->description,
                ]
            );
        }

        TranslateTenantContentJob::dispatchForMissingLocales(app('tenant'), $category->load('translations'));

        $category->name = $category->translation()->name ?? 'Unnamed';
        
        return response()->json(['data' => $category]);
    }

    public function destroy(MenuCategory $category): JsonResponse
    {
        $this->authorizeTenant($category);
        $category->delete();
        
        return response()->json(['message' => 'Category deleted']);
    }
    
    private function authorizeTenant(MenuCategory $category): void
    {
        abort_if($category->tenant_id !== app('tenant')->id, 403, 'Forbidden.');
    }
}
