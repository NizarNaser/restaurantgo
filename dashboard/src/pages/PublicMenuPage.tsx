import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Loader2, Phone, MapPin, Clock, MessageCircle, Star, ChevronRight, ChevronLeft, ShoppingCart, Plus, Minus, QrCode, Newspaper, ChefHat } from 'lucide-react';
import { useSeoHead } from '../hooks/useSeoHead';
import { useAnalytics } from '../hooks/useAnalytics';
import type { SeoPayload } from '../hooks/useSeoHead';
import ReviewForm from '../components/public/ReviewForm';
import InstallAppPrompt from '../components/public/InstallAppPrompt';
import MenuAssistantWidget from '../components/public/MenuAssistantWidget';
import PublicLanguageSwitcher from '../components/public/PublicLanguageSwitcher';
import SocialLinks from '../components/public/SocialLinks';
import QrScannerModal from '../components/QrScannerModal';
import StarRating from '../components/StarRating';
import { useCartStore } from '../store/cartStore';
import { getStoredPublicLocale } from '../lib/publicLocale';
import { usePublicSlug } from '../hooks/usePublicSlug';
import { getPlatformSiteUrl } from '../lib/publicSite';
import { RTL_LOCALES } from '../i18n/index';
import {
  formatWorkingHours, whatsappUrl, TAG_META,
} from '../types/public';
import type { PublicCategory, PublicDepartment, PublicMenuItem, RestaurantInfo } from '../types/public';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;
const ITEMS_PER_PAGE = 14;
// Below this many unique trending items, the marquee's fill-and-loop
// animation would just show the same 1-3 cards sliding by on endless repeat.
const MIN_ITEMS_FOR_MARQUEE = 4;

function money(price: number | string, currency: string) {
  return `${parseFloat(String(price)).toFixed(2)} ${currency}`;
}

// Caps how many page-number buttons render at once (with "…" for the rest)
// so a menu with many pages can't force this row wider than a phone screen —
// unlike web's horizontally-scrolling directory list, this nav sits inside a
// fixed-width content column, so it has to fit, not scroll.
function getPageList(current: number, last: number): (number | '...')[] {
  const delta = 1;
  const list: (number | '...')[] = [];
  for (let i = 1; i <= last; i++) {
    if (i === 1 || i === last || (i >= current - delta && i <= current + delta)) {
      list.push(i);
    } else if (list[list.length - 1] !== '...') {
      list.push('...');
    }
  }
  return list;
}

function ItemCard({ item, onClick, onAdd, canOrder }: { item: PublicMenuItem; onClick: () => void; onAdd: (quantity: number) => void; canOrder: boolean }) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
      <button onClick={onClick} className="text-left flex flex-col flex-1">
        <div className="relative aspect-[4/3] bg-gray-100">
          {item.image_url ? (
            <img src={item.image_card_url || item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">{t('common.noImage')}</div>
          )}
          {!item.is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-sm font-semibold px-3 py-1 rounded-full bg-black/40 border border-white/30">
                {t('menu.currentlyUnavailable')}
              </span>
            </div>
          )}
          {item.weight && (
            <span className="absolute top-2 left-2 bg-white/90 backdrop-blur text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm">
              {item.weight}
            </span>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 leading-snug">{item.name}</h3>
            <span className="font-bold text-gray-900 whitespace-nowrap">{money(item.price, item.currency)}</span>
          </div>
          {item.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
          )}
          <div className="mt-auto pt-3 flex items-center justify-between">
            {item.avg_rating ? (
              <StarRating value={item.avg_rating} size={13} count={item.reviews_count} />
            ) : (
              <span className="text-xs text-gray-400">{t('menu.noReviewsYet')}</span>
            )}
            {item.tags?.length > 0 && (
              <span className="flex gap-1 text-sm">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} title={t(`tags.${tag}`, { defaultValue: tag })}>{TAG_META[tag]?.emoji ?? '•'}</span>
                ))}
              </span>
            )}
          </div>
        </div>
      </button>

      {item.is_available && canOrder && (
        <div className="px-4 pb-4 flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg shrink-0">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-1.5 text-gray-500 hover:text-gray-800" aria-label={t('common.decreaseQuantity')}>
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-medium">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="p-1.5 text-gray-500 hover:text-gray-800" aria-label={t('common.increaseQuantity')}>
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { onAdd(qty); setQty(1); }}
            className="btn btn-primary flex-1 text-sm py-1.5"
          >
            {t('menu.addToCart')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PublicMenuPage() {
  const { t, i18n } = useTranslation();
  const isRtl = RTL_LOCALES.includes(i18n.language);
  const { slug, buildPath } = usePublicSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cartItems = useCartStore((s) => s.items);
  const cartSubtotal = useCartStore((s) => s.subtotal());
  const initForSlug = useCartStore((s) => s.initForSlug);
  const addItem = useCartStore((s) => s.addItem);
  const qrCodeId = useCartStore((s) => s.qrCodeId);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const isDineIn = qrCodeId != null;
  const canOrder = isDineIn || orderType === 'delivery';
  const [showScanner, setShowScanner] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [trending, setTrending] = useState<PublicMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [seo, setSeo] = useState<SeoPayload | null>(null);
  const [jsonLd, setJsonLd] = useState<unknown[] | null>(null);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);

  const updateCategoryScrollState = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) {
      setCanScrollCategoriesLeft(false);
      setCanScrollCategoriesRight(false);
      return;
    }
    // Browsers report scrollLeft for an RTL container as 0 at the right edge
    // going down to -maxScroll at the left edge — the mirror image of LTR's
    // 0-at-left-edge convention — so which physical side still has hidden
    // content flips which comparison applies.
    if (isRtl) {
      setCanScrollCategoriesLeft(el.scrollLeft > 1 - maxScroll);
      setCanScrollCategoriesRight(el.scrollLeft < -1);
    } else {
      setCanScrollCategoriesLeft(el.scrollLeft > 1);
      setCanScrollCategoriesRight(el.scrollLeft < maxScroll - 1);
    }
  }, [isRtl]);

  const scrollCategories = (direction: 'left' | 'right') => {
    categoryScrollRef.current?.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  useEffect(() => {
    updateCategoryScrollState();
    window.addEventListener('resize', updateCategoryScrollState);
    return () => window.removeEventListener('resize', updateCategoryScrollState);
  }, [categories, activeDepartment, updateCategoryScrollState]);

  useSeoHead(seo, jsonLd);
  useAnalytics(info?.analytics);

  // Swap the browser-tab icon to the restaurant's own favicon while this
  // page is open, restoring whatever the platform default was on unmount.
  useEffect(() => {
    if (!info?.favicon) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousHref = link?.href;
    if (link) link.href = info.favicon;
    return () => {
      if (link && previousHref) link.href = previousHref;
    };
  }, [info?.favicon]);

  useEffect(() => {
    const lang = getStoredPublicLocale(slug) ?? undefined;
    const fetchPublicData = async () => {
      try {
        const [infoRes, menuRes] = await Promise.all([
          axios.get(`${PUBLIC_API}/${slug}/info`, { params: { lang } }),
          axios.get(`${PUBLIC_API}/${slug}/menu`, { params: { lang } }),
        ]);

        setInfo(infoRes.data.data);
        setCategories(menuRes.data.data.categories);
        setDepartments(menuRes.data.data.departments || []);
        setItems(menuRes.data.data.items);
        setPage(1);
        setTrending(menuRes.data.data.trending || []);
        setSeo(menuRes.data.seo);
        setJsonLd(menuRes.data.json_ld);
      } catch (err: any) {
        setError(err.response?.data?.message || t('menu.notFoundOrUnavailable'));
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
    // Re-fetch when the customer switches language so menu content
    // (names/descriptions) is re-translated, not just the page chrome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, i18n.language]);

  useEffect(() => {
    if (!slug) return;
    const qrParam = searchParams.get('qr');
    initForSlug(slug, qrParam ? Number(qrParam) : null);
    // Opening the general menu link (no table QR) browses/orders as delivery
    // by default — no interrupting "how would you like to order?" prompt.
    // A customer who scans a specific table's QR still gets dine-in
    // automatically via qrCodeId above, and can still look up a table via
    // the halls page (linked from the dashboard) if they want to.
    if (!qrParam && useCartStore.getState().orderType == null) {
      setOrderType('delivery');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, searchParams, initForSlug]);

  const handleAddToCart = (item: PublicMenuItem, quantity: number) => {
    addItem({ menu_item_id: item.id, name: item.name, unit_price: parseFloat(String(item.price)), currency: item.currency }, quantity);
  };

  // The printed table QR encodes the scan-tracking redirect URL — following
  // it here is what a phone's own camera app would do too, so scan_count
  // still increments and the customer lands back on this page with `?qr=`.
  const handleScan = (text: string) => {
    setShowScanner(false);
    if (/^https?:\/\//i.test(text)) {
      window.location.href = text;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('common.oops')}</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  // A department filter (Kitchen, Bar, ...) is coarser than a category one —
  // picking a category always wins if both happen to be set.
  const filteredItems = activeCategory
    ? items.filter((item) => item.category_id === activeCategory)
    : activeDepartment
      ? items.filter((item) => categories.find((c) => c.id === item.category_id)?.department_id === activeDepartment)
      : items;

  const visibleCategories = activeDepartment
    ? categories.filter((c) => c.department_id === activeDepartment)
    : categories;

  const selectDepartment = (departmentId: number | null) => {
    setActiveDepartment(departmentId);
    setActiveCategory(null);
    setPage(1);
  };

  const selectCategory = (categoryId: number | null) => {
    setActiveCategory(categoryId);
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pagedItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const goToPage = (next: number) => {
    setPage(next);
    document.getElementById('menu-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const workingHours = formatWorkingHours(info.contact?.working_hours ?? null, t);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-16">
      <InstallAppPrompt restaurantName={info.name} />

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#ff4757] to-[#ff6b81] pb-16 sm:pb-20">
        {info.supported_locales?.length > 1 && (
          <div className="relative z-10 flex justify-end px-4 pt-3">
            <PublicLanguageSwitcher slug={slug} languages={info.supported_locales} className="text-white [&_select]:text-white" />
          </div>
        )}
        {info.cover_image && (
          <>
            <img src={info.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}
        <div className="relative max-w-5xl mx-auto px-4 pt-10 sm:pt-14 text-center text-white">
          {info.avatar ? (
            <img src={info.avatar} alt={info.name} className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full object-cover ring-4 ring-white/40 mb-4" />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-3xl mb-4 ring-4 ring-white/30">
              {info.name.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl sm:text-4xl font-bold">{info.name}</h1>
          {info.description && (
            <p className="text-white/90 text-sm sm:text-base mt-2 max-w-xl mx-auto">{info.description}</p>
          )}
          {info.service_rating.count > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-sm">
              <Star size={14} className="fill-amber-300 text-amber-300" />
              <span className="font-semibold">{info.service_rating.average?.toFixed(1)}</span>
              <span className="text-white/80">{t('menu.serviceRating')} · {info.service_rating.count} {t('menu.reviews')}</span>
            </div>
          )}

          {(departments.length > 0 || info.blog_url) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => selectDepartment(activeDepartment === dept.id ? null : dept.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur transition-colors ${
                    activeDepartment === dept.id ? 'bg-white text-[#ff4757]' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
              {info.blog_url && (
                <Link
                  to={buildPath('/blog')}
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/15 text-white backdrop-blur hover:bg-white/25 transition-colors inline-flex items-center gap-1.5"
                >
                  <Newspaper size={14} />
                  {t('menu.readOurBlog')}
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Category nav — overlaps hero, sticky on scroll */}
      <div className="sticky top-0 z-20 -mt-8 sm:-mt-10">
        <div className="max-w-5xl mx-auto px-4 relative">
          <div
            ref={categoryScrollRef}
            onScroll={updateCategoryScrollState}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 px-3 py-3 overflow-x-auto hide-scrollbar flex gap-2 whitespace-nowrap"
          >
            <button
              onClick={() => selectCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${
                activeCategory === null ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('menu.allItems')}
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 ${
                  activeCategory === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {canScrollCategoriesLeft && (
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              aria-label={t('menu.scrollCategoriesLeft')}
              className="absolute top-1/2 -translate-y-1/2 -left-2 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {canScrollCategoriesRight && (
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              aria-label={t('menu.scrollCategoriesRight')}
              className="absolute top-1/2 -translate-y-1/2 -right-2 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Dine-in only — the owner's service charge rate never applies to
          delivery/online orders, so this notice only shows to a customer
          who scanned a table's QR code. */}
      {isDineIn && info.service_charge_message && (
        <div className="max-w-5xl mx-auto px-4">
          <p className="mt-4 pt-4 border-t border-gray-100 border-s-2 border-s-[#ff4757] ps-3 text-sm text-gray-500">
            {info.service_charge_message}
          </p>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-10">
        {!canOrder && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex flex-wrap items-center gap-3 text-sm">
            <QrCode size={20} className="shrink-0" />
            <span className="flex-1">
              {t('menu.scanToOrderBanner')}
            </span>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="btn btn-primary text-xs px-3 py-1.5 shrink-0"
            >
              {t('menu.scanWithCamera')}
            </button>
          </div>
        )}

        {/* Trending */}
        {trending.length > 0 && !activeCategory && !activeDepartment && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              🔥 {t('menu.trendingNow')}
            </h2>
            {trending.length < MIN_ITEMS_FOR_MARQUEE ? (
              // Too few unique items to loop — repeating them enough to fill
              // the marquee track would just show the same 1-3 cards sliding
              // by on endless repeat, which reads as broken, not trending.
              // A plain static row is honest about having little to show.
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                {trending.map((item) => (
                  <div key={item.id} dir={isRtl ? 'rtl' : 'ltr'} className="w-56 shrink-0">
                    <ItemCard
                      item={item}
                      onClick={() => navigate(buildPath(`/item/${item.id}`))}
                      onAdd={(quantity) => handleAddToCart(item, quantity)}
                      canOrder={canOrder}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* dir="ltr" here too, not just on the track below: this box's
                 overflow:hidden clips relative to its OWN direction — in rtl
                 it anchors its (wider) child to the right and clips overflow
                 on the left instead of the right, which shifts which slice of
                 the track is actually visible and breaks the transform math
                 below. Pinning both to ltr keeps the visible window anchored
                 the same way regardless of language. */
              <div dir="ltr" className="overflow-hidden -mx-4 px-4 sm:mx-0 sm:px-0">
                {/* The track is two identical halves back-to-back, animated by
                    exactly one half's width so the loop is seamless (see
                    .marquee-track) — but with few trending items, one
                    natural-width half can be narrower than the viewport,
                    which breaks that assumption and shows as a visible jump.
                    Padding each half out to a minimum of ~16 item-slots (by
                    repeating the list) guarantees it's always wide enough,
                    comfortably past any realistic viewport width.
                    Spacing is a fixed margin per item rather than a flex gap
                    so a half's rendered width is an exact multiple of one
                    item's slot width — a shared gap would leave the halves
                    half-a-gap short of the true repeat point and jump too. */}
                {(() => {
                  const half = Array.from(
                    { length: Math.max(1, Math.ceil(16 / trending.length)) },
                    () => trending,
                  ).flat();
                  return (
                    // Forced dir="ltr" here: this is a flex row, and flex's
                    // main axis follows the container's OWN direction — left
                    // unset, the page's dir="rtl" in Arabic would reverse the
                    // physical item order and throw off the 50%-width seam
                    // math above. Only the animation (marquee-rtl class) should
                    // change with language, not the underlying layout, so it's
                    // pinned to ltr here; each card still gets its own dir
                    // below so Arabic names/descriptions still read correctly.
                    <div dir="ltr" className={`flex w-max pb-2 marquee-track ${isRtl ? 'marquee-rtl' : ''}`}>
                      {[...half, ...half].map((item, i) => (
                        <div key={`${item.id}-${i}`} dir={isRtl ? 'rtl' : 'ltr'} className="w-56 mr-4 shrink-0">
                          <ItemCard
                            item={item}
                            onClick={() => navigate(buildPath(`/item/${item.id}`))}
                            onAdd={(quantity) => handleAddToCart(item, quantity)}
                            canOrder={canOrder}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        )}

        {/* Menu grid */}
        <section id="menu-grid" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {activeCategory
              ? categories.find((c) => c.id === activeCategory)?.name
              : activeDepartment
                ? departments.find((d) => d.id === activeDepartment)?.name
                : t('menu.fullMenu')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pagedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => navigate(buildPath(`/item/${item.id}`))}
                onAdd={(quantity) => handleAddToCart(item, quantity)}
                canOrder={canOrder}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                {t('menu.noItemsInCategory')}
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <>
              {/* Compact "page X of Y" pager below `sm` — even the ellipsis-
                  windowed numbered row below can run to 9 buttons (prev,
                  first, …, 3 around current, …, last, next), which no longer
                  fits a narrow phone's width. Two arrows and a page count
                  can't overflow at any screen size or page count. */}
              <nav
                className="flex sm:hidden items-center justify-center gap-4 mt-8"
                aria-label={t('menu.paginationNav')}
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label={t('menu.previousPage')}
                  className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-gray-600">
                  {t('menu.pageOfPages', { current: page, total: pageCount })}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === pageCount}
                  aria-label={t('menu.nextPage')}
                  className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>

              <nav
                className="hidden sm:flex items-center justify-center gap-2 mt-8"
                aria-label={t('menu.paginationNav')}
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label={t('menu.previousPage')}
                  className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft size={16} />
                </button>
                {getPageList(page, pageCount).map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-1 text-gray-400 select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      aria-current={p === page ? 'page' : undefined}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                        p === page ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === pageCount}
                  aria-label={t('menu.nextPage')}
                  className="p-2 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </>
          )}
        </section>

        {/* Contact & service rating */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('menu.visitOrContact')}</h2>
            <div className="space-y-3 text-sm">
              {info.contact?.address && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin size={18} className="text-[#ff4757] shrink-0 mt-0.5" />
                  <span>
                    {[info.contact.address, info.contact.city, info.contact.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {info.contact?.phone && (
                <div className="flex items-start gap-3 text-gray-600">
                  <Phone size={18} className="text-[#ff4757] shrink-0 mt-0.5" />
                  <span>{info.contact.phone}</span>
                </div>
              )}
              {workingHours.length > 0 && (
                <div className="flex items-start gap-3 text-gray-600">
                  <Clock size={18} className="text-[#ff4757] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {workingHours.map((h) => (
                      <div key={h.day} className="flex gap-2">
                        <span className="w-20 shrink-0">{h.day}</span>
                        <span>{h.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!info.contact && (
                <p className="text-gray-400">{t('menu.contactUnavailable')}</p>
              )}
            </div>

            {info.contact?.maps_embed_url && (
              <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
                <iframe
                  src={info.contact.maps_embed_url}
                  width="100%"
                  height="200"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={t('menu.visitOrContact')}
                />
              </div>
            )}

            {info.contact?.phone && (
              <div className="flex flex-wrap gap-2 mt-5">
                <a
                  href={`tel:${info.contact.phone}`}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  <Phone size={15} /> {t('common.call')}
                </a>
                <a
                  href={whatsappUrl(info.contact.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline flex items-center gap-2 text-sm"
                >
                  <MessageCircle size={15} /> {t('common.whatsapp')}
                </a>
              </div>
            )}

            {info.blog_url && (
              <a
                href={info.blog_url}
                className="mt-5 flex items-center justify-between text-sm font-medium text-gray-700 hover:text-[#ff4757] border-t border-gray-100 pt-4"
              >
                {t('menu.readOurBlog')}
                <ChevronRight size={16} />
              </a>
            )}

            <SocialLinks social={info.social} className="mt-5 pt-4 border-t border-gray-100" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <ReviewForm slug={slug!} title={t('review.rateOurService')} />
          </div>
        </section>
      </main>

      <footer className="mt-10 py-6 text-center text-xs text-gray-400 border-t border-gray-100">
        <p>{t('menu.copyright', { year: new Date().getFullYear(), name: info.name })}</p>
        <a
          href={getPlatformSiteUrl()}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {t('menu.poweredBy')}
          <span className="inline-flex items-center gap-1 font-semibold text-gray-500">
            <span className="bg-[#ff4757] text-white rounded-md p-0.5"><ChefHat size={11} /></span>
            RestaurantGo
          </span>
        </a>
      </footer>

      {cartItems.length > 0 && (
        <button
          onClick={() => navigate(buildPath('/cart'))}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-80 btn btn-primary shadow-lg flex items-center justify-between gap-3 z-30"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={18} />
            {t('menu.itemsInCart', { count: cartItems.reduce((sum, i) => sum + i.quantity, 0) })}
          </span>
          <span>{money(cartSubtotal, cartItems[0]?.currency ?? 'USD')}</span>
        </button>
      )}

      {showScanner && (
        <QrScannerModal
          title={t('menu.scanTableQrTitle')}
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {slug && <MenuAssistantWidget slug={slug} />}
    </div>
  );
}
