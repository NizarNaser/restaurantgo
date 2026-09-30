import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Semantic mapping is dir-agnostic: ChevronLeft always means "previous" (it
// points toward the reading-start), ChevronRight always means "next". The
// `rtl:rotate-180` variant flips each icon to point the correct visual way
// once `dir="rtl"` is set on <html>, so no per-locale branching is needed.
export default function Pagination({
  currentPage,
  lastPage,
  onChange,
}: {
  currentPage: number;
  lastPage: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (lastPage <= 1) return null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label={t('pagination.nav')}>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onChange(currentPage - 1)}
        aria-label={t('pagination.previous')}
        className="btn btn-outline !px-3 !py-2"
      >
        <ChevronLeft size={18} className="rtl:rotate-180" />
      </button>

      {getPageList(currentPage, lastPage).map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1.5 text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
              p === currentPage ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        disabled={currentPage === lastPage}
        onClick={() => onChange(currentPage + 1)}
        aria-label={t('pagination.next')}
        className="btn btn-outline !px-3 !py-2"
      >
        <ChevronRight size={18} className="rtl:rotate-180" />
      </button>
    </nav>
  );
}

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
