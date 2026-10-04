import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Star, ExternalLink, Loader2, CheckCircle2, ChefHat, CalendarCheck, SearchX } from 'lucide-react';
import api from '../api/axios';
import Reveal from '../components/Reveal';

interface RestaurantInfo {
  name: string;
  slug: string;
  description: string;
  avatar: string | null;
  public_url: string;
  contact: {
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  service_rating: { average: number | null; count: number };
}

export default function RestaurantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    type: 'table' as 'table' | 'event',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    party_size: 2,
    event_name: '',
    reserved_at: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    api.get(`/v1/public/${slug}/info`)
      .then((res) => setInfo(res.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/v1/public/${slug}/reservations`, form);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر إرسال طلب الحجز، حاول مجددًا.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-24 flex justify-center">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="container-page py-24 flex flex-col items-center text-center gap-3">
        <div className="icon-badge w-16 h-16 bg-gray-100 text-gray-400">
          <SearchX size={28} />
        </div>
        <p className="text-gray-500 font-medium">لم يتم العثور على هذا المطعم.</p>
      </div>
    );
  }

  return (
    <div className="container-page py-10 grid lg:grid-cols-3 gap-10">
      <Reveal className="lg:col-span-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center text-white overflow-hidden shrink-0 shadow-[var(--shadow-glow)]">
            {info.avatar ? <img src={info.avatar} alt={info.name} className="w-full h-full object-cover" /> : <ChefHat size={28} />}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{info.name}</h1>
            {info.contact && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <MapPin size={14} /> {[info.contact.address, info.contact.city, info.contact.country].filter(Boolean).join('، ')}
              </p>
            )}
          </div>
        </div>

        {info.description && <p className="mt-5 text-gray-600 leading-relaxed">{info.description}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          {info.contact?.phone && (
            <span className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
              <Phone size={14} /> <span dir="ltr">{info.contact.phone}</span>
            </span>
          )}
          {info.service_rating.average && (
            <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
              <Star size={14} fill="currentColor" /> {info.service_rating.average} ({info.service_rating.count} تقييم)
            </span>
          )}
        </div>

        <a
          href={info.public_url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline mt-6"
        >
          عرض القائمة الكاملة <ExternalLink size={16} />
        </a>
      </Reveal>

      <Reveal delay={0.1} className="card p-6 h-fit">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-badge w-9 h-9 bg-red-50 text-[var(--color-primary)]">
            <CalendarCheck size={18} />
          </div>
          <h2 className="font-bold text-gray-900 text-lg">احجز طاولة أو مناسبة</h2>
        </div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex flex-col items-center text-center gap-2 py-6"
            >
              <CheckCircle2 className="text-green-500" size={44} />
              <p className="text-gray-700 font-medium">تم إرسال طلب الحجز بنجاح!</p>
              <p className="text-sm text-gray-500">سيتواصل معك المطعم لتأكيد الحجز.</p>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleSubmit} className="mt-4 space-y-3" exit={{ opacity: 0 }}>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm((p) => ({ ...p, type: 'table' }))}
                  className={`btn ${form.type === 'table' ? 'btn-primary' : 'btn-outline'}`}>طاولة</button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, type: 'event' }))}
                  className={`btn ${form.type === 'event' ? 'btn-primary' : 'btn-outline'}`}>مناسبة</button>
              </div>

              {form.type === 'event' && (
                <input name="event_name" required placeholder="اسم المناسبة" className="input" value={form.event_name} onChange={handleChange} />
              )}

              <input name="customer_name" required placeholder="الاسم الكامل" className="input" value={form.customer_name} onChange={handleChange} />
              <input name="customer_phone" required placeholder="رقم الهاتف" className="input" value={form.customer_phone} onChange={handleChange} />
              <input name="customer_email" type="email" placeholder="البريد الإلكتروني (اختياري)" className="input" value={form.customer_email} onChange={handleChange} />

              <div className="grid grid-cols-2 gap-3">
                <input name="party_size" type="number" min={1} required placeholder="عدد الأشخاص" className="input" value={form.party_size} onChange={handleChange} />
                <input name="reserved_at" type="datetime-local" required className="input" value={form.reserved_at} onChange={handleChange} />
              </div>

              <textarea name="notes" placeholder="ملاحظات (اختياري)" className="input h-20" value={form.notes} onChange={handleChange} />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : 'إرسال طلب الحجز'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </Reveal>
    </div>
  );
}
