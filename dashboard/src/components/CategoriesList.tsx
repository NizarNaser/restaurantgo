import type { CategoryRecord } from '../types/pos';

/**
 * Same category list rendered two ways with plain responsive classes — a
 * vertical rail for the desktop 3-column POS layout, a horizontal scroll
 * strip when there isn't room for a column (tablet/phone) — rather than two
 * components that could drift apart.
 */
export default function CategoriesList({
  categories,
  activeCategoryId,
  onSelect,
  emptyLabel,
}: {
  categories: CategoryRecord[];
  activeCategoryId: number | null;
  onSelect: (id: number) => void;
  emptyLabel: string;
}) {
  if (categories.length === 0) {
    return <p className="px-3 py-4 text-xs text-gray-400">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="hidden lg:block overflow-y-auto h-full">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-gray-100 transition-colors ${
              activeCategoryId === category.id ? 'bg-red-50 text-[#ff4757]' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="lg:hidden flex overflow-x-auto gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategoryId === category.id ? 'bg-[#ff4757] text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </>
  );
}
