<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSettingsController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json(PlatformSetting::current());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seo_title'                => ['nullable', 'array'],
            'seo_title.*'              => ['nullable', 'string', 'max:255'],
            'seo_description'          => ['nullable', 'array'],
            'seo_description.*'        => ['nullable', 'string', 'max:500'],
            'seo_og_image'             => ['nullable', 'string', 'max:2048'],
            'google_site_verification' => ['nullable', 'string', 'max:255'],
        ]);

        $settings = PlatformSetting::current();
        $settings->update($data);
        $this->audit->log('platform_settings.updated', $settings);

        return response()->json($settings->fresh());
    }
}
