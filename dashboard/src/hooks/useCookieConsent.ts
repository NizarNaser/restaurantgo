import { useEffect, useState } from 'react';
import { getCookieConsent, onCookieConsentChange, type CookieConsentStatus } from '../lib/cookieConsent';

/** Reactive read of this slug's cookie-consent choice — updates immediately
 * when the banner (or another tab) changes it, via `onCookieConsentChange`. */
export function useCookieConsent(slug: string | undefined): CookieConsentStatus {
  const [status, setStatus] = useState<CookieConsentStatus>(() => getCookieConsent(slug));

  useEffect(() => {
    setStatus(getCookieConsent(slug));
    return onCookieConsentChange((changedSlug, newStatus) => {
      if (changedSlug === slug) setStatus(newStatus);
    });
  }, [slug]);

  return status;
}
