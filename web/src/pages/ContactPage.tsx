import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Reveal from '../components/Reveal';

// TODO: استبدل هذه القيم بروابط/رقم التواصل الفعلية الخاصة بالمطعم/المنصة.
const SOCIAL_LINKS = [
  { key: 'whatsapp', href: 'https://wa.me/966500000000', icon: WhatsAppIcon, color: '#25D366' },
  { key: 'facebook', href: 'https://facebook.com/restaurantgo', icon: FacebookIcon, color: '#1877F2' },
  { key: 'instagram', href: 'https://instagram.com/restaurantgo', icon: InstagramIcon, color: '#E4405F' },
  { key: 'telegram', href: 'https://t.me/restaurantgo', icon: TelegramIcon, color: '#26A5E4' },
];

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.42 5.82c0 4.54-3.7 8.23-8.25 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24m-4.53 4.7c-.16 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.13.17 1.73 2.76 4.28 3.76 2.12.83 2.55.67 3.01.62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.15-1.19-.06-.1-.23-.17-.48-.29-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.64.81-.79.98-.15.17-.29.19-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.42h-.32z" />
    </svg>
  );
}

function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.87.24-1.46 1.5-1.46h1.6V4.35C15.8 4.24 14.86 4.15 13.77 4.15c-2.28 0-3.84 1.39-3.84 3.95v2.4H7.4v3h2.53V21z" />
    </svg>
  );
}

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.05 3.87 2.98 10.86c-1.23.49-1.22 1.17-.22 1.48l4.63 1.45 1.79 5.44c.22.6.37.84.75.84.3 0 .43-.14.6-.3l2.72-2.62 4.7 3.47c.87.48 1.49.23 1.71-.8l3.1-14.55c.32-1.32-.5-1.9-1.71-1.4zM8.85 14.4l-1.2-3.9 9.44-6.05c.44-.27.84-.12.51.18l-8.75 9.77z" />
    </svg>
  );
}

export default function ContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/v1/contact', form);
      setSubmitted(true);
    } catch {
      setError(t('contact.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-16 max-w-xl">
      <Reveal className="text-center">
        <motion.div
          initial={{ scale: 0.7, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="icon-badge w-14 h-14 bg-red-50 text-[var(--color-primary)] mx-auto mb-4"
        >
          <Mail size={26} />
        </motion.div>
        <h1 className="text-3xl font-extrabold text-gray-900">{t('nav.contact')}</h1>
        <p className="mt-2 text-gray-500">{t('contact.subtitle')}</p>

        <div className="mt-6 flex justify-center gap-3">
          {SOCIAL_LINKS.map(({ key, href, icon: Icon, color }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(`contact.social.${key}`)}
              title={t(`contact.social.${key}`)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              <Icon />
            </a>
          ))}
        </div>
      </Reveal>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 card p-8 flex flex-col items-center text-center gap-2"
          >
            <CheckCircle2 className="text-green-500" size={40} />
            <p className="text-gray-700 font-medium">{t('contact.success')}</p>
          </motion.div>
        ) : (
          <Reveal delay={0.1}>
            <form onSubmit={handleSubmit} className="mt-8 card p-6 space-y-4">
              <input name="name" required placeholder={t('contact.form.name')} className="input" value={form.name} onChange={handleChange} />
              <input name="email" type="email" required placeholder={t('contact.form.email')} className="input" value={form.email} onChange={handleChange} />
              <input name="subject" placeholder={t('contact.form.subject')} className="input" value={form.subject} onChange={handleChange} />
              <textarea name="message" required placeholder={t('contact.form.message')} className="input h-32" value={form.message} onChange={handleChange} />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : t('contact.form.submit')}
              </button>
            </form>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}
