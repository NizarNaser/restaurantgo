import { useEffect } from 'react';
import type { RestaurantAnalytics } from '../types/public';
import { usePublicSlug } from './usePublicSlug';
import { useCookieConsent } from './useCookieConsent';

const MANAGED = 'data-analytics-managed';

/**
 * Injects the tenant's own Google Analytics (GA4) and/or Meta Pixel on their
 * public menu page — `tenants.google_analytics_id`/`facebook_pixel_id` were
 * columns with nothing reading them until now. No-ops per id the tenant
 * hasn't set, and tears everything down on unmount/tenant change so one
 * restaurant's pixel never leaks onto another's page.
 *
 * Gated on this visitor's cookie-consent choice (see `CookieConsentBanner`)
 * — these are non-essential tracking scripts, so under GDPR/ePrivacy they
 * must not load before an explicit opt-in, not just be removable after the
 * fact. See PRIV-01 in COMPLIANCE_SECURITY_PAYMENTS_PLAN.md.
 */
export function useAnalytics(analytics?: RestaurantAnalytics | null) {
  const { slug } = usePublicSlug();
  const consent = useCookieConsent(slug);
  const gaId = analytics?.google_analytics_id ?? null;
  const pixelId = analytics?.facebook_pixel_id ?? null;

  useEffect(() => {
    if (consent !== 'accepted') return;
    if (!gaId && !pixelId) return;

    if (gaId) {
      const loader = document.createElement('script');
      loader.async = true;
      loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      loader.setAttribute(MANAGED, '');
      document.head.appendChild(loader);

      const inline = document.createElement('script');
      inline.setAttribute(MANAGED, '');
      inline.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', ${JSON.stringify(gaId)});
      `;
      document.head.appendChild(inline);
    }

    if (pixelId) {
      const inline = document.createElement('script');
      inline.setAttribute(MANAGED, '');
      inline.textContent = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', ${JSON.stringify(pixelId)});
        fbq('track', 'PageView');
      `;
      document.head.appendChild(inline);
    }

    return () => {
      document.head.querySelectorAll(`script[${MANAGED}]`).forEach((el) => el.remove());
    };
  }, [gaId, pixelId, consent]);
}
