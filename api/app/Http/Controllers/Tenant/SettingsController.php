<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateTenantContentJob;
use App\Models\Tenant;
use App\Services\AuditService;
use App\Services\SeoService;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    private const IMAGE_FIELDS = [
        'logo'        => ['column' => 'logo_path', 'mimes' => 'jpg,jpeg,png,webp,svg', 'max' => 2048],
        'favicon'     => ['column' => 'favicon_path', 'mimes' => 'png,ico,svg', 'max' => 512],
        'cover-image' => ['column' => 'cover_image_path', 'mimes' => 'jpg,jpeg,png,webp', 'max' => 5120],
    ];

    public function __construct(private readonly AuditService $audit)
    {
    }

    public function show(): JsonResponse
    {
        $tenant = app('tenant');
        return response()->json([
            'name'                => $tenant->name,
            'slug'                => $tenant->slug,
            'timezone'            => $tenant->timezone,
            'default_currency'    => $tenant->default_currency,
            'default_locale'      => $tenant->default_locale,
            'tax_rate'            => $tenant->tax_rate,
            'service_charge_rate'              => $tenant->service_charge_rate,
            'service_charge_message'           => $tenant->service_charge_message,
            'service_charge_show_message'      => $tenant->service_charge_show_message,
            'service_charge_apply_to_invoice'  => $tenant->service_charge_apply_to_invoice,
            // Tenants created before the supported-languages feature existed
            // can still have an empty/null list — fall back to their own
            // default locale rather than handing back nothing to pick from.
            'supported_locales'   => $tenant->supported_locales ?: [$tenant->default_locale],
            'logo_path'           => $tenant->logo_path,
            'favicon_path'        => $tenant->favicon_path,
            'cover_image_path'    => $tenant->cover_image_path,
            'seo_title'           => $tenant->seo_title,
            'seo_description'     => $tenant->seo_description,
            'seo_og_image'        => $tenant->seo_og_image,
            'google_site_verification' => $tenant->google_site_verification,
            'google_analytics_id' => $tenant->google_analytics_id,
            'facebook_pixel_id'   => $tenant->facebook_pixel_id,
            'social_facebook_url'  => $tenant->social_facebook_url,
            'social_instagram_url' => $tenant->social_instagram_url,
            'social_twitter_url'   => $tenant->social_twitter_url,
            'social_tiktok_url'    => $tenant->social_tiktok_url,
            'social_youtube_url'   => $tenant->social_youtube_url,
            'social_snapchat_url'  => $tenant->social_snapchat_url,
            'public_url'          => app(SeoService::class)->tenantBaseUrl($tenant),
            'sitemap_url'         => app(SeoService::class)->tenantBaseUrl($tenant) . '/sitemap.xml',
            'custom_domain'       => $tenant->custom_domain,
            'has_white_label'     => (bool) $tenant->plan?->has_white_label,
        ]);
    }

    /**
     * Shared handler for the three branding image uploads (logo, favicon,
     * cover image) — same storage/validation shape, just a different column
     * and mime/size allowance per type.
     */
    public function uploadImage(Request $request, string $type): JsonResponse
    {
        abort_unless(isset(self::IMAGE_FIELDS[$type]), 404);
        $field = self::IMAGE_FIELDS[$type];

        // `extensions` (not `mimes`) — Laravel's `mimes` rule sniffs the file's
        // content type via libmagic/finfo, which misdetects most real-world
        // .ico files as application/octet-stream and rejects them outright.
        $request->validate([
            'file' => ['required', 'file', "extensions:{$field['mimes']}", "max:{$field['max']}"],
        ]);

        /** @var Tenant $tenant */
        $tenant = app('tenant');
        $column = $field['column'];

        if ($tenant->{$column}) {
            Storage::disk('public')->delete($this->pathFromUrl($tenant->{$column}));
        }

        // storeAs with an explicit extension — the default store() names the
        // file by guessing an extension from the sniffed content type, which
        // (like the mimes rule above) turns real .ico files into a .bin file
        // that then gets served with the wrong Content-Type.
        $file = $request->file('file');
        $filename = Str::random(40) . '.' . strtolower($file->getClientOriginalExtension());
        $path = $file->storeAs("tenants/{$tenant->id}/branding", $filename, 'public');
        $tenant->update([$column => Storage::disk('public')->url($path)]);

        return response()->json([$column => $tenant->{$column}], 201);
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

    public function update(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $validated = $request->validate([
            'name'                => ['required', 'string', 'max:255'],
            'timezone'            => ['required', 'string', 'max:100'],
            'default_currency'    => ['required', 'string', 'max:3'],
            'default_locale'      => ['required', 'string', 'max:10'],
            'tax_rate'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'service_charge_rate'             => ['nullable', 'numeric', 'min:0', 'max:100'],
            'service_charge_message'          => ['nullable', 'array'],
            'service_charge_message.*'        => ['nullable', 'string', 'max:500'],
            'service_charge_show_message'     => ['boolean'],
            'service_charge_apply_to_invoice' => ['boolean'],
            'supported_locales'   => ['required', 'array', 'min:1'],
            'supported_locales.*' => ['string', 'max:10'],
            'seo_title'             => ['nullable', 'array'],
            'seo_title.*'           => ['nullable', 'string', 'max:255'],
            'seo_description'       => ['nullable', 'array'],
            'seo_description.*'     => ['nullable', 'string', 'max:500'],
            'seo_og_image'        => ['nullable', 'string', 'max:2048'],
            'google_site_verification' => ['nullable', 'string', 'max:255'],
            'google_analytics_id' => ['nullable', 'string', 'max:50'],
            'facebook_pixel_id'   => ['nullable', 'string', 'max:50'],
            'social_facebook_url'  => ['nullable', 'url', 'max:2048'],
            'social_instagram_url' => ['nullable', 'url', 'max:2048'],
            'social_twitter_url'   => ['nullable', 'url', 'max:2048'],
            'social_tiktok_url'    => ['nullable', 'url', 'max:2048'],
            'social_youtube_url'   => ['nullable', 'url', 'max:2048'],
            'social_snapchat_url'  => ['nullable', 'url', 'max:2048'],
        ]);

        $tenant->update($validated);
        $this->audit->log('tenant.settings_updated', $tenant);

        // So the homepage hero/meta copy a customer sees matches whatever
        // language they're browsing in instead of silently falling back to
        // whichever locale this was typed in first — same as menu items,
        // categories, departments, and blog posts already auto-translate.
        TranslateTenantContentJob::dispatchForMissingTenantSeoLocales($tenant);

        // Same reasoning as the SEO copy above, for the service-charge note
        // shown to every dine-in customer on the public menu.
        TranslateTenantContentJob::dispatchForMissingServiceChargeMessageLocales($tenant);

        // Tenant name / SEO copy appear in the sitemap and its cached output.
        cache()->forget("sitemap:tenant:{$tenant->id}");

        return response()->json([
            'message' => 'Settings updated successfully.',
            'name'    => $tenant->name,
            'slug'    => $tenant->slug,
        ]);
    }

    /**
     * Custom domain (white-label) — Enterprise-only. The public site then
     * resolves the tenant straight from the request host instead of the
     * usual /p/{slug} path; see ResolvesPublicTenant::resolvePublicTenant().
     */
    public function setCustomDomain(Request $request, TenantService $tenants): JsonResponse
    {
        $tenant = app('tenant');
        abort_unless($tenant->plan?->has_white_label, 403, 'Your current plan does not include a custom domain. Please upgrade to Enterprise.');

        $data = $request->validate([
            'domain' => ['required', 'string', 'max:255', 'regex:/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/'],
        ]);

        $tenants->setCustomDomain($tenant, strtolower($data['domain']));
        $this->audit->log('tenant.custom_domain_set', $tenant, ['new' => ['domain' => $data['domain']]]);

        return response()->json([
            'message'       => 'Custom domain connected.',
            'custom_domain' => $tenant->fresh()->custom_domain,
        ]);
    }

    public function removeCustomDomain(): JsonResponse
    {
        $tenant = app('tenant');
        $tenant->update(['custom_domain' => null]);
        $this->audit->log('tenant.custom_domain_removed', $tenant);

        return response()->json(['message' => 'Custom domain removed.']);
    }
}
