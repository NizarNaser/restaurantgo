import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  showValue?: boolean;
  count?: number;
}

/** Read-only by default; pass onChange for an interactive 1–5 star picker. */
export default function StarRating({ value, onChange, size = 16, showValue = false, count }: StarRatingProps) {
  const interactive = Boolean(onChange);
  const rounded = Math.round(value);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const icon = (
            <Star
              size={size}
              className={star <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300'}
            />
          );

          // Purely decorative stars must not be real <button>s — this
          // component often sits inside a clickable card, and a <button>
          // can't legally nest inside another <button>.
          if (!interactive) {
            return <span key={star}>{icon}</span>;
          }

          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              className="cursor-pointer"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              {icon}
            </button>
          );
        })}
      </span>
      {showValue && value > 0 && (
        <span className="text-sm font-medium text-gray-700">{value.toFixed(1)}</span>
      )}
      {typeof count === 'number' && (
        <span className="text-sm text-gray-400">({count})</span>
      )}
    </span>
  );
}
