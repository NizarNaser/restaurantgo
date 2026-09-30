import { Outlet, Link, useLocation } from 'react-router-dom';
import { ChefHat, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AssistantWidget from '../components/AssistantWidget';
import api from '../api/axios';
import { useSeoHead, type SeoPayload } from '../hooks/useSeoHead';

interface PlatformSeoSettings {
  seo_title: Record<string, string> | null;
  seo_description: Record<string, string> | null;
  seo_og_image: string | null;
  google_site_verification: string | null;
}

const DEFAULT_TITLE = 'RestaurantGo — Restaurant Management Platform';
const DEFAULT_DESCRIPTION = 'Online menus, delivery, and dine-in ordering for restaurants — set up in minutes.';

// Resolves a locale-keyed SEO field to one string: exact language match,
// then the first available translation, then the site-wide default.
function pick(localized: Record<string, string> | null, locale: string, fallback: string): string {
  if (!localized) return fallback;
  const short = locale.split('-')[0];
  const value = localized[locale] ?? localized[short] ?? Object.values(localized)[0];
  return value || fallback;
}

export default function PublicLayout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [platformSeo, setPlatformSeo] = useState<SeoPayload | null>(null);

  // Refetched whenever the site language changes so the title/description
  // stay in the visitor's language — this is the site-wide default; any
  // individual public page is free to set document.title itself afterwards
  // (e.g. a specific restaurant's name) without conflict.
  useEffect(() => {
    api.get<PlatformSeoSettings>('/v1/platform/seo').then((res) => {
      const s = res.data;
      const title = pick(s.seo_title, i18n.language, DEFAULT_TITLE);
      const description = pick(s.seo_description, i18n.language, DEFAULT_DESCRIPTION);
      setPlatformSeo({
        title,
        description,
        robots: 'index, follow',
        google_site_verification: s.google_site_verification,
        og: {
          'og:type': 'website',
          'og:title': title,
          'og:description': description,
          'og:site_name': 'RestaurantGo',
          ...(s.seo_og_image ? { 'og:image': s.seo_og_image } : {}),
        },
        twitter: {
          'twitter:card': s.seo_og_image ? 'summary_large_image' : 'summary',
          'twitter:title': title,
          'twitter:description': description,
          ...(s.seo_og_image ? { 'twitter:image': s.seo_og_image } : {}),
        },
      });
    }).catch(() => {});
  }, [i18n.language]);

  useSeoHead(platformSeo);

  const navItems = [
    { to: '/', label: t('nav.home') },
    { to: '/restaurants', label: t('nav.restaurants') },
    { to: '/contact', label: t('nav.contact') },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]">
      <header className={`bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-shadow duration-300 ${scrolled ? 'shadow-[var(--shadow-soft)]' : 'border-b border-gray-100'}`}>
        <div className="container-page flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-[var(--color-primary)] p-1.5 rounded-xl text-white shadow-[var(--shadow-glow)] transition-transform group-hover:rotate-6 group-hover:scale-105">
              <ChefHat size={22} />
            </div>
            <span className="text-lg font-extrabold text-gray-800">RestaurantGo</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  location.pathname === item.to
                    ? 'text-[var(--color-primary)]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
                {location.pathname === item.to && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[var(--color-primary)]"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/register" className="btn btn-primary">
              {t('nav.registerCta')}
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen((v) => !v)} aria-label={t('nav.menuAriaLabel')}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="md:hidden overflow-hidden border-t border-gray-100"
            >
              <div className="px-4 py-3 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link to="/register" className="btn btn-primary w-full mt-2">
                  {t('nav.registerCta')}
                </Link>
                <div className="pt-2">
                  <LanguageSwitcher />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[var(--color-secondary)] text-gray-300 mt-16">
        <div className="container-page py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-[var(--color-primary)] p-1.5 rounded-xl text-white">
                <ChefHat size={20} />
              </div>
              <span className="text-lg font-extrabold text-white">RestaurantGo</span>
            </div>
            <p className="text-sm text-gray-400">{t('footer.tagline')}</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.quickLinks')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/restaurants" className="hover:text-white transition-colors">{t('footer.browseRestaurants')}</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">{t('nav.registerCta')}</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">{t('nav.contact')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">{t('nav.contact')}</h3>
            <p className="text-sm text-gray-400">support@restaurantgo.com</p>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} RestaurantGo. {t('footer.rightsReserved')}
        </div>
      </footer>

      <AssistantWidget />
    </div>
  );
}
