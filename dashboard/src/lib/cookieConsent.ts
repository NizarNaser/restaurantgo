const KEY_PREFIX = 'cookie_consent_';
const CHANGE_EVENT = 'cookie-consent-changed';

export type CookieConsentStatus = 'accepted' | 'declined' | null;

/**
 * Whether this visitor has opted into non-essential cookies (analytics/
 * marketing pixels) for one restaurant's public site — kept per-slug, like
 * the language choice in `publicLocale.ts`, so the decision on one
 * restaurant's site never silently applies to another's. `null` means "not
 * decided yet", which is what gates the consent banner and keeps
 * `useAnalytics` from injecting anything (see PRIV-01 in
 * COMPLIANCE_SECURITY_PAYMENTS_PLAN.md).
 */
export function getCookieConsent(slug: string | undefined): CookieConsentStatus {
  if (!slug) return null;
  try {
    const value = localStorage.getItem(KEY_PREFIX + slug);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Persists the choice and broadcasts it so an already-mounted
 * `useAnalytics` hook can react immediately (accepting should start
 * tracking right away, not just on the next page load).
 */
export function setCookieConsent(slug: string | undefined, status: 'accepted' | 'declined'): void {
  if (!slug) return;
  try {
    localStorage.setItem(KEY_PREFIX + slug, status);
  } catch {
    // Storage can be unavailable (private mode, quota) — the choice just
    // won't persist across page loads; the banner will simply reappear.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { slug, status } }));
}

export function onCookieConsentChange(listener: (slug: string | undefined, status: CookieConsentStatus) => void): () => void {
  const handler = (e: Event) => {
    const { slug, status } = (e as CustomEvent<{ slug: string | undefined; status: CookieConsentStatus }>).detail;
    listener(slug, status);
  };
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
