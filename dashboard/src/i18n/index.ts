import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const RTL_LOCALES = ['ar'];

function applyDirection(locale: string) {
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'dashboard_locale',
    },
    interpolation: { escapeValue: false },
  });

applyDirection(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', applyDirection);

export default i18n;
