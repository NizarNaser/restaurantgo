import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChefHat } from 'lucide-react';
import PublicLanguageSwitcher from './PublicLanguageSwitcher';
import type { RestaurantInfo } from '../../types/public';

/**
 * Shared top bar for secondary public pages (blog, legal pages, ...): the
 * restaurant's own identity plus a language switcher, so a customer who
 * lands directly on one of these (a search result, a shared link) isn't
 * stuck on an anonymous-looking page with no way to get back to the menu
 * or change language — both of which the main menu page already offers but
 * these pages previously didn't.
 */
export default function PublicPageHeader({
  info,
  slug,
  buildPath,
  title,
  subtitle,
}: {
  info: RestaurantInfo;
  slug: string | undefined;
  buildPath: (suffix: string) => string;
  title?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <Link to={buildPath('')} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center text-white overflow-hidden shrink-0">
            {info.avatar ? (
              <img src={info.avatar} alt={info.name} className="w-full h-full object-cover" />
            ) : (
              <ChefHat size={16} />
            )}
          </div>
          <span className="font-bold text-gray-900 truncate">{info.name}</span>
        </Link>
        {info.supported_locales?.length > 1 && (
          <PublicLanguageSwitcher slug={slug} languages={info.supported_locales} />
        )}
      </div>

      {(title || subtitle) && (
        <div className="max-w-3xl mx-auto px-4 pb-8 pt-2">
          <Link to={buildPath('')} className="btn btn-outline rounded-full text-sm gap-1.5">
            <ArrowLeft size={16} />
            {t('common.backToMenu')}
          </Link>
          {title && <h1 className="text-3xl font-bold text-gray-900 mt-4">{title}</h1>}
          {subtitle && <p className="text-gray-500 mt-2">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
