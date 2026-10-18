import { useEffect, useState } from 'react';
import { BellRing, Loader2, RotateCcw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import AnnouncementBar from '../../components/AnnouncementBar';
import { APP_NAME } from '../../lib/brand';
import { pick } from '../../lib/localized';
import { RTL_LOCALES } from '../../i18n';

interface AnnouncementSettings {
  announcement_enabled: boolean;
  announcement_message: Record<string, string> | null;
}

// Every language the marketing site ships (web/src/i18n/locales).
const LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
};
const LOCALES = Object.keys(LOCALE_LABELS);
const MAX_LENGTH = 300;

// Empty languages are sent as missing, and no text at all as null — the
// site then falls back to its own translated beta notice.
function cleanMessage(message: Record<string, string>): Record<string, string> | null {
  const filled = Object.fromEntries(Object.entries(message).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return Object.keys(filled).length ? filled : null;
}

export default function AnnouncementBarPage() {
  const { i18n } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [activeLocale, setActiveLocale] = useState('ar');

  const apply = (data: AnnouncementSettings) => {
    setEnabled(data.announcement_enabled);
    setMessage(data.announcement_message ?? {});
  };

  useEffect(() => {
    api.get<AnnouncementSettings>('/admin/platform-settings').then((res) => {
      apply(res.data);
      setLoading(false);
    });
  }, []);

  const defaultText = (locale: string) => i18n.getFixedT(locale)('betaBanner.message', { appName: APP_NAME });

  const save = async (next: { enabled: boolean; message: Record<string, string> }) => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await api.put<AnnouncementSettings>('/admin/platform-settings', {
        announcement_enabled: next.enabled,
        announcement_message: cleanMessage(next.message),
      });
      apply(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذّر الحفظ، حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    save({ enabled, message });
  };

  const handleRestoreDefault = () => {
    if (!confirm('حذف النص المخصص بكل اللغات والعودة للنص الافتراضي؟')) return;
    save({ enabled, message: {} });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  }

  const previewText = pick(cleanMessage(message), activeLocale, defaultText(activeLocale));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <BellRing className="text-[var(--color-primary)]" size={24} /> شريط الإعلان
      </h1>
      <p className="text-gray-500 mt-1">الشريط الأحمر المتحرك أعلى الموقع الرئيسي ({APP_NAME}). أظهره أو أخفه، وغيّر نصه لكل لغة.</p>

      <form onSubmit={handleSave} className="mt-6 card p-6 space-y-5">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" className="rounded border-gray-300" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          إظهار الشريط على الموقع
        </label>

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
                {LOCALE_LABELS[code]}{message[code]?.trim() ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            نص الشريط — {LOCALE_LABELS[activeLocale]}
            <span className="text-gray-400 font-normal"> — {(message[activeLocale] ?? '').length}/{MAX_LENGTH}</span>
          </label>
          <textarea
            rows={2}
            maxLength={MAX_LENGTH}
            dir={RTL_LOCALES.includes(activeLocale) ? 'rtl' : 'ltr'}
            className="input w-full"
            placeholder={defaultText(activeLocale)}
            value={message[activeLocale] ?? ''}
            onChange={(e) => setMessage((prev) => ({ ...prev, [activeLocale]: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">
            اللغة التي تتركها فارغة تعرض نص أول لغة كتبتها. إن تركت كل اللغات فارغة يظهر النص الافتراضي المترجم (الظاهر في الحقل بلون باهت).
          </p>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">معاينة ({LOCALE_LABELS[activeLocale]})</p>
          <div dir={RTL_LOCALES.includes(activeLocale) ? 'rtl' : 'ltr'} className={`rounded-lg overflow-hidden border border-gray-200 ${enabled ? '' : 'opacity-40'}`}>
            <AnnouncementBar message={previewText} />
          </div>
          {!enabled && <p className="text-xs text-amber-700 mt-1">الشريط مخفي حاليًا — لن يراه زوار الموقع.</p>}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <button type="button" onClick={handleRestoreDefault} disabled={saving} className="btn btn-outline flex items-center gap-2">
            <RotateCcw size={16} /> استعادة النص الافتراضي
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary min-w-[140px] flex justify-center items-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ ✓' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  );
}
