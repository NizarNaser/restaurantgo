<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Advertisement;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdvertisementController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json(Advertisement::orderByDesc('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);

        $ad = Advertisement::create($validated);
        $this->audit->log('advertisement.created', $ad);

        return response()->json($ad, 201);
    }

    public function update(Request $request, Advertisement $advertisement): JsonResponse
    {
        $validated = $this->validated($request);

        $advertisement->update($validated);
        $this->audit->log('advertisement.updated', $advertisement);

        return response()->json($advertisement);
    }

    public function destroy(Advertisement $advertisement): JsonResponse
    {
        $this->audit->log('advertisement.deleted', $advertisement);
        $advertisement->delete();

        return response()->json(['message' => 'Advertisement deleted.']);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title'           => ['required', 'string', 'max:255'],
            'advertiser_name' => ['nullable', 'string', 'max:255'],
            'image_path'      => ['nullable', 'string', 'max:2048'],
            'link_url'        => ['nullable', 'url', 'max:2048'],
            'placement'       => ['required', Rule::in(['home_hero', 'home_sidebar', 'directory_top', 'directory_sidebar'])],
            'starts_at'       => ['nullable', 'date'],
            'ends_at'         => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active'       => ['boolean'],
            'sort_order'      => ['integer', 'min:0'],
        ]);
    }
}
