import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../i18n';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();

  return (
    <label className={`flex items-center gap-1.5 text-sm text-gray-500 ${className}`}>
      <Languages size={16} className="text-gray-400 shrink-0" />
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent border-0 text-sm text-gray-600 focus:outline-none cursor-pointer"
        aria-label={t('nav.languageAriaLabel')}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}
