import { useEffect, useState } from 'react';
import {
  CreditCard, Check, Loader2, ExternalLink, Tag, AlertTriangle, Clock, Truck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

interface ConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  paypal: {
    connected: boolean;
    payments_receivable: boolean;
    email_confirmed: boolean;
  };
}

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
  has_api_access: boolean;
  has_qr_ordering: boolean;
  available_for_online_purchase: { monthly: boolean; yearly: boolean };
}

interface SubscriptionInfo {
  plan: PlanOption;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'none';
  on_trial: boolean;
  trial_ends_at: string | null;
  billing_interval: 'monthly' | 'yearly' | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

type Interval = 'monthly' | 'yearly';

const STATUS_LABEL_KEYS: Record<SubscriptionInfo['status'], string> = {
  active: 'billing.status.active',
  trialing: 'billing.status.trialing',
  past_due: 'billing.status.pastDue',
  canceled: 'billing.status.canceled',
  paused: 'billing.status.paused',
  none: 'billing.status.none',
};

const STATUS_STYLES: Record<SubscriptionInfo['status'], string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-600',
  paused: 'bg-amber-100 text-amber-700',
  none: 'bg-gray-100 text-gray-600',
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BillingPage() {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<Interval>('monthly');
  const [redirecting, setRedirecting] = useState<number | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState<
    { status: 'idle' } | { status: 'checking' } | { status: 'valid'; type: string; value: number; currency: string | null } | { status: 'invalid'; message: string }
  >({ status: 'idle' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const merchantIdInPayPal = params.get('merchantIdInPayPal');

    if (params.get('checkout') === 'success') {
      setNotice({ type: 'success', message: t('billing.paymentReceived') });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancelled') {
      setNotice({ type: 'error', message: t('billing.checkoutCancelled') });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('connect') === 'success') {
      setNotice({ type: 'success', message: t('billing.stripeConnected') });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('connect') === 'refresh') {
      setNotice({ type: 'error', message: t('billing.onboardingExpiredStripe') });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('paypal') === 'success' && merchantIdInPayPal) {
      window.history.replaceState({}, '', window.location.pathname);
      api.post('/connect/paypal/sync', { merchant_id: merchantIdInPayPal })
        .then(() => setNotice({ type: 'success', message: t('billing.paypalConnected') }))
        .catch((error: any) => setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.paypalConfirmFailed') }))
        .finally(() => fetchAll());
      return;
    } else if (params.get('paypal') === 'refresh') {
      setNotice({ type: 'error', message: t('billing.onboardingExpiredPaypal') });
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, connectRes] = await Promise.all([
        api.get('/subscription'),
        api.get('/plans'),
        api.get<ConnectStatus>('/connect/status'),
      ]);
      setSubscription(subRes.data);
      setPlans(plansRes.data.data || []);
      setConnectStatus(connectRes.data);
      if (subRes.data.billing_interval) setBillingInterval(subRes.data.billing_interval);
    } catch (error) {
      console.error('Failed to load billing info', error);
    } finally {
      setLoading(false);
    }
  };

  const startConnectOnboarding = async () => {
    setConnectLoading(true);
    try {
      const res = await api.post('/connect/onboard', {
        return_url: `${window.location.origin}/billing?connect=success`,
        refresh_url: `${window.location.origin}/billing?connect=refresh`,
      });
      window.location.href = res.data.url;
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.stripeOnboardFailed') });
      setConnectLoading(false);
    }
  };

  const startPaypalOnboarding = async () => {
    setPaypalLoading(true);
    try {
      const res = await api.post('/connect/paypal/onboard', {
        return_url: `${window.location.origin}/billing?paypal=success`,
      });
      window.location.href = res.data.url;
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.paypalOnboardFailed') });
      setPaypalLoading(false);
    }
  };

  const checkCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponState({ status: 'idle' });
      return;
    }
    setCouponState({ status: 'checking' });
    try {
      const res = await api.post('/coupons/validate', { code: couponCode.trim() });
      setCouponState({ status: 'valid', type: res.data.type, value: res.data.value, currency: res.data.currency });
    } catch (error: any) {
      setCouponState({ status: 'invalid', message: error?.response?.data?.message || t('billing.invalidCoupon') });
    }
  };

  const startCheckout = async (plan: PlanOption) => {
    setRedirecting(plan.id);
    try {
      const res = await api.post('/subscription/checkout', {
        plan_id: plan.id,
        billing_interval: billingInterval,
        coupon_code: couponState.status === 'valid' ? couponCode.trim() : undefined,
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/billing?checkout=cancelled`,
      });
      window.location.href = res.data.checkout_url;
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.checkoutStartFailed') });
      setRedirecting(null);
    }
  };

  // A $0 plan has nothing to bill, so it skips Stripe checkout entirely and
  // switches immediately — the plan-picker button below routes here instead
  // of startCheckout() whenever the plan's price is zero either interval.
  const switchToFree = async (plan: PlanOption) => {
    setRedirecting(plan.id);
    try {
      await api.post('/subscription/switch-to-free', { plan_id: plan.id });
      setNotice({ type: 'success', message: t('billing.switchedToFree', { plan: plan.name }) });
      fetchAll();
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.checkoutStartFailed') });
    } finally {
      setRedirecting(null);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post('/subscription/portal', {
        return_url: `${window.location.origin}/billing`,
      });
      window.location.href = res.data.url;
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.portalOpenFailed') });
      setPortalLoading(false);
    }
  };

  const confirmCancel = async (atPeriodEnd: boolean) => {
    setCancelLoading(true);
    try {
      const res = await api.post('/subscription/cancel', { at_period_end: atPeriodEnd });
      setNotice({ type: 'success', message: res.data.message });
      setCancelModalOpen(false);
      fetchAll();
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.cancelFailed') });
    } finally {
      setCancelLoading(false);
    }
  };

  const resumeSubscription = async () => {
    setResumeLoading(true);
    try {
      const res = await api.post('/subscription/resume');
      setNotice({ type: 'success', message: res.data.message });
      fetchAll();
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.response?.data?.message || t('billing.resumeFailed') });
    } finally {
      setResumeLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('billing.title')}</h1>
        <p className="text-gray-500 mt-1">{t('billing.subtitle')}</p>
      </div>

      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            notice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* Current plan */}
      {subscription && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.planSuffix', { plan: subscription.plan?.name })}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[subscription.status]}`}>
                  {t(STATUS_LABEL_KEYS[subscription.status])}
                </span>
              </div>

              {subscription.on_trial && subscription.trial_ends_at && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <Clock size={14} />
                  {t('billing.trialEnds', { date: formatDate(subscription.trial_ends_at) })}
                </p>
              )}

              {subscription.current_period_end && (
                <p className="text-sm text-gray-500 mt-1">
                  {subscription.cancel_at_period_end ? t('billing.accessEndsOn', { date: formatDate(subscription.current_period_end) }) : t('billing.renewsOn', { date: formatDate(subscription.current_period_end) })}
                </p>
              )}

              {subscription.status === 'past_due' && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  {t('billing.paymentFailedWarning')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="btn btn-outline flex items-center gap-2"
              >
                {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {t('billing.managePaymentInvoices')}
              </button>

              {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="btn btn-outline text-red-600 hover:bg-red-50"
                >
                  {t('menu.cancel')}
                </button>
              )}

              {subscription.cancel_at_period_end && (
                <button
                  onClick={resumeSubscription}
                  disabled={resumeLoading}
                  className="btn btn-outline flex items-center gap-2"
                >
                  {resumeLoading && <Loader2 size={16} className="animate-spin" />}
                  {t('billing.resumeSubscription')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery & takeout payments (Stripe Connect) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Truck size={18} className="text-[#ff4757]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{t('billing.deliveryTakeoutPayments')}</h3>
              <p className="text-sm text-gray-500 mt-0.5 max-w-md">
                {t('billing.stripeConnectDesc')}
              </p>
            </div>
          </div>

          {connectStatus?.charges_enabled ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1 shrink-0">
              <Check size={14} /> {t('billing.connected')}
            </span>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              {connectStatus?.connected && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {t('billing.verificationPending')}
                </span>
              )}
              <button
                onClick={startConnectOnboarding}
                disabled={connectLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {connectLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                {connectStatus?.connected ? t('billing.finishSetup') : t('billing.connectWithStripe')}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Truck size={18} className="text-[#ff4757]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">PayPal</h3>
              <p className="text-sm text-gray-500 mt-0.5 max-w-md">
                {t('billing.paypalConnectDesc')}
              </p>
            </div>
          </div>

          {connectStatus?.paypal.payments_receivable ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1 shrink-0">
              <Check size={14} /> {t('billing.connected')}
            </span>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              {connectStatus?.paypal.connected && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {t('billing.verificationPending')}
                </span>
              )}
              <button
                onClick={startPaypalOnboarding}
                disabled={paypalLoading}
                className="btn btn-primary flex items-center gap-2"
              >
                {paypalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                {connectStatus?.paypal.connected ? t('billing.finishSetup') : t('billing.connectWithPaypal')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Coupon */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <Tag size={16} className="text-[#ff4757]" />
          {t('billing.haveCouponCode')}
        </h3>
        <div className="flex gap-2 max-w-sm">
          <input
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setCouponState({ status: 'idle' });
            }}
            placeholder={t('billing.couponPlaceholder')}
            className="input flex-1"
          />
          <button
            onClick={checkCoupon}
            disabled={couponState.status === 'checking'}
            className="btn btn-outline"
          >
            {couponState.status === 'checking' ? <Loader2 size={16} className="animate-spin" /> : t('billing.apply')}
          </button>
        </div>
        {couponState.status === 'valid' && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            <Check size={14} />
            {couponState.type === 'percent'
              ? t('billing.couponOffPercent', { value: couponState.value })
              : t('billing.couponOffAmount', { value: couponState.value, currency: couponState.currency ?? '' })}
          </p>
        )}
        {couponState.status === 'invalid' && (
          <p className="text-sm text-red-600 mt-2">{couponState.message}</p>
        )}
      </div>

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('billing.plans')}</h3>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            {(['monthly', 'yearly'] as Interval[]).map((i) => (
              <button
                key={i}
                onClick={() => setBillingInterval(i)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  billingInterval === i ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {i === 'monthly' ? t('billing.monthly') : t('billing.yearly')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan?.id === plan.id && subscription.status !== 'none';
            const price = billingInterval === 'yearly' ? plan.price_yearly : plan.price_monthly;
            const purchasable = plan.available_for_online_purchase[billingInterval];
            // A $0 plan never has a Stripe price attached (nothing to charge),
            // so it would otherwise fall through to purchasable=false and show
            // "Contact sales" — it gets its own always-available switch instead.
            const isFree = plan.price_monthly === 0 && plan.price_yearly === 0;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 flex flex-col ${
                  isCurrent ? 'border-[#ff4757] ring-1 ring-[#ff4757]' : 'border-gray-200'
                } bg-white shadow-sm`}
              >
                <h4 className="text-base font-semibold text-gray-900">{plan.name}</h4>
                {plan.description && <p className="text-sm text-gray-500 mt-1">{plan.description}</p>}

                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{formatMoney(price, plan.currency)}</span>
                  <span className="text-gray-400 text-sm"> / {billingInterval === 'yearly' ? t('billing.year') : t('billing.month')}</span>
                </div>

                <ul className="mt-4 space-y-2 text-sm text-gray-600 flex-1">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {plan.max_branches ? t('billing.branchesCount', { count: plan.max_branches }) : t('billing.unlimitedBranches')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {plan.max_menu_items ? t('billing.menuItemsCount', { count: plan.max_menu_items }) : t('billing.unlimitedMenuItems')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {plan.max_users ? t('billing.teamMembersCount', { count: plan.max_users }) : t('billing.unlimitedTeamMembers')}
                  </li>
                  {plan.has_custom_domain && (
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      {t('billing.customDomain')}
                    </li>
                  )}
                  {plan.has_advanced_reports && (
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      {t('billing.advancedReports')}
                    </li>
                  )}
                  {plan.has_white_label && (
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-green-500" />
                      {t('billing.whiteLabel')}
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => (isFree ? switchToFree(plan) : startCheckout(plan))}
                  disabled={isCurrent || (!purchasable && !isFree) || redirecting === plan.id}
                  className={`mt-6 btn w-full flex items-center justify-center gap-2 ${
                    isCurrent ? 'btn-outline cursor-default' : 'btn-primary'
                  }`}
                  title={!purchasable && !isFree ? t('billing.contactUsToSetup') : undefined}
                >
                  {redirecting === plan.id && <Loader2 size={16} className="animate-spin" />}
                  {isCurrent ? t('billing.currentPlan') : isFree ? t('billing.switchToFreeCta') : purchasable ? t('billing.choosePlan') : t('billing.contactSales')}
                  {!isCurrent && purchasable && !isFree && <ExternalLink size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title={t('billing.cancelSubscription')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('billing.cancelExplain')}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => confirmCancel(true)}
              disabled={cancelLoading}
              className="btn btn-outline justify-center"
            >
              {t('billing.cancelAtPeriodEnd')}
            </button>
            <button
              onClick={() => confirmCancel(false)}
              disabled={cancelLoading}
              className="btn justify-center text-red-600 border border-red-200 hover:bg-red-50"
            >
              {t('billing.cancelImmediately')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
