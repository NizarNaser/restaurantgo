<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateTenantContentJob;
use App\Models\Branch;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    /**
     * A minimal list for populating branch pickers elsewhere in the
     * dashboard (e.g. choosing which branch a table QR code belongs to) —
     * not a full CRUD resource, branches are managed at onboarding time.
     */
    public function index(): JsonResponse
    {
        $branches = Branch::where('tenant_id', app('tenant')->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'city']);

        return response()->json($branches);
    }

    /**
     * The tenant's one real-world location — this is what the public menu's
     * "Visit or contact us" card (MenuController::getInfo) reads from.
     * There's no multi-branch management UI yet, so this always resolves to
     * a single primary branch, auto-creating one for tenants that predate
     * this (registration now creates one up front for everyone else).
     */
    public function show(): JsonResponse
    {
        return response()->json($this->primaryBranch());
    }

    public function update(Request $request): JsonResponse
    {
        $branch = $this->primaryBranch();

        $data = $request->validate([
            'phone'                => ['nullable', 'string', 'max:50'],
            'address'              => ['nullable', 'array'],
            'address.*'            => ['nullable', 'string', 'max:255'],
            'city'                 => ['nullable', 'string', 'max:100'],
            'country'              => ['nullable', 'string', 'size:2'],
            'latitude'             => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'            => ['nullable', 'numeric', 'between:-180,180'],
            'google_maps_embed'    => ['nullable', 'string', 'max:4096'],
            'working_hours'                => ['nullable', 'array'],
            'working_hours.mon'            => ['nullable', 'string', 'max:20'],
            'working_hours.tue'            => ['nullable', 'string', 'max:20'],
            'working_hours.wed'            => ['nullable', 'string', 'max:20'],
            'working_hours.thu'            => ['nullable', 'string', 'max:20'],
            'working_hours.fri'            => ['nullable', 'string', 'max:20'],
            'working_hours.sat'            => ['nullable', 'string', 'max:20'],
            'working_hours.sun'            => ['nullable', 'string', 'max:20'],
        ]);

        if (array_key_exists('google_maps_embed', $data)) {
            $raw = $data['google_maps_embed'];
            unset($data['google_maps_embed']);

            if ($raw === null || trim($raw) === '') {
                $data['google_maps_embed_url'] = null;
            } else {
                $embedUrl = $this->extractEmbedSrc($raw);
                abort_unless($embedUrl, 422, 'That doesn\'t look like a Google Maps embed code. In Google Maps, use Share > Embed a map, then paste the code you copied there.');
                $data['google_maps_embed_url'] = $embedUrl;
            }
        }

        $branch->update($data);
        $this->audit->log('branch.contact_updated', $branch);

        // So the address a customer sees under "Visit or contact us" matches
        // whatever language they're browsing in, the same way the tenant's
        // own SEO copy and service-charge note already do.
        TranslateTenantContentJob::dispatchForMissingBranchAddressLocales(app('tenant'), $branch);

        return response()->json($branch->fresh());
    }

    /**
     * Accepts either the full <iframe> snippet Google Maps' own "Share >
     * Embed a map" dialog gives (no API key involved — that's a separate,
     * paid JS API), or just the bare src URL pasted on its own. Only ever
     * trusts a URL that is actually Google's own embed host: the result gets
     * rendered in a real <iframe> on the tenant's PUBLIC menu page, so
     * anything else here would be an open door for arbitrary iframe
     * injection into a page every customer visits.
     */
    private function extractEmbedSrc(string $raw): ?string
    {
        $raw = trim($raw);

        if (str_contains($raw, '<iframe')) {
            if (! preg_match('/src=["\']([^"\']+)["\']/i', $raw, $m)) {
                return null;
            }
            $raw = html_entity_decode($m[1]);
        }

        return preg_match('#^https://www\.google\.com/maps/embed[?/]#i', $raw) ? $raw : null;
    }

    /**
     * Turns a Google Maps link the owner copies via the app's own "Share"
     * button into coordinates — no Google Maps API key needed. A share link
     * is one of:
     *   - a short link (maps.app.goo.gl/..., goo.gl/maps/...) that only
     *     reveals its destination once its redirect is actually followed;
     *   - a full maps.google.com URL, which already encodes the coordinates
     *     in its own path/query (either "@lat,lng,zoom" or "!3dlat!4dlng").
     * Short links are resolved first so both cases end up parsed the same way.
     */
    public function resolveMapsUrl(Request $request): JsonResponse
    {
        $data = $request->validate(['url' => ['required', 'string', 'max:2048']]);

        $url = trim($data['url']);
        abort_unless(preg_match('#^https?://#i', $url), 422, 'That does not look like a link.');

        $coords = $this->extractCoordinates($url);

        if (! $coords && preg_match('#^https?://(maps\.app\.goo\.gl|goo\.gl/maps)/#i', $url)) {
            $resolved = $this->followRedirect($url);
            if ($resolved) {
                $coords = $this->extractCoordinates($resolved);
            }
        }

        abort_unless($coords, 422, 'Could not find a location in that link. Make sure it was copied from Google Maps\' own "Share" button.');

        return response()->json(['latitude' => $coords[0], 'longitude' => $coords[1]]);
    }

    /**
     * @return array{0: float, 1: float}|null
     */
    private function extractCoordinates(string $url): ?array
    {
        if (preg_match('/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/', $url, $m)) {
            return [(float) $m[1], (float) $m[2]];
        }
        if (preg_match('/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/', $url, $m)) {
            return [(float) $m[1], (float) $m[2]];
        }
        if (preg_match('/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/', $url, $m)) {
            return [(float) $m[1], (float) $m[2]];
        }

        return null;
    }

    /**
     * Follows a short link's redirect chain and returns wherever it lands —
     * a Range header caps how much of the final page actually downloads
     * (only the URL matters, never the body), since that final hop is a full
     * Google Maps page rather than another lightweight redirect.
     */
    private function followRedirect(string $url): ?string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 10,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_RANGE          => '0-2047',
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; RestaurantGoBot/1.0)',
        ]);
        curl_exec($ch);
        $effectiveUrl = curl_errno($ch) ? null : curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        curl_close($ch);

        return $effectiveUrl ?: null;
    }

    private function primaryBranch(): Branch
    {
        $tenant = app('tenant');

        return Branch::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->first()
            ?? Branch::create(['tenant_id' => $tenant->id, 'name' => $tenant->name, 'is_active' => true]);
    }
}
