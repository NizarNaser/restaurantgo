import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Loader2, Send } from 'lucide-react';
import StarRating from '../StarRating';

interface ReviewFormProps {
  slug: string;
  menuItemId?: number;
  title?: string;
  onSubmitted?: () => void;
}

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

/** Submits a product review (menuItemId set) or an overall service review (omitted). */
export default function ReviewForm({ slug, menuItemId, title, onSubmitted }: ReviewFormProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('product.leaveAReview');
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || rating === 0) return;

    setSubmitting(true);
    setResult('idle');
    try {
      await axios.post(`${PUBLIC_API}/${slug}/reviews`, {
        menu_item_id: menuItemId,
        customer_name: name.trim(),
        rating,
        comment: comment.trim() || undefined,
      });
      setResult('success');
      setName('');
      setRating(0);
      setComment('');
      onSubmitted?.();
    } catch (err: any) {
      setResult('error');
      setErrorMessage(err?.response?.data?.message || t('review.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (result === 'success') {
    return (
      <div className="rounded-xl bg-green-50 border border-green-100 p-5 text-center">
        <p className="text-green-700 font-medium">{t('review.thanks')}</p>
        <button
          onClick={() => setResult('idle')}
          className="text-sm text-green-600 hover:underline mt-1"
        >
          {t('review.leaveAnother')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-semibold text-gray-900">{resolvedTitle}</h3>

      <div className="flex items-center gap-2">
        <StarRating value={rating} onChange={setRating} size={24} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('review.namePlaceholder')}
          required
          className="input"
        />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('review.commentPlaceholder')}
        rows={3}
        className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm placeholder:text-[var(--color-text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />

      {result === 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={submitting || rating === 0 || !name.trim()}
        className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {t('review.submit')}
      </button>
    </form>
  );
}
