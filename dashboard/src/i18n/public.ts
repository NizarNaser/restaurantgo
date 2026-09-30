import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './publicLocales/en.json';
import ar from './publicLocales/ar.json';
import fr from './publicLocales/fr.json';
import de from './publicLocales/de.json';
import es from './publicLocales/es.json';
import it from './publicLocales/it.json';
import pt from './publicLocales/pt.json';
import ru from './publicLocales/ru.json';
import uk from './publicLocales/uk.json';
import tr from './publicLocales/tr.json';
import zh from './publicLocales/zh.json';
import ja from './publicLocales/ja.json';

// A restaurant's public menu/site supports up to 12 languages (chosen by the
// owner in Settings), independent of the admin dashboard's own en/ar-only
// i18n instance (`./index.ts`) — a separate instance so a customer's language
// choice never affects staff, and vice versa. Wired into the public route
// tree via <I18nextProvider> in `layouts/PublicI18nLayout.tsx`.
const publicI18n = i18n.createInstance();

publicI18n.use(initReactI18next).init({
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
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'uk', 'tr', 'zh', 'ja'],
  interpolation: { escapeValue: false },
});

export default publicI18n;
