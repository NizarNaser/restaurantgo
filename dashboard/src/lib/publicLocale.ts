const KEY_PREFIX = 'public_locale_';

/**
 * The customer's chosen language for one restaurant's public site, kept
 * per-slug (not global) so visiting two different restaurants in the same
 * browser never mixes up their language choices.
 */
export function getStoredPublicLocale(slug: string | undefined): string | null {
  if (!slug) return null;
  try {
    return localStorage.getItem(KEY_PREFIX + slug);
  } catch {
    return null;
  }
}

export function setStoredPublicLocale(slug: string | undefined, locale: string): void {
  if (!slug) return;
  try {
    localStorage.setItem(KEY_PREFIX + slug, locale);
  } catch {
    // Storage can be unavailable (private mode, quota) — the choice just
    // won't persist across page loads, which is a harmless degradation.
  }
}
