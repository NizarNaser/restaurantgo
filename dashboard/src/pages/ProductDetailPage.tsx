import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, User, Plus, Minus, QrCode } from 'lucide-react';
import { useSeoHead } from '../hooks/useSeoHead';
import type { SeoPayload } from '../hooks/useSeoHead';
import ReviewForm from '../components/public/ReviewForm';
import StarRating from '../components/StarRating';
import { useCartStore } from '../store/cartStore';
import { getStoredPublicLocale } from '../lib/publicLocale';
import { usePublicSlug } from '../hooks/usePublicSlug';
import { TAG_META } from '../types/public';
import type { PublicMenuItem } from '../types/public';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

interface ItemReview {
  id: number;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ItemDetail extends PublicMenuItem {
  category_name: string | null;
  reviews: ItemReview[];
}

function money(price: number | string, currency: string) {
  return `${parseFloat(String(price)).toFixed(2)} ${currency}`;
}

export default function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const { slug, buildPath } = usePublicSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initForSlug = useCartStore((s) => s.initForSlug);
  const addItem = useCartStore((s) => s.addItem);
  const qrCodeId = useCartStore((s) => s.qrCodeId);
  const canOrder = qrCodeId != null;
  const [qty, setQty] = useState(1);

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [related, setRelated] = useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seo, setSeo] = useState<SeoPayload | null>(null);

  useSeoHead(seo, null);

  useEffect(() => {
    if (!slug) return;
    const qrParam = searchParams.get('qr');
    initForSlug(slug, qrParam ? Number(qrParam) : null);
  }, [slug, searchParams, initForSlug]);

  const fetchItem = () =>
    axios
      .get(`${PUBLIC_API}/${slug}/menu/items/${itemId}`, { params: { lang: getStoredPublicLocale(slug) ?? undefined } })
      .then((res) => {
        setItem(res.data.data);
        setRelated(res.data.related || []);
        setSeo(res.data.seo);
      })
      .catch((err) => setError(err.response?.data?.message || t('product.itemNotFound')));

  // Navigating to a (possibly different) item always shows the full-page
  // spinner while it loads.
  useEffect(() => {
    setLoading(true);
    fetchItem().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, itemId, i18n.language]);

  // After submitting a review, refresh quietly in the background — swapping
  // the whole page for a spinner here would unmount ReviewForm mid
  // "thanks for your feedback" message.
  const handleReviewSubmitted = () => {
    fetchItem();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('common.notFound')}</h1>
        <p className="text-gray-600">{error}</p>
        <Link to={buildPath('')} className="mt-4 text-red-500 hover:underline">{t('common.backToMenu')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate(buildPath(''))}
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={16} /> {t('common.backToMenu')}
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative aspect-[4/3] md:aspect-auto bg-gray-100">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">{t('common.noImage')}</div>
              )}
              {!item.is_available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold px-3 py-1 rounded-full bg-black/40 border border-white/30">
                    {t('menu.currentlyUnavailable')}
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 flex flex-col">
              {item.category_name && (
                <span className="text-xs font-medium text-[#ff4757] uppercase tracking-wide">{item.category_name}</span>
              )}
              <div className="flex items-start justify-between gap-3 mt-1">
                <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
                {item.weight && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap mt-1">
                    {item.weight}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <span dir="ltr" className="text-2xl font-bold text-gray-900">{money(item.price, item.currency)}</span>
                {item.avg_rating && <StarRating value={item.avg_rating} count={item.reviews_count} showValue />}
              </div>

              {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                      <span>{TAG_META[tag]?.emoji ?? ''}</span>
                      {t(`tags.${tag}`, { defaultValue: tag })}
                    </span>
                  ))}
                </div>
              )}

              {item.description && (
                <p className="text-gray-600 mt-4 leading-relaxed">{item.description}</p>
              )}

              {item.is_available && !canOrder && (
                <div className="mt-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-center gap-2 text-sm">
                  <QrCode size={18} className="shrink-0" />
                  {t('product.scanToOrderItem')}
                </div>
              )}

              {item.is_available && canOrder && (
                <div className="flex items-center gap-3 mt-6">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 text-gray-500 hover:text-gray-800" aria-label={t('common.decreaseQuantity')}>
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-medium">{qty}</span>
                    <button type="button" onClick={() => setQty((q) => q + 1)} className="p-2 text-gray-500 hover:text-gray-800" aria-label={t('common.increaseQuantity')}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addItem({ menu_item_id: item.id, name: item.name, unit_price: parseFloat(String(item.price)), currency: item.currency }, qty);
                      setQty(1);
                    }}
                    className="btn btn-primary flex-1"
                  >
                    {t('menu.addToCart')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {t('product.reviewsTitle')} {item.reviews_count > 0 && <span className="text-gray-400 font-normal">({item.reviews_count})</span>}
            </h2>
            {item.reviews.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('product.noReviewsBeFirst')}</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {item.reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        {review.customer_name}
                      </span>
                      <StarRating value={review.rating} size={13} />
                    </div>
                    {review.comment && <p className="text-sm text-gray-600 mt-1.5">{review.comment}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <ReviewForm
              slug={slug!}
              menuItemId={item.id}
              title={t('product.leaveAReview')}
              onSubmitted={handleReviewSubmitted}
            />
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{t('product.youMightAlsoLike')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(buildPath(`/item/${r.id}`))}
                  className="text-left bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-100">
                    {r.image_url ? (
                      <img src={r.image_card_url || r.image_url} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{t('common.noImage')}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    <p dir="ltr" className="text-sm font-bold text-gray-900 mt-0.5">{money(r.price, r.currency)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
