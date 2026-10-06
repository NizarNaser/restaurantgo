<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuItem;
use App\Models\Tenant;
use App\Services\OpenAiService;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MenuAssistantController extends Controller
{
    use ResolvesPublicTenant;

    private const MAX_ITEMS = 60;

    public function chat(Request $request, string $slug, OpenAiService $openai): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);
        $locale = $this->resolvePublicLocale($tenant);

        $data = $request->validate([
            'messages'           => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.role'    => ['required', Rule::in(['user', 'assistant'])],
            'messages.*.content' => ['required', 'string', 'max:4000'],
        ]);

        return response()->json(['reply' => $openai->chat($data['messages'], $this->buildSystemPrompt($tenant, $locale))]);
    }

    private function buildSystemPrompt(Tenant $tenant, string $locale): string
    {
        $branch = $tenant->branches()->where('is_active', true)->first();
        $address = app(SeoService::class)->pick($branch?->address, $locale);

        $totalAvailable = MenuItem::forTenant($tenant->id)->available()->count();

        $items = MenuItem::forTenant($tenant->id)
            ->available()
            ->with(['translations', 'prices', 'category.translations'])
            ->orderBy('sort_order')
            ->limit(self::MAX_ITEMS)
            ->get();

        $menuText = $items->map(fn (MenuItem $item) => sprintf(
            '- %s (%s): %s — %s %s',
            $item->translation($locale)?->name ?? 'Item',
            $item->category?->translation($locale)?->name ?? 'Menu',
            Str::limit($item->translation($locale)?->description ?? '', 100),
            $item->prices->first()?->price ?? $item->base_price,
            $item->prices->first()?->currency ?? $tenant->default_currency,
        ))->implode("\n");

        $menuNote = $totalAvailable > self::MAX_ITEMS
            ? "; showing the first " . self::MAX_ITEMS . " of {$totalAvailable} items — see the full menu on this page for anything not listed here"
            : '';

        $hours = is_array($branch?->working_hours) ? json_encode($branch->working_hours) : 'Not specified';

        return <<<PROMPT
            You are a helpful assistant answering customer questions about "{$tenant->name}", a restaurant. Only answer questions about this restaurant — its menu, hours, location, and general questions a diner might have (dietary needs, spice level, etc.) based on the menu below. You cannot place an order or add anything to the cart yourself — if the customer wants to order, tell them to use the Add to Cart buttons on this page.

            Restaurant: {$tenant->name}
            Address: {$address}, {$branch?->city}
            Phone: {$branch?->phone}
            Working hours: {$hours}

            Menu (showing available items{$menuNote}):
            {$menuText}

            Answer concisely, in the same language the customer writes in. If asked something you can't answer from the info above, say so honestly instead of guessing.
            PROMPT;
    }
}
