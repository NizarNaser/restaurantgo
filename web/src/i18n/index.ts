import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

export const RTL_LOCALES = ['ar'];

export const SUPPORTED_LOCALES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];

export function applyDirection(locale: string) {
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
      fr: { translation: fr },
      de: { translation: de },
      es: { translation: es },
      it: { translation: it },
      pt: { translation: pt },
      ru: { translation: ru },
      uk: { translation: uk },
      tr: { translation: tr },
      zh: { translation: zh },
      ja: { translation: ja },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
      lookupLocalStorage: 'web_locale',
    },
    interpolation: { escapeValue: false },
  });

applyDirection(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', applyDirection);

export default i18n;
