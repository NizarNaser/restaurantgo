import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { setStoredPublicLocale } from '../../lib/publicLocale';

// Every value here is a language's own native name, not translatable text
// (e.g. "العربية" is simply what Arabic is called) — i18n-check-ignore on
// each line below since the check can't otherwise tell that apart from a
// genuinely hardcoded string.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español', // i18n-check-ignore
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe', // i18n-check-ignore
  zh: '中文', ja: '日本語', // i18n-check-ignore
};

/**
 * Only offers the languages this restaurant's owner actually enabled
 * (`tenant.supported_locales`) — never the full 12-language list — and
 * hides itself entirely when there's nothing to choose between.
 */
export default function PublicLanguageSwitcher({
  slug,
  languages,
  className,
}: {
  slug: string | undefined;
  languages: string[];
  className?: string;
}) {
  const { t, i18n } = useTranslation();

  if (languages.length <= 1) return null;

  return (
    <label className={`flex items-center gap-1.5 text-sm ${className ?? ''}`}>
      <Languages size={16} />
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => {
          i18n.changeLanguage(e.target.value);
          setStoredPublicLocale(slug, e.target.value);
        }}
        aria-label={t('common.language')}
        className="bg-transparent border-0 text-sm focus:outline-none cursor-pointer"
      >
        {languages.map((code) => (
          <option key={code} value={code} className="text-gray-900">{LANGUAGE_NAMES[code] ?? code}</option>
        ))}
      </select>
    </label>
  );
}
