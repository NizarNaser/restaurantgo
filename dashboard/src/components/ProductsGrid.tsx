import { Plus, Search } from 'lucide-react';
import type { MenuItemOption } from '../types/pos';

export default function ProductsGrid({
  title,
  items,
  search,
  onSearchChange,
  searchPlaceholder,
  onAdd,
  emptyLabel,
}: {
  title: string;
  items: MenuItemOption[];
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onAdd: (item: MenuItemOption) => void;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-gray-100 shrink-0 space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input w-full pl-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="px-1 py-3 text-sm text-gray-400">{emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAdd(item)}
                className="flex flex-col items-start text-left border border-gray-200 rounded-lg overflow-hidden hover:border-[#ff4757] hover:shadow-sm transition-all"
              >
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                  {item.image_thumb_url ? (
                    <img src={item.image_thumb_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Plus size={20} className="text-gray-300" />
                  )}
                </div>
                <div className="p-2 w-full">
                  <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                  {item.weight && <p className="text-[10px] text-gray-400">{item.weight}</p>}
                  <p className="text-xs text-[#ff4757] font-semibold mt-0.5">{parseFloat(String(item.price)).toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
