import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, CheckCircle2, Sparkles, Check, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Reveal from '../components/Reveal';
import { SUPPORTED_LOCALES } from '../i18n';

const RESTAURANT_SITE_URL = import.meta.env.VITE_RESTAURANT_SITE_URL || 'http://localhost:5173';
// Matches the API's APP_BASE_DOMAIN (see SeoService::tenantBaseUrl) — unset
// in local dev, where every tenant is reached via the dashboard's /p/:slug
// fallback instead of a real subdomain.
const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN as string | undefined;

// The tenant dashboard app (separate project) only ships real UI-chrome
// translations for these two locales today — offering the full 12-language
// roster here would promise a dashboard experience that doesn't exist yet.
const DASHBOARD_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية' }, // i18n-check-ignore — a language's own native name, not translatable text
];

interface PlanOption {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_branches: number | null;
  max_menu_items: number | null;
  max_users: number | null;
  has_custom_domain: boolean;
  has_white_label: boolean;
  has_advanced_reports: boolean;
}

type Interval = 'monthly' | 'yearly';

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'plan' | 'details'>('plan');

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [billingInterval, setBillingInterval] = useState<Interval>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [form, setForm] = useState({
    restaurant_name: '',
    subdomain: '',
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [locale, setLocale] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.get('/plans')
      .then((res) => {
        const data: PlanOption[] = res.data?.data || [];
        setPlans(data);
        // Preselect Starter (today's default) so skipping the step still
        // behaves like registration did before plan selection existed.
        const starter = data.find((p) => p.slug === 'starter');
        setSelectedPlanId((starter ?? data[0])?.id ?? null);
      })
      .catch(() => setPlansError(true))
      .finally(() => setPlansLoading(false));
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleSupportedLocale = (code: string) => {
    setSupportedLocales((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supportedLocales.length === 0) {
      setErrors({ supported_locales: [t('register.restaurantLanguages.required')] });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await api.post('/auth/register', {
        ...form,
        locale,
        supported_locales: supportedLocales,
        plan_id: selectedPlanId ?? undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setErrors(err.response?.data?.errors || { general: [err.response?.data?.message || t('register.genericError')] });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const isFree = selectedPlan && selectedPlan.price_monthly === 0 && selectedPlan.price_yearly === 0;
    const publicSiteUrl = BASE_DOMAIN
      ? `https://${form.subdomain}.${BASE_DOMAIN}`
      : `${RESTAURANT_SITE_URL}/p/${form.subdomain}`;
    return (
      <div className="container-page py-24 max-w-md text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        >
          <CheckCircle2 className="text-green-500 mx-auto" size={52} />
        </motion.div>
        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">{t('register.success.title')}</h1>
        <p className="mt-2 text-gray-500">{isFree ? t('register.success.subtitleFree') : t('register.success.subtitle')}</p>
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <p className="text-gray-500">{t('register.success.siteReadyAt')}</p>
          <a href={publicSiteUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--color-primary)] break-all hover:underline">
            {publicSiteUrl}
          </a>
        </div>
        <a href={`${RESTAURANT_SITE_URL}/login`} className="btn btn-primary mt-6">
          {t('register.success.cta')}
        </a>
      </div>
    );
  }

  return (
    <div className="container-page py-16 max-w-md">
      <Reveal className="text-center">
        <span className="section-eyebrow"><Sparkles size={14} /> {t('register.trialBadge')}</span>
        <h1 className="mt-4 text-3xl font-extrabold text-gray-900">{t('register.title')}</h1>
        <p className="mt-2 text-gray-500">{t('register.subtitle')}</p>
      </Reveal>

      {step === 'plan' && (
        <Reveal delay={0.1}>
          <div className="mt-8 card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('register.planStep.title')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('register.planStep.subtitle')}</p>
            </div>

            {plansLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={28} className="animate-spin text-gray-400" />
              </div>
            ) : plansError ? (
              <p className="text-sm text-amber-600">{t('register.planStep.loadError')}</p>
            ) : (
              <>
                <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                  {(['monthly', 'yearly'] as Interval[]).map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBillingInterval(i)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        billingInterval === i ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {i === 'monthly' ? t('register.planStep.monthly') : t('register.planStep.yearly')}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {plans.map((plan) => {
                    const price = billingInterval === 'yearly' ? plan.price_yearly : plan.price_monthly;
                    const isSelected = selectedPlanId === plan.id;

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left rounded-xl border p-4 transition-colors ${
                          isSelected ? 'border-[#ff4757] ring-1 ring-[#ff4757] bg-red-50/30' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{plan.name}</span>
                              {isSelected && (
                                <span className="text-xs font-medium text-[#ff4757] flex items-center gap-1">
                                  <Check size={12} /> {t('register.planStep.selected')}
                                </span>
                              )}
                            </div>
                            {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
                            <ul className="mt-2 space-y-1 text-xs text-gray-500">
                              <li>{plan.max_branches ? t('register.planStep.branchesCount', { count: plan.max_branches }) : t('register.planStep.unlimitedBranches')}</li>
                              <li>{plan.max_menu_items ? t('register.planStep.menuItemsCount', { count: plan.max_menu_items }) : t('register.planStep.unlimitedMenuItems')}</li>
                              {plan.has_custom_domain && <li>{t('register.planStep.customDomain')}</li>}
                              {plan.has_advanced_reports && <li>{t('register.planStep.advancedReports')}</li>}
                              {plan.has_white_label && <li>{t('register.planStep.whiteLabel')}</li>}
                            </ul>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-gray-900">{formatMoney(price, plan.currency)}</div>
                            <div className="text-xs text-gray-400">/ {billingInterval === 'yearly' ? t('register.planStep.year') : t('register.planStep.month')}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setStep('details')}
              disabled={plansLoading}
              className="btn btn-primary w-full"
            >
              {t('register.planStep.continue')}
            </button>
          </div>
        </Reveal>
      )}

      {step === 'details' && (
        <Reveal delay={0.1}>
          <form onSubmit={handleSubmit} className="mt-8 card p-6 space-y-4">
            {selectedPlan && !plansError && (
              <button
                type="button"
                onClick={() => setStep('plan')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 -mt-1 -ml-1"
              >
                <ArrowLeft size={14} />
                {selectedPlan.name} · {t('register.planStep.changePlan')}
              </button>
            )}

            <div>
              <input name="restaurant_name" required placeholder={t('register.fields.restaurantName')} className="input" value={form.restaurant_name} onChange={handleChange} />
              {errors.restaurant_name && <p className="text-xs text-red-500 mt-1">{errors.restaurant_name[0]}</p>}
            </div>
            <div>
              <input name="subdomain" required placeholder={t('register.fields.subdomain')} className="input" value={form.subdomain} onChange={handleChange} />
              {errors.subdomain && <p className="text-xs text-red-500 mt-1">{errors.subdomain[0]}</p>}
            </div>
            <div>
              <input name="name" required placeholder={t('register.fields.ownerName')} className="input" value={form.name} onChange={handleChange} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
            </div>
            <div>
              <input name="email" type="email" required placeholder={t('register.fields.email')} className="input" value={form.email} onChange={handleChange} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email[0]}</p>}
            </div>
            <div>
              <input name="password" type="password" required placeholder={t('register.fields.password')} className="input" value={form.password} onChange={handleChange} />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password[0]}</p>}
            </div>
            <input name="password_confirmation" type="password" required placeholder={t('register.fields.passwordConfirmation')} className="input" value={form.password_confirmation} onChange={handleChange} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('register.dashboardLanguage.label')}</label>
              <select className="input bg-white w-full" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {DASHBOARD_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('register.restaurantLanguages.label')}</label>
              <p className="text-xs text-gray-400 mb-2">{t('register.restaurantLanguages.hint')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUPPORTED_LOCALES.map((l) => (
                  <label key={l.code} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={supportedLocales.includes(l.code)}
                      onChange={() => toggleSupportedLocale(l.code)}
                      className="rounded border-gray-300"
                    />
                    {l.name}
                  </label>
                ))}
              </div>
              {errors.supported_locales && <p className="text-xs text-red-500 mt-1">{errors.supported_locales[0]}</p>}
            </div>

            {errors.general && <p className="text-sm text-red-500">{errors.general[0]}</p>}

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : t('register.submit')}
            </button>
          </form>
        </Reveal>
      )}
    </div>
  );
}
