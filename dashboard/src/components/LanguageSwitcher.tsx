import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-500">
      <Languages size={16} className="text-gray-400" />
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent border-0 text-sm text-gray-600 focus:outline-none cursor-pointer"
        aria-label="Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
