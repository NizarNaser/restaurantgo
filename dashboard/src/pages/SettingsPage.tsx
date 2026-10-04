import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Globe, Clock, DollarSign, Languages, QrCode, ExternalLink, BarChart3, Image as ImageIcon, Upload, Palette, KeyRound, Mail, Share2, MapPin, Phone, AlertTriangle, Percent } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

interface TenantSettings {
  name: string;
  slug: string;
  timezone: string;
  default_currency: string;
  default_locale: string;
  tax_rate: number | string;
  service_charge_rate: number | string;
  service_charge_message: string | null;
  service_charge_show_message: boolean;
  service_charge_apply_to_invoice: boolean;
  supported_locales: string[];
  logo_path: string | null;
  favicon_path: string | null;
  cover_image_path: string | null;
  seo_title: Record<string, string> | null;
  seo_description: Record<string, string> | null;
  seo_og_image: string | null;
  google_site_verification: string | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  custom_domain: string | null;
  has_white_label: boolean;
  public_url: string;
  sitemap_url: string;
  social_facebook_url: string | null;
  social_instagram_url: string | null;
  social_twitter_url: string | null;
  social_tiktok_url: string | null;
  social_youtube_url: string | null;
  social_snapchat_url: string | null;
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Weekday = typeof WEEKDAYS[number];

interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

type WeekHours = Record<Weekday, DayHours>;

const DEFAULT_DAY_HOURS: DayHours = { closed: true, open: '09:00', close: '22:00' };

function parseWorkingHours(raw: Record<string, string> | null | undefined): WeekHours {
  const week = {} as WeekHours;
  for (const day of WEEKDAYS) {
    const range = raw?.[day];
    const [open, close] = range?.split('-') ?? [];
    week[day] = open && close ? { closed: false, open, close } : { ...DEFAULT_DAY_HOURS };
  }
  return week;
}

function serializeWorkingHours(week: WeekHours): Record<string, string> {
  const out: Record<string, string> = {};
  for (const day of WEEKDAYS) {
    const d = week[day];
    if (!d.closed && d.open && d.close) out[day] = `${d.open}-${d.close}`;
  }
  return out;
}

interface BranchContact {
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  working_hours: Record<string, string> | null;
  google_maps_embed_url: string | null;
}

type BrandingImageType = 'logo' | 'favicon' | 'cover-image';

function ImageUploadField({
  label, hint, type, value, shape, onUploaded,
}: {
  label: string;
  hint: string;
  type: BrandingImageType;
  value: string | null;
  shape: 'square' | 'wide';
  onUploaded: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Must override the instance's default 'application/json' header here:
      // axios's transformRequest JSON-stringifies FormData bodies whenever it
      // sees a JSON content-type already set, silently dropping the file. Any
      // non-JSON value works — axios clears it again before the real browser
      // XHR send so the correct multipart boundary still gets added.
      const res = await api.post(`/settings/images/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = Object.values(res.data)[0] as string;
      onUploaded(url);
    } catch (err: any) {
      setError(err.response?.data?.message || t('settings.uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-400 mb-2">{hint}</p>
      <div className="flex items-center gap-4">
        <div className={`shrink-0 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center ${shape === 'square' ? 'w-16 h-16' : 'w-28 h-16'}`}>
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-300" />
          )}
        </div>
        <label className="btn btn-secondary border border-gray-200 cursor-pointer text-sm">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? t('settings.uploading') : t('settings.upload')}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function AccountSecurityCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [email, setEmail] = useState(user?.email ?? '');
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSaving(true);
    try {
      await api.put('/auth/profile/email', { email, password: emailPassword });
      await fetchUser();
      setEmailPassword('');
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (err: any) {
      setEmailError(err.response?.data?.message || t('settings.updateEmailFailed'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaving(true);
    try {
      await api.put('/auth/profile/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPasswordConfirmation,
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || t('settings.updatePasswordFailed'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
        <KeyRound size={18} className="text-[#ff4757]" /> {t('settings.accountSecurity')}
      </h2>

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
          <Mail size={14} /> {t('login.email')}
        </label>
        <input
          type="email"
          required
          className="input w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder={t('settings.currentPassword')}
          className="input w-full"
          value={emailPassword}
          onChange={(e) => setEmailPassword(e.target.value)}
        />
        {emailError && <p className="text-xs text-red-500">{emailError}</p>}
        <button type="submit" disabled={emailSaving} className="btn btn-secondary border border-gray-200 text-sm w-full flex justify-center items-center gap-2">
          {emailSaving ? <Loader2 size={16} className="animate-spin" /> : emailSaved ? t('settings.updated') : t('settings.updateEmail')}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-3 border-t border-gray-100">
        <label className="block text-sm font-medium text-gray-700">{t('settings.changePassword')}</label>
        <input
          type="password"
          required
          placeholder={t('settings.currentPassword')}
          className="input w-full"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder={t('settings.newPassword')}
          className="input w-full"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder={t('settings.confirmNewPassword')}
          className="input w-full"
          value={newPasswordConfirmation}
          onChange={(e) => setNewPasswordConfirmation(e.target.value)}
        />
        {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
        <button type="submit" disabled={passwordSaving} className="btn btn-secondary border border-gray-200 text-sm w-full flex justify-center items-center gap-2">
          {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : passwordSaved ? t('settings.updated') : t('settings.updatePassword')}
        </button>
      </form>
    </div>
  );
}

function DangerZoneCard({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const logout = useAuthStore((s) => s.logout);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!hasRole('owner')) return null;

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      await api.post('/gdpr/erasure-request', { confirm_slug: confirmText });
      await logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || t('settings.deleteRestaurantFailed'));
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6 space-y-4">
      <h2 className="text-base font-semibold text-red-600 flex items-center gap-2">
        <AlertTriangle size={18} /> {t('settings.dangerZone')}
      </h2>
      <div>
        <p className="text-sm font-medium text-gray-800">{t('settings.deleteRestaurant')}</p>
        <p className="text-xs text-gray-500 mt-1">{t('settings.deleteRestaurantDesc')}</p>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        {t('settings.deleteRestaurantConfirmLabel', { slug })}
      </label>
      <input
        type="text"
        className="input w-full"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        disabled={deleting || confirmText !== slug}
        onClick={handleDelete}
        className="btn w-full justify-center text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? <Loader2 size={16} className="animate-spin" /> : t('settings.deleteRestaurantButton')}
      </button>
    </div>
  );
}

const TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Kyiv', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Beirut', 'Africa/Cairo', 'Asia/Baghdad'];
// A starting set of common currencies shown as suggestions — not an
// exhaustive list (ISO 4217 has ~180 of them, and this restaurant's own
// list of operating currencies keeps growing as RestaurantGo reaches new
// countries). The field below accepts any 3-letter code typed in, exactly
// like the per-item price currency field on the Menu page already does —
// this is just the autocomplete list, not a hard restriction.
const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'LBP', 'IQD', 'JOD', 'KWD', 'BHD', 'OMR', 'QAR',
  'TRY', 'ILS', 'MAD', 'TND', 'DZD', 'UAH', 'RUB', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'CHF',
  'SEK', 'NOK', 'DKK', 'CNY', 'JPY', 'KRW', 'INR', 'PKR', 'THB', 'MYR', 'IDR', 'PHP', 'VND',
  'SGD', 'HKD', 'CAD', 'AUD', 'NZD', 'BRL', 'MXN', 'ZAR', 'NGN', 'KES', 'GHS',
];
// The default/primary language for the restaurant's public menu and site.
const LOCALES = [
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

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSeoLocale, setActiveSeoLocale] = useState('en');
  // Tracks which languages were enabled the last time we loaded/saved, so
  // after a save we can tell which ones are brand new and offer to
  // auto-translate the existing menu/blog into them.
  const knownLocalesRef = useRef<string[]>([]);

  const [domainInput, setDomainInput] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState('');

  const [branch, setBranch] = useState<BranchContact | null>(null);
  const [workingHours, setWorkingHours] = useState<WeekHours>(parseWorkingHours(null));
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchSaved, setBranchSaved] = useState(false);

  const [mapsUrlInput, setMapsUrlInput] = useState('');
  const [mapsUrlResolving, setMapsUrlResolving] = useState(false);
  const [mapsUrlError, setMapsUrlError] = useState('');

  const [embedInput, setEmbedInput] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/settings');
        const data = res.data;
        // Some tenants predate the supported-languages feature and still have
        // an empty list — treating that as "nothing to save" would block
        // saving anything else on this form (see handleSave's language-count
        // guard), so backfill it with the tenant's own default on load.
        if (!data.supported_locales || data.supported_locales.length === 0) {
          data.supported_locales = [data.default_locale || 'en'];
        }
        setSettings(data);
        knownLocalesRef.current = data.supported_locales;
        setActiveSeoLocale(data.default_locale || 'en');
      } catch (e: any) {
        console.error('Failed to load settings', e);
        // Without this, a failed load (e.g. a suspended/unpaid account
        // getting a 403) left `settings` null while the form still rendered
        // — every field looked normal but silently discarded every
        // keystroke, since handleChange has nothing to update.
        setLoadError(e.response?.data?.message || t('settings.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetch();

    api.get('/branch').then((res) => {
      setBranch(res.data);
      setWorkingHours(parseWorkingHours(res.data.working_hours));
      setEmbedInput(res.data.google_maps_embed_url ?? '');
    }).catch((e) => console.error('Failed to load branch contact info', e));
  }, []);

  // Mirrors the backend's own extraction (BranchController::extractEmbedSrc)
  // just closely enough to preview instantly client-side — the server still
  // re-validates and is the actual source of truth when Save Changes is clicked.
  const extractedEmbedUrl = (() => {
    const raw = embedInput.trim();
    if (!raw) return null;
    const iframeMatch = raw.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
    const url = iframeMatch ? iframeMatch[1] : raw;
    return /^https:\/\/www\.google\.com\/maps\/embed[?/]/i.test(url) ? url : null;
  })();

  const handleBranchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!branch) return;
    setBranch({ ...branch, [e.target.name]: e.target.value });
  };

  const updateDayHours = (day: Weekday, patch: Partial<DayHours>) => {
    setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  // Pinpoints the branch on the map without needing a Google Maps API key:
  // the owner opens Google Maps themselves, taps Share, and pastes the link
  // here — the backend resolves it (following the short-link redirect if
  // needed) into coordinates, which get merged into the branch draft below
  // and saved along with everything else on "Save Changes".
  const resolveMapsLink = async () => {
    if (!branch || !mapsUrlInput.trim()) return;
    setMapsUrlResolving(true);
    setMapsUrlError('');
    try {
      const res = await api.post('/branch/resolve-maps-url', { url: mapsUrlInput.trim() });
      setBranch({ ...branch, latitude: res.data.latitude, longitude: res.data.longitude });
      setMapsUrlInput('');
    } catch (err: any) {
      setMapsUrlError(err.response?.data?.message || t('settings.saveFailed'));
    } finally {
      setMapsUrlResolving(false);
    }
  };

  const saveBranch = async () => {
    if (!branch) return;
    setBranchSaving(true);
    setBranchSaved(false);
    try {
      const res = await api.put('/branch', {
        phone: branch.phone || null,
        address: branch.address || null,
        city: branch.city || null,
        country: branch.country || null,
        latitude: branch.latitude || null,
        longitude: branch.longitude || null,
        working_hours: serializeWorkingHours(workingHours),
        google_maps_embed: embedInput.trim() || null,
      });
      setBranch(res.data);
      setWorkingHours(parseWorkingHours(res.data.working_hours));
      setEmbedInput(res.data.google_maps_embed_url ?? '');
      setBranchSaved(true);
      setTimeout(() => setBranchSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || t('settings.saveFailed'));
    } finally {
      setBranchSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!settings) return;
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const toggleSupportedLocale = (code: string) => {
    if (!settings) return;
    const current = settings.supported_locales ?? [];
    setSettings({
      ...settings,
      supported_locales: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if ((settings.supported_locales ?? []).length === 0) {
      alert(t('settings.selectAtLeastOneLanguage'));
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/settings', {
        name: settings.name,
        timezone: settings.timezone,
        default_currency: settings.default_currency,
        default_locale: settings.default_locale,
        tax_rate: settings.tax_rate || 0,
        service_charge_rate: settings.service_charge_rate || 0,
        service_charge_message: settings.service_charge_message || null,
        service_charge_show_message: settings.service_charge_show_message ?? false,
        service_charge_apply_to_invoice: settings.service_charge_apply_to_invoice ?? false,
        supported_locales: settings.supported_locales,
        seo_title: settings.seo_title || null,
        seo_description: settings.seo_description || null,
        seo_og_image: settings.seo_og_image || null,
        google_site_verification: settings.google_site_verification || null,
        google_analytics_id: settings.google_analytics_id || null,
        facebook_pixel_id: settings.facebook_pixel_id || null,
        social_facebook_url: settings.social_facebook_url || null,
        social_instagram_url: settings.social_instagram_url || null,
        social_twitter_url: settings.social_twitter_url || null,
        social_tiktok_url: settings.social_tiktok_url || null,
        social_youtube_url: settings.social_youtube_url || null,
        social_snapchat_url: settings.social_snapchat_url || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      const newLocales = (settings.supported_locales ?? []).filter(
        (code) => !knownLocalesRef.current.includes(code),
      );
      knownLocalesRef.current = settings.supported_locales ?? [];

      for (const locale of newLocales) {
        const localeName = LOCALES.find((l) => l.code === locale)?.name ?? locale;
        if (confirm(t('settings.translateNewLanguageConfirm', { language: localeName }))) {
          try {
            await api.post('/translations/bulk', { target_locale: locale });
          } catch {
            // Non-critical — the owner can still trigger this later from
            // the Translations page.
          }
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveDomain = async () => {
    if (!settings || !domainInput.trim()) return;
    setDomainSaving(true);
    setDomainError('');
    try {
      const res = await api.post('/settings/custom-domain', { domain: domainInput.trim() });
      setSettings({ ...settings, custom_domain: res.data.custom_domain });
      setDomainInput('');
    } catch (err: any) {
      setDomainError(err.response?.data?.message || t('settings.saveFailed'));
    } finally {
      setDomainSaving(false);
    }
  };

  const removeDomain = async () => {
    if (!settings || !confirm(t('settings.removeCustomDomainConfirm'))) return;
    setDomainSaving(true);
    try {
      await api.delete('/settings/custom-domain');
      setSettings({ ...settings, custom_domain: null });
    } catch (err: any) {
      setDomainError(err.response?.data?.message || t('settings.saveFailed'));
    } finally {
      setDomainSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;
  }

  if (loadError || !settings) {
    return (
      <div className="max-w-lg mx-auto mt-12 bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
        {loadError || t('settings.loadFailed')}
      </div>
    );
  }

  const publicMenuUrl = settings?.public_url ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* General */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Globe size={18} className="text-[#ff4757]" /> {t('settings.generalInformation')}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.restaurantName')}</label>
              <input
                type="text"
                name="name"
                required
                className="input w-full"
                value={settings?.name ?? ''}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.menuSlug')}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-l-lg px-3 py-2.5">/p/</span>
                <input
                  type="text"
                  className="input w-full rounded-l-none border-l-0 bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={settings?.slug ?? ''}
                  disabled
                  readOnly
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('settings.slugCannotChange')}</p>
            </div>
          </div>

          {/* Visit or contact us — feeds the public menu page's contact card */}
          {/* A plain div, not a <form> — it already sits inside the page's
              main settings <form>, and nested <form> elements are invalid
              HTML that silently breaks submission (the browser routes the
              button's click to the outer form instead), which was why this
              section's own "Save" button did nothing. */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <MapPin size={18} className="text-[#ff4757]" /> {t('settings.visitOrContact')}
            </h2>
            <p className="text-sm text-gray-500 -mt-2">{t('settings.visitOrContactDesc')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Phone size={14} /> {t('settings.phone')}</label>
                <input
                  type="text"
                  name="phone"
                  className="input w-full"
                  value={branch?.phone ?? ''}
                  onChange={handleBranchChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.address')}</label>
                <input
                  type="text"
                  name="address"
                  className="input w-full"
                  value={branch?.address ?? ''}
                  onChange={handleBranchChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.city')}</label>
                <input
                  type="text"
                  name="city"
                  className="input w-full"
                  value={branch?.city ?? ''}
                  onChange={handleBranchChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.countryCode')}</label>
                <input
                  type="text"
                  name="country"
                  maxLength={2}
                  placeholder="US"
                  className="input w-full uppercase"
                  value={branch?.country ?? ''}
                  onChange={handleBranchChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <MapPin size={14} /> {t('settings.pinOnMap')}
              </label>
              <p className="text-xs text-gray-500 mb-2">{t('settings.pinOnMapHint')}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('settings.pinOnMapPlaceholder')}
                  className="input flex-1"
                  value={mapsUrlInput}
                  onChange={(e) => setMapsUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolveMapsLink(); } }}
                />
                <button
                  type="button"
                  onClick={resolveMapsLink}
                  disabled={mapsUrlResolving || !mapsUrlInput.trim()}
                  className="btn btn-outline shrink-0 flex items-center gap-2"
                >
                  {mapsUrlResolving && <Loader2 size={14} className="animate-spin" />}
                  {t('settings.pinOnMapButton')}
                </button>
              </div>
              {mapsUrlError && <p className="text-xs text-red-500 mt-1">{mapsUrlError}</p>}
              {branch?.latitude && branch?.longitude && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  {t('settings.pinnedLocation')}{' '}
                  <a
                    href={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t('settings.viewOnMap')}
                  </a>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <MapPin size={14} /> {t('settings.embedMap')}
              </label>
              <p className="text-xs text-gray-500 mb-2">{t('settings.embedMapHint')}</p>
              <textarea
                rows={2}
                placeholder={t('settings.embedMapPlaceholder')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                value={embedInput}
                onChange={(e) => setEmbedInput(e.target.value)}
              />
              {embedInput.trim() && !extractedEmbedUrl && (
                <p className="text-xs text-red-500 mt-1">{t('settings.embedMapInvalid')}</p>
              )}
              {extractedEmbedUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    src={extractedEmbedUrl}
                    width="100%"
                    height="220"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={t('settings.embedMap')}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5"><Clock size={14} /> {t('settings.workingHours')}</label>
              <div className="space-y-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28 shrink-0 text-sm text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#ff4757]"
                        checked={!workingHours[day].closed}
                        onChange={(e) => updateDayHours(day, { closed: !e.target.checked })}
                      />
                      {t(`settings.weekdays.${day}`)}
                    </label>
                    {workingHours[day].closed ? (
                      <span className="text-sm text-gray-400">{t('settings.closedAllDay')}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          className="input py-1.5 text-sm"
                          value={workingHours[day].open}
                          onChange={(e) => updateDayHours(day, { open: e.target.value })}
                        />
                        <span className="text-gray-400 text-sm">–</span>
                        <input
                          type="time"
                          className="input py-1.5 text-sm"
                          value={workingHours[day].close}
                          onChange={(e) => updateDayHours(day, { close: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={saveBranch} disabled={branchSaving} className="btn btn-primary min-w-[140px] flex justify-center items-center gap-2">
                {branchSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {branchSaving ? t('hr.saving') : branchSaved ? t('settings.savedCheck') : t('settings.saveChanges')}
              </button>
            </div>
          </div>

          {/* Custom domain (white-label, Enterprise only) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Globe size={18} className="text-[#ff4757]" /> {t('settings.customDomain')}
            </h2>

            {!settings?.has_white_label ? (
              <p className="text-sm text-gray-500">
                {t('settings.customDomainUpsell')}{' '}
                <a href="/billing" className="text-[#ff4757] font-medium hover:underline">{t('settings.customDomainUpsellLink')}</a>
              </p>
            ) : settings.custom_domain ? (
              <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{settings.custom_domain}</p>
                  <p className="text-xs text-green-600 mt-0.5">{t('settings.customDomainConnected')}</p>
                </div>
                <button
                  type="button"
                  onClick={removeDomain}
                  disabled={domainSaving}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  {t('settings.removeCustomDomain')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">{t('settings.customDomainHint')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('settings.customDomainPlaceholder')}
                    className="input flex-1"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveDomain(); } }}
                  />
                  <button type="button" onClick={saveDomain} disabled={domainSaving || !domainInput.trim()} className="btn btn-primary shrink-0 flex items-center gap-2">
                    {domainSaving && <Loader2 size={14} className="animate-spin" />}
                    {t('settings.connectDomain')}
                  </button>
                </div>
                {domainError && <p className="text-xs text-red-500">{domainError}</p>}
              </div>
            )}
          </div>

          {/* Branding */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Palette size={18} className="text-[#ff4757]" /> {t('settings.branding')}
            </h2>
            <ImageUploadField
              label={t('settings.logo')}
              hint={t('settings.logoHint')}
              type="logo"
              shape="square"
              value={settings?.logo_path ?? null}
              onUploaded={(url) => settings && setSettings({ ...settings, logo_path: url })}
            />
            <ImageUploadField
              label={t('settings.favicon')}
              hint={t('settings.faviconHint')}
              type="favicon"
              shape="square"
              value={settings?.favicon_path ?? null}
              onUploaded={(url) => settings && setSettings({ ...settings, favicon_path: url })}
            />
            <ImageUploadField
              label={t('settings.headerCoverImage')}
              hint={t('settings.coverImageHint')}
              type="cover-image"
              shape="wide"
              value={settings?.cover_image_path ?? null}
              onUploaded={(url) => settings && setSettings({ ...settings, cover_image_path: url })}
            />
          </div>

          {/* Localization */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-[#ff4757]" /> {t('settings.localization')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.timezone')}</label>
                <select name="timezone" className="input w-full bg-white" value={settings?.timezone ?? 'UTC'} onChange={handleChange}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign size={14} /> {t('financial.currency')}
                </label>
                <input
                  name="default_currency"
                  list="currency-suggestions"
                  maxLength={3}
                  className="input w-full uppercase"
                  value={settings?.default_currency ?? 'USD'}
                  onChange={(e) => settings && setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
                />
                <datalist id="currency-suggestions">
                  {CURRENCIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Languages size={14} /> {t('settings.dashboardLanguage')}
                </label>
                <select name="default_locale" className="input w-full bg-white" value={settings?.default_locale ?? 'en'} onChange={handleChange}>
                  {LOCALES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('settings.dashboardLanguageHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.taxRate')}</label>
                <input
                  type="number" name="tax_rate" min={0} max={100} step={0.01}
                  className="input w-full"
                  value={settings?.tax_rate ?? 0}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-400 mt-1">{t('settings.taxRateHint')}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Languages size={14} /> {t('settings.interfaceLanguages')}
              </label>
              <p className="text-xs text-gray-400 mb-2">{t('settings.interfaceLanguagesHint')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOCALES.map((l) => (
                  <label key={l.code} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={(settings?.supported_locales ?? []).includes(l.code)}
                      onChange={() => toggleSupportedLocale(l.code)}
                      className="rounded border-gray-300"
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Service Charge — dine-in only, never applied to delivery/online orders */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Percent size={18} className="text-[#ff4757]" /> {t('settings.serviceCharge')}
            </h2>
            <p className="text-sm text-gray-500 -mt-2">{t('settings.serviceChargeDesc')}</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.serviceChargeRate')}</label>
              <input
                type="number" name="service_charge_rate" min={0} max={100} step={0.01}
                className="input w-full sm:w-48"
                value={settings?.service_charge_rate ?? 0}
                onChange={handleChange}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={settings?.service_charge_show_message ?? false}
                onChange={(e) => settings && setSettings({ ...settings, service_charge_show_message: e.target.checked })}
              />
              {t('settings.serviceChargeShowMessage')}
            </label>

            {settings?.service_charge_show_message && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.serviceChargeMessage')}</label>
                <textarea
                  name="service_charge_message" rows={2}
                  className="input w-full"
                  placeholder={t('settings.serviceChargeMessagePlaceholder')}
                  value={settings?.service_charge_message ?? ''}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-400 mt-1">{t('settings.serviceChargeMessageHint')}</p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={settings?.service_charge_apply_to_invoice ?? false}
                onChange={(e) => settings && setSettings({ ...settings, service_charge_apply_to_invoice: e.target.checked })}
              />
              {t('settings.serviceChargeApplyToInvoice')}
            </label>
            <p className="text-xs text-gray-400 -mt-3">{t('settings.serviceChargeApplyToInvoiceHint')}</p>
          </div>

          {/* Social Media */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Share2 size={18} className="text-[#ff4757]" /> {t('settings.socialMedia')}
            </h2>
            <p className="text-sm text-gray-500 -mt-2">
              {t('settings.socialMediaDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                <input
                  type="url"
                  name="social_facebook_url"
                  placeholder="https://facebook.com/your-restaurant"
                  className="input w-full"
                  value={settings?.social_facebook_url ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input
                  type="url"
                  name="social_instagram_url"
                  placeholder="https://instagram.com/your-restaurant"
                  className="input w-full"
                  value={settings?.social_instagram_url ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">X (Twitter)</label>
                <input
                  type="url"
                  name="social_twitter_url"
                  placeholder="https://x.com/your-restaurant"
                  className="input w-full"
                  value={settings?.social_twitter_url ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
                <input
                  type="url"
                  name="social_tiktok_url"
                  placeholder="https://tiktok.com/@your-restaurant"
                  className="input w-full"
                  value={settings?.social_tiktok_url ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YouTube</label>
                <input
                  type="url"
                  name="social_youtube_url"
                  placeholder="https://youtube.com/@your-restaurant"
                  className="input w-full"
                  value={settings?.social_youtube_url ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Snapchat</label>
                <input
                  type="url"
                  name="social_snapchat_url"
                  placeholder="https://snapchat.com/add/your-restaurant"
                  className="input w-full"
                  value={settings?.social_snapchat_url ?? ''}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Globe size={18} className="text-[#ff4757]" /> {t('settings.seo')}
            </h2>
            <p className="text-sm text-gray-500 -mt-2">{t('settings.seoDesc')}</p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.seoPerLanguage')}</label>
                <div className="flex flex-wrap gap-2">
                  {(settings?.supported_locales ?? ['en']).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveSeoLocale(code)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        activeSeoLocale === code ? 'bg-[#ff4757] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {LOCALES.find((l) => l.code === code)?.name ?? code}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.metaTitle')}</label>
                <input
                  type="text"
                  placeholder={settings?.name}
                  className="input w-full"
                  value={settings?.seo_title?.[activeSeoLocale] ?? ''}
                  onChange={(e) => settings && setSettings({
                    ...settings,
                    seo_title: { ...settings.seo_title, [activeSeoLocale]: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('menu.metaDescription')}
                  <span className="text-gray-400 font-normal"> — {t('menu.metaDescriptionCount', { count: settings?.seo_description?.[activeSeoLocale]?.length ?? 0 })}</span>
                </label>
                <textarea
                  rows={2}
                  className="input w-full"
                  value={settings?.seo_description?.[activeSeoLocale] ?? ''}
                  onChange={(e) => settings && setSettings({
                    ...settings,
                    seo_description: { ...settings.seo_description, [activeSeoLocale]: e.target.value },
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.socialShareImageUrl')}</label>
                <input
                  type="text"
                  name="seo_og_image"
                  placeholder="https://…"
                  className="input w-full"
                  value={settings?.seo_og_image ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.googleSiteVerification')}</label>
                <input
                  type="text"
                  name="google_site_verification"
                  placeholder={t('settings.googleSiteVerificationPlaceholder')}
                  className="input w-full"
                  value={settings?.google_site_verification ?? ''}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-400 mt-1">{t('settings.googleSiteVerificationHelp')}</p>
              </div>
              {settings?.public_url && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
                  <span>{t('settings.sitemapLabel')}:</span>
                  <a href={settings.sitemap_url} target="_blank" rel="noreferrer" className="text-[#ff4757] hover:underline break-all">
                    {settings.sitemap_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Analytics */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-[#ff4757]" /> {t('settings.analytics')}
            </h2>
            <p className="text-sm text-gray-500 -mt-2">
              {t('settings.analyticsDesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.googleAnalyticsId')}</label>
                <input
                  type="text"
                  name="google_analytics_id"
                  placeholder="G-XXXXXXXXXX"
                  className="input w-full"
                  value={settings?.google_analytics_id ?? ''}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.metaPixelId')}</label>
                <input
                  type="text"
                  name="facebook_pixel_id"
                  placeholder="123456789012345"
                  className="input w-full"
                  value={settings?.facebook_pixel_id ?? ''}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn btn-primary min-w-[140px] flex justify-center items-center gap-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? t('hr.saving') : saved ? t('settings.savedCheck') : t('settings.saveChanges')}
            </button>
          </div>
        </form>

        {/* QR Code Panel */}
        <div className="space-y-4">
          <AccountSecurityCard />
          {settings?.slug && <DangerZoneCard slug={settings.slug} />}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center gap-4 text-center">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <QrCode size={18} className="text-[#ff4757]" /> {t('settings.menuQrCode')}
            </h2>
            {publicMenuUrl ? (
              <>
                <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <QRCodeSVG value={publicMenuUrl} size={160} level="H" />
                </div>
                <p className="text-xs text-gray-500">{t('settings.scanToView')}</p>
                <a
                  href={publicMenuUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink size={14} />
                  {t('settings.openPublicMenu')}
                </a>
                <button
                  onClick={() => window.print()}
                  className="btn btn-secondary border border-gray-200 w-full"
                >
                  {t('settings.printQrCode')}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">{t('settings.noSlugConfigured')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
