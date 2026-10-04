import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share, X } from 'lucide-react';
import { usePublicSlug } from '../../hooks/usePublicSlug';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * A slim top banner offering to install this restaurant's page as an app:
 * the real Android/Chrome install prompt when the browser fires
 * `beforeinstallprompt`, or manual "Add to Home Screen" instructions on iOS
 * Safari, which never fires that event. Dismissed per-restaurant (keyed by
 * slug) so it doesn't nag on every visit, and skipped entirely once the
 * page is already running as an installed app.
 */
export default function InstallAppPrompt({ restaurantName }: { restaurantName: string }) {
  const { t } = useTranslation();
  const { slug } = usePublicSlug();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [variant, setVariant] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    if (!slug || isStandalone()) return;
    if (localStorage.getItem(`rgo_install_dismissed_${slug}`)) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVariant('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari never fires beforeinstallprompt — show manual instructions
    // instead, after a short delay so it doesn't compete with first paint.
    const iosTimer = isIos() ? window.setTimeout(() => setVariant('ios'), 2500) : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [slug]);

  const dismiss = () => {
    setVariant(null);
    if (slug) localStorage.setItem(`rgo_install_dismissed_${slug}`, '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (!variant) return null;

  return (
    <div className="sticky top-0 z-40 bg-gray-900 text-white px-4 py-2.5 flex items-center gap-3 text-sm">
      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
        {variant === 'ios' ? <Share size={15} /> : <Download size={15} />}
      </div>
      <p className="flex-1 min-w-0">
        <span className="font-semibold">{t('pwa.installTitle', { name: restaurantName })}</span>{' '}
        <span className="text-white/80">
          {variant === 'ios' ? t('pwa.iosInstructions') : t('pwa.installBody')}
        </span>
      </p>
      {variant === 'android' && (
        <button type="button" onClick={install} className="shrink-0 bg-white text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full">
          {t('pwa.installButton')}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={t('pwa.dismiss')} className="shrink-0 text-white/70 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
}
