import { useEffect, useState } from 'react';
import { Globe, Loader2, Save } from 'lucide-react';
import api from '../../api/axios';

interface PlatformSettings {
  seo_title: Record<string, string> | null;
  seo_description: Record<string, string> | null;
  seo_og_image: string | null;
  google_site_verification: string | null;
}

// Every language the marketing site itself ships (web/src/i18n/locales) —
// the platform's own SEO covers all of them, unlike a tenant's, which only
// covers the languages that one restaurant selected.
const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
};
const LOCALES = Object.keys(LOCALE_LABELS);

export default function PlatformSeoPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeLocale, setActiveLocale] = useState('en');

  useEffect(() => {
    api.get<PlatformSettings>('/admin/platform-settings').then((res) => {
      setSettings({
        ...res.data,
        seo_title: res.data.seo_title ?? {},
        seo_description: res.data.seo_description ?? {},
      });
      setLoading(false);
    });
  }, []);

  const handleChange = (field: 'seo_og_image' | 'google_site_verification', value: string) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleLocalizedChange = (field: 'seo_title' | 'seo_description', value: string) => {
    setSettings((prev) => (prev ? { ...prev, [field]: { ...prev[field], [activeLocale]: value } } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.put<PlatformSettings>('/admin/platform-settings', settings);
      setSettings({
        ...res.data,
        seo_title: res.data.seo_title ?? {},
        seo_description: res.data.seo_description ?? {},
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Globe className="text-[var(--color-primary)]" size={24} /> السيو وبحث غوغل
      </h1>
      <p className="text-gray-500 mt-1">تتحكم في كيفية ظهور موقع الشركة الرئيسي (RestaurantGo) في بحث غوغل وعند مشاركته على وسائل التواصل — لا علاقة لها بصفحات المطاعم الفردية، فكل مطعم يدير سيو صفحته الخاصة من لوحته. العنوان والوصف يُكتبان بكل اللغات التي يدعمها الموقع.</p>

      <form onSubmit={handleSave} className="mt-6 card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">اللغة</label>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setActiveLocale(code)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeLocale === code ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {LOCALE_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">عنوان Meta</label>
          <input
            type="text"
            className="input w-full"
            placeholder="RestaurantGo — منصة إدارة المطاعم"
            value={settings.seo_title?.[activeLocale] ?? ''}
            onChange={(e) => handleLocalizedChange('seo_title', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            وصف Meta
            <span className="text-gray-400 font-normal"> — {(settings.seo_description?.[activeLocale] ?? '').length}/160 يظهر في نتائج البحث</span>
          </label>
          <textarea
            rows={2}
            className="input w-full"
            value={settings.seo_description?.[activeLocale] ?? ''}
            onChange={(e) => handleLocalizedChange('seo_description', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة المشاركة الاجتماعية</label>
          <input
            type="text"
            className="input w-full"
            placeholder="https://…"
            value={settings.seo_og_image ?? ''}
            onChange={(e) => handleChange('seo_og_image', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">صورة واحدة مشتركة لكل اللغات — لا تحتاج ترجمة.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">التحقق من ملكية الموقع (Google Search Console)</label>
          <input
            type="text"
            className="input w-full"
            placeholder="الصق فقط قيمة content من وسم التحقق"
            value={settings.google_site_verification ?? ''}
            onChange={(e) => handleChange('google_site_verification', e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            من طريقة التحقق "HTML tag" في Search Console. إذا لم يتحقق (هذا موقع يُعرض عبر JavaScript)، استخدم طريقة سجل DNS TXT بدلًا من ذلك.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn btn-primary min-w-[140px] flex justify-center items-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ ✓' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  );
}
