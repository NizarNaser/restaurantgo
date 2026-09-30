import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import publicI18n from '../i18n/public';
import adminI18n, { RTL_LOCALES } from '../i18n/index';
import { getStoredPublicLocale } from '../lib/publicLocale';
import { usePublicSlug } from '../hooks/usePublicSlug';

function applyDir(locale: string) {
  document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

/**
 * Wraps every public restaurant route (/p/:slug/...) in its own i18next
 * instance — independent from the admin dashboard's en/ar-only instance —
 * so a customer's language choice is scoped to this route tree and never
 * leaks into (or out of) the staff-facing dashboard.
 */
export default function PublicI18nLayout() {
  const { slug } = usePublicSlug();

  // Restore this restaurant's previously-picked language on load/navigation.
  useEffect(() => {
    const stored = getStoredPublicLocale(slug);
    if (stored && stored !== publicI18n.resolvedLanguage) {
      publicI18n.changeLanguage(stored);
    }
  }, [slug]);

  useEffect(() => {
    applyDir(publicI18n.resolvedLanguage ?? 'en');
    publicI18n.on('languageChanged', applyDir);
    return () => {
      publicI18n.off('languageChanged', applyDir);
      // Leaving the public site back into the dashboard — restore whatever
      // direction the admin instance actually uses, since both share the
      // same <html> element in this single-page app.
      applyDir(adminI18n.resolvedLanguage ?? 'en');
    };
  }, []);

  return (
    <I18nextProvider i18n={publicI18n}>
      <Outlet />
    </I18nextProvider>
  );
}
