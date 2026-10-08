import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, ChefHat, Check } from 'lucide-react';
import SocialLinks from './SocialLinks';
import { getPlatformSiteUrl } from '../../lib/publicSite';
import type { RestaurantInfo } from '../../types/public';
import { countryName } from '../../lib/countryName';
import { usePublicSlug } from '../../hooks/usePublicSlug';
import { setCookieConsent } from '../../lib/cookieConsent';

/**
 * Shared dark footer for a restaurant's public pages (menu, blog, article,
 * item detail) — restaurant contact info + the legal pages every tenant
 * gets (Privacy, Terms & Copyright, Accessibility — see PublicLegalPage),
 * so those pages are reachable from anywhere on the site, not just linked
 * ad hoc. Left off task-focused flow screens (cart, halls, order status)
 * where a marketing footer would just add friction.
 */
export default function PublicFooter({
  info,
  buildPath,
}: {
  info: RestaurantInfo;
  buildPath: (suffix: string) => string;
}) {
  const { t, i18n } = useTranslation();
  const { slug } = usePublicSlug();
  const [optedOut, setOptedOut] = useState(false);

  // CCPA/CPRA ("Do Not Sell or Share My Personal Information"): opting out
  // just withdraws cookie consent the same way declining the consent banner
  // does — the restaurant's analytics/marketing pixels (see useAnalytics.ts)
  // are the only "sharing" this site does, and both controls gate the exact
  // same stored choice. See LEGAL-04 in COMPLIANCE_SECURITY_PAYMENTS_PLAN.md.
  const handleDoNotSell = () => {
    setCookieConsent(slug, 'declined');
    setOptedOut(true);
  };

  return (
    <footer className="bg-gray-900 text-gray-400 mt-10">
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white overflow-hidden shrink-0">
              {info.avatar ? (
                <img src={info.avatar} alt={info.name} className="w-full h-full object-cover" />
              ) : (
                <ChefHat size={18} />
              )}
            </div>
            <span className="font-bold text-white">{info.name}</span>
          </div>
          {info.contact?.address && (
            <p className="flex items-start gap-2 mt-4 text-sm">
              <MapPin size={15} className="shrink-0 mt-0.5" />
              <span>{[info.contact.address, info.contact.city, info.contact.country && countryName(info.contact.country, i18n.resolvedLanguage ?? 'en')].filter(Boolean).join(', ')}</span>
            </p>
          )}
          {info.contact?.phone && (
            <p className="flex items-center gap-2 mt-2 text-sm">
              <Phone size={15} className="shrink-0" />
              <a href={`tel:${info.contact.phone}`} dir="ltr" className="hover:text-white transition-colors">{info.contact.phone}</a>
            </p>
          )}
          <SocialLinks social={info.social} className="mt-4" onDark />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white mb-3">{t('footer.explore')}</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to={buildPath('')} className="hover:text-white transition-colors">{t('footer.menu')}</Link></li>
            {info.blog_url && (
              <li><Link to={buildPath('/blog')} className="hover:text-white transition-colors">{t('menu.readOurBlog')}</Link></li>
            )}
            <li><Link to={buildPath('/halls')} className="hover:text-white transition-colors">{t('footer.findTable')}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white mb-3">{t('footer.legal')}</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to={buildPath('/privacy')} className="hover:text-white transition-colors">{t('legal.privacy.title')}</Link></li>
            <li><Link to={buildPath('/terms')} className="hover:text-white transition-colors">{t('legal.terms.title')}</Link></li>
            <li><Link to={buildPath('/accessibility')} className="hover:text-white transition-colors">{t('legal.accessibility.title')}</Link></li>
            <li>
              <button
                type="button"
                onClick={handleDoNotSell}
                className="hover:text-white transition-colors text-start inline-flex items-center gap-1.5"
              >
                {optedOut && <Check size={13} className="text-emerald-400 shrink-0" />}
                {optedOut ? t('footer.doNotSellConfirmed') : t('footer.doNotSell')}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>{t('menu.copyright', { year: new Date().getFullYear(), name: info.name })}</p>
          <a
            href={getPlatformSiteUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
          >
            {t('menu.poweredBy')}
            <span className="inline-flex items-center gap-1 font-semibold text-gray-300">
              <span className="bg-[#ff4757] text-white rounded-md p-0.5"><ChefHat size={11} /></span>
              RestaurantGo
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
