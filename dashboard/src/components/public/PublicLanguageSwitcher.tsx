import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { setStoredPublicLocale } from '../../lib/publicLocale';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
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
  const { i18n } = useTranslation();

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
        aria-label="Language"
        className="bg-transparent border-0 text-sm focus:outline-none cursor-pointer"
      >
        {languages.map((code) => (
          <option key={code} value={code} className="text-gray-900">{LANGUAGE_NAMES[code] ?? code}</option>
        ))}
      </select>
    </label>
  );
}
