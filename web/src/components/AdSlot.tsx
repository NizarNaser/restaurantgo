import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const AUTO_ADVANCE_MS = 5000;

interface Ad {
  id: number;
  title: string;
  advertiser_name: string | null;
  image_path: string | null;
  link_url: string | null;
  placement: string;
}

export default function AdSlot({
  placement,
  className = '',
  fallback = null,
  carousel = false,
}: {
  placement: string;
  className?: string;
  fallback?: ReactNode;
  /** Show one ad at a time, auto-rotating with manual prev/next controls, instead of stacking every active ad. */
  carousel?: boolean;
}) {
  const { t } = useTranslation();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/v1/ads', { params: { placement } })
      .then((res) => { if (!cancelled) { setAds(res.data); setIndex(0); } })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => { cancelled = true; };
  }, [placement]);

  useEffect(() => {
    if (!carousel || paused || !ads || ads.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % ads.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [carousel, paused, ads]);

  // Still loading — render nothing rather than flash the fallback then swap it out.
  if (ads === null) return null;

  if (ads.length === 0) return <>{fallback}</>;

  const handleClick = async (ad: Ad) => {
    try {
      await api.post(`/v1/ads/${ad.id}/click`);
    } catch {
      // Non-critical — still navigate even if the click ping fails.
    }
  };

  if (carousel) {
    const ad = ads[index];
    return (
      <div
        className={className}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.a
              key={ad.id}
              href={ad.link_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => handleClick(ad)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-stretch rtl:flex-row-reverse card card-hover overflow-hidden"
            >
              {ad.image_path ? (
                <img src={ad.image_path} alt={ad.title} className="w-24 sm:w-32 h-28 sm:h-36 flex-shrink-0 object-cover" />
              ) : (
                <div className="w-24 sm:w-32 h-28 sm:h-36 flex-shrink-0 bg-gradient-to-br from-red-50 to-orange-50" />
              )}
              <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
                <p className="font-semibold text-gray-900 text-sm line-clamp-2">{ad.title}</p>
                <span className="text-xs text-gray-400">{t('adSlot.sponsored')}{ad.advertiser_name ? ` · ${ad.advertiser_name}` : ''}</span>
              </div>
            </motion.a>
          </AnimatePresence>

          {ads.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setIndex((i) => (i - 1 + ads.length) % ads.length); }}
                aria-label={t('adSlot.previous')}
                className="absolute top-1/2 -translate-y-1/2 start-2 w-8 h-8 rounded-full bg-white/90 shadow-[var(--shadow-soft)] flex items-center justify-center text-gray-600 hover:bg-white hover:text-[var(--color-primary)] transition-colors"
              >
                <ChevronLeft size={16} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setIndex((i) => (i + 1) % ads.length); }}
                aria-label={t('adSlot.next')}
                className="absolute top-1/2 -translate-y-1/2 end-2 w-8 h-8 rounded-full bg-white/90 shadow-[var(--shadow-soft)] flex items-center justify-center text-gray-600 hover:bg-white hover:text-[var(--color-primary)] transition-colors"
              >
                <ChevronRight size={16} className="rtl:rotate-180" />
              </button>
            </>
          )}
        </div>

        {ads.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {ads.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={t('adSlot.goToAd', { number: i + 1 })}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-[var(--color-primary)]' : 'w-2 bg-gray-300'}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {ads.map((ad, i) => (
        <motion.a
          key={ad.id}
          href={ad.link_url ?? '#'}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => handleClick(ad)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          whileHover={{ y: -4 }}
          className="flex items-stretch rtl:flex-row-reverse card card-hover overflow-hidden"
        >
          {ad.image_path ? (
            <img src={ad.image_path} alt={ad.title} className="w-24 sm:w-32 h-28 sm:h-36 flex-shrink-0 object-cover" />
          ) : (
            <div className="w-24 sm:w-32 h-28 sm:h-36 flex-shrink-0 bg-gradient-to-br from-red-50 to-orange-50" />
          )}
          <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
            <p className="font-semibold text-gray-900 text-sm line-clamp-2">{ad.title}</p>
            <span className="text-xs text-gray-400">{t('adSlot.sponsored')}{ad.advertiser_name ? ` · ${ad.advertiser_name}` : ''}</span>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
