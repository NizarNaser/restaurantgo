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

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

/**
 * Points the page at this tenant's own Web App Manifest (see
 * MenuController::manifest on the API) so "Add to Home Screen"/Android's
 * install prompt picks up the restaurant's name and logo, not a generic
 * one — swapped per slug the same way the tab favicon already is.
 */
function useTenantManifestLink(slug: string | undefined) {
  useEffect(() => {
    if (!slug) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `${PUBLIC_API}/${slug}/manifest.webmanifest`;
    return () => link?.remove();
  }, [slug]);
}

/**
 * Wraps every public restaurant route (/p/:slug/...) in its own i18next
 * instance — independent from the admin dashboard's en/ar-only instance —
 * so a customer's language choice is scoped to this route tree and never
 * leaks into (or out of) the staff-facing dashboard.
 */
/**
 * Chrome/Android only offers the install prompt (`beforeinstallprompt`,
 * see InstallAppPrompt.tsx) once an active service worker is registered —
 * without it, the manifest alone isn't enough to make the page
 * installable. Registered only here, in the public-site layout, so it
 * never touches the staff-facing admin dashboard.
 */
function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
}

export default function PublicI18nLayout() {
  const { slug } = usePublicSlug();

  useTenantManifestLink(slug);
  useServiceWorker();

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
