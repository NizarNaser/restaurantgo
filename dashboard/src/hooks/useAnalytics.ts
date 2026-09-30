import { useEffect } from 'react';
import type { RestaurantAnalytics } from '../types/public';

const MANAGED = 'data-analytics-managed';

/**
 * Injects the tenant's own Google Analytics (GA4) and/or Meta Pixel on their
 * public menu page — `tenants.google_analytics_id`/`facebook_pixel_id` were
 * columns with nothing reading them until now. No-ops per id the tenant
 * hasn't set, and tears everything down on unmount/tenant change so one
 * restaurant's pixel never leaks onto another's page.
 */
export function useAnalytics(analytics?: RestaurantAnalytics | null) {
  const gaId = analytics?.google_analytics_id ?? null;
  const pixelId = analytics?.facebook_pixel_id ?? null;

  useEffect(() => {
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
  }, [gaId, pixelId]);
}
