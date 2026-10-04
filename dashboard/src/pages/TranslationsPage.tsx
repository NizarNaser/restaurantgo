import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../api/axios';

interface LocaleStats {
  total: number;
  translated: number;
  missing: number;
  needs_review: number;
}

interface NeedsReviewRow {
  type: 'menu_item' | 'menu_category' | 'department' | 'article';
  id: number;
  locale: string;
  name: string;
}

interface LocaleSummary {
  locale: string;
  menu_items: LocaleStats;
  menu_categories: LocaleStats;
  departments: LocaleStats;
  articles: LocaleStats;
  needs_review: NeedsReviewRow[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
};

const TYPE_LINKS: Record<NeedsReviewRow['type'], string> = {
  menu_item: '/menu',
  menu_category: '/menu',
  department: '/restaurant-setup',
  article: '/articles',
};

function StatBar({ stats, label }: { stats: LocaleStats; label: string }) {
  const pct = stats.total === 0 ? 0 : Math.round((stats.translated / stats.total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{stats.translated}/{stats.total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-[#ff4757]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TranslationsPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<LocaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [translatingLocale, setTranslatingLocale] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const fetchSummary = async () => {
    const res = await api.get<{ data: LocaleSummary[] }>('/translations/summary');
    setSummary(res.data.data);
    setLoading(false);
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleBulkTranslate = async (locale: string) => {
    setTranslatingLocale(locale);
    setNotice('');
    try {
      await api.post('/translations/bulk', { target_locale: locale });
      setNotice(t('translations.startedNotice', { language: LANGUAGE_NAMES[locale] ?? locale }));
    } catch (err: any) {
      setNotice(err.response?.data?.message || t('translations.startFailed'));
    } finally {
      setTranslatingLocale(null);
    }
  };

  const handleMarkReviewed = async (row: NeedsReviewRow) => {
    const key = `${row.type}-${row.id}-${row.locale}`;
    setReviewingKey(key);
    try {
      await api.post('/translations/mark-reviewed', { type: row.type, id: row.id, locale: row.locale });
      await fetchSummary();
    } finally {
      setReviewingKey(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Languages className="text-[#ff4757]" size={24} /> {t('nav.translations')}
        </h1>
        <p className="text-gray-500 mt-1">{t('translations.subtitle')}</p>
      </div>

      {notice && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">{notice}</p>}

      {summary.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          {t('translations.onlyOneLanguage')}
        </div>
      )}

      <div className="space-y-4">
        {summary.map((row) => (
          <div key={row.locale} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{LANGUAGE_NAMES[row.locale] ?? row.locale}</h2>
              <button
                onClick={() => handleBulkTranslate(row.locale)}
                disabled={translatingLocale === row.locale}
                className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {translatingLocale === row.locale ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {t('translations.translateMissing')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatBar stats={row.menu_items} label={t('translations.menuItems')} />
              <StatBar stats={row.menu_categories} label={t('translations.categories')} />
              <StatBar stats={row.departments} label={t('translations.departments')} />
              <StatBar stats={row.articles} label={t('translations.articles')} />
            </div>

            {row.needs_review.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-amber-600">{t('translations.needsReview', { count: row.needs_review.length })}</p>
                {row.needs_review.map((r) => {
                  const key = `${r.type}-${r.id}-${r.locale}`;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <Link to={TYPE_LINKS[r.type]} className="text-gray-700 hover:text-[#ff4757] truncate">{r.name}</Link>
                      <button
                        onClick={() => handleMarkReviewed(r)}
                        disabled={reviewingKey === key}
                        className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 shrink-0"
                      >
                        {reviewingKey === key ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {t('translations.markReviewed')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
