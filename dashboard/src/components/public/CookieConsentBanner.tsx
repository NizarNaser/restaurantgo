import { useTranslation } from 'react-i18next';
import { usePublicSlug } from '../../hooks/usePublicSlug';
import { useCookieConsent } from '../../hooks/useCookieConsent';
import { setCookieConsent } from '../../lib/cookieConsent';

/**
 * Gates the restaurant's own analytics (see `useAnalytics.ts` — Google
 * Analytics / Meta Pixel, injected only once a visitor accepts here) behind
 * an explicit choice instead of firing trackers on page load. Required for
 * EU visitors under the ePrivacy Directive/GDPR; shown to everyone rather
 * than geo-targeted, since a reliable visitor-country signal isn't
 * available client-side and the friction is minimal. See PRIV-01 in
 * COMPLIANCE_SECURITY_PAYMENTS_PLAN.md.
 */
export default function CookieConsentBanner() {
  const { t } = useTranslation();
  const { slug, buildPath } = usePublicSlug();
  const status = useCookieConsent(slug);

  if (!slug || status !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="dialog" aria-live="polite" aria-label={t('cookieConsent.title')}>
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-gray-600 flex-1">
          {t('cookieConsent.message')}{' '}
          <a href={buildPath('/privacy')} className="underline text-gray-800 hover:text-[#ff4757]">
            {t('legal.privacy.title')}
          </a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCookieConsent(slug, 'declined')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {t('cookieConsent.necessaryOnly')}
          </button>
          <button
            type="button"
            onClick={() => setCookieConsent(slug, 'accepted')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#ff4757] hover:bg-[#ff6b81] transition-colors"
          >
            {t('cookieConsent.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
