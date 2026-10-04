<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Advertisement;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
        $validated['image_path'] = $this->storeUploadedImage($request) ?? $validated['image_path'] ?? null;

        $ad = Advertisement::create($validated);
        $this->audit->log('advertisement.created', $ad);

        return response()->json($ad, 201);
    }

    public function update(Request $request, Advertisement $advertisement): JsonResponse
    {
        $validated = $this->validated($request);

        if ($uploaded = $this->storeUploadedImage($request)) {
            if ($advertisement->image_path) {
                Storage::disk('public')->delete($this->pathFromUrl($advertisement->image_path));
            }
            $validated['image_path'] = $uploaded;
        }

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
            // A pasted URL stays supported alongside the upload below — an
            // advertiser-hosted image URL remains a valid way to set this.
            'image_path'      => ['nullable', 'string', 'max:2048'],
            'image'           => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'link_url'        => ['nullable', 'url', 'max:2048'],
            'placement'       => ['required', Rule::in(['home_hero', 'home_sidebar', 'directory_top', 'directory_sidebar'])],
            'starts_at'       => ['nullable', 'date'],
            'ends_at'         => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active'       => ['boolean'],
            'sort_order'      => ['integer', 'min:0'],
        ]);
    }

    /**
     * Stores an uploaded creative file (if one was sent under `image`) and
     * returns its public URL, or null when the request carried no file —
     * the caller then falls back to a plain `image_path` string, so
     * advertisers who already have a hosted image can keep pasting a URL
     * instead of re-uploading it.
     */
    private function storeUploadedImage(Request $request): ?string
    {
        if (! $request->hasFile('image')) {
            return null;
        }

        $file = $request->file('image');
        $filename = Str::random(40) . '.' . strtolower($file->getClientOriginalExtension());
        $path = $file->storeAs('advertisements', $filename, 'public');

        return Storage::disk('public')->url($path);
    }

    /**
     * Storage::url() prefixes the disk-relative path with /storage — strip
     * that back off so the result can be passed to Storage::delete().
     */
    private function pathFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';

        return preg_replace('#^/?storage/#', '', $path);
    }
}
