/**
 * Resolves which "mode" this SPA is running in from the browser's own
 * hostname, so the same build serves three different audiences:
 *
 *  - the admin/staff dashboard, at the platform's own host (e.g.
 *    `app.restaurantgo.com`) or on localhost during development — routed at
 *    `/dashboard`, `/menu`, `/login`, etc.
 *  - a tenant's public menu/blog/ordering pages under ITS OWN subdomain
 *    (e.g. `pizzeria.restaurantgo.com`) — routed at clean root paths (`/`,
 *    `/halls`, `/blog`, ...) with no slug in the URL at all.
 *  - the same public pages reachable under a connected custom domain
 *    (`menu.pizzeria.com`), or via the legacy `/p/:slug/...` path prefix
 *    used before a tenant has any subdomain configured (kept for local dev
 *    and as a permanent fallback).
 *
 * `VITE_BASE_DOMAIN` must match the backend's `APP_BASE_DOMAIN` — see
 * SeoService::tenantBaseUrl() in the API, which this file mirrors.
 */

// Keep in sync with api/config/app.php's `reserved_subdomains`.
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'mail', 'ftp', 'cpanel',
  'webmail', 'ns1', 'ns2', 'smtp', 'pop', 'imap', 'autodiscover',
  'staging', 'stage', 'dev', 'test', 'cdn', 'assets', 'static',
  'docs', 'status', 'blog', 'support', 'help', 'billing', 'store',
]);

function getBaseDomain(): string | undefined {
  const value = import.meta.env.VITE_BASE_DOMAIN as string | undefined;
  return value ? value.toLowerCase() : undefined;
}

/**
 * The tenant slug/subdomain this hostname belongs to, or `null` when the
 * app is being viewed as the admin dashboard / on localhost / with no
 * `VITE_BASE_DOMAIN` configured — in which case the caller should fall
 * back to the legacy `/p/:slug/...` path-based routing instead.
 */
export function getTenantHostSlug(): string | null {
  const baseDomain = getBaseDomain();
  const host = window.location.hostname.toLowerCase();

  if (!baseDomain || host === 'localhost' || host === '127.0.0.1') return null;

  if (host === baseDomain || host === `www.${baseDomain}`) return null;

  if (host.endsWith(`.${baseDomain}`)) {
    const subdomain = host.slice(0, -(`.${baseDomain}`.length));
    // A subdomain can only be one label deep (tenants never get nested
    // subdomains) — anything else isn't a tenant host we recognise.
    if (!subdomain || subdomain.includes('.') || RESERVED_SUBDOMAINS.has(subdomain)) return null;
    return subdomain;
  }

  // Doesn't end in our base domain at all — a tenant's own connected
  // custom domain works exactly like a slug here (see
  // ResolvesPublicTenant::resolvePublicTenant on the API side).
  return host;
}

/**
 * Builds a path to one of the public tenant pages, correct for whichever
 * mode this load is in: a clean root-relative path under a tenant
 * host/custom domain, or the legacy `/p/{slug}/...` prefix otherwise.
 *
 * `suffix` is the bit after the tenant root, e.g. '', '/halls',
 * `/item/${id}`, '/blog' — always without a trailing slash of its own.
 */
export function buildPublicPath(slug: string | undefined, suffix: string, isHostMode: boolean): string {
  const normalized = suffix === '' || suffix === '/' ? '' : suffix.startsWith('/') ? suffix : `/${suffix}`;

  if (isHostMode) return normalized === '' ? '/' : normalized;

  return `/p/${slug}${normalized}`;
}

/**
 * The platform's own marketing site (restaurantgo.com, not any tenant's
 * page) — linked from the "powered by" badge on a tenant's public site.
 * Derived from the same VITE_BASE_DOMAIN as the tenant subdomains
 * themselves, so it always points at the right environment.
 */
export function getPlatformSiteUrl(): string {
  const baseDomain = getBaseDomain();
  return baseDomain ? `https://${baseDomain}` : 'https://restaurantgo.com';
}
