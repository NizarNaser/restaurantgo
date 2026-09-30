import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface RecipeComponentOption {
  id: number;
  name: string;
  unit: 'gram' | 'piece';
}

export interface RecipeLineDraft {
  componentable_type: 'ingredient' | 'semi_finished_good';
  componentable_id: number | '';
  gross_quantity: string;
  net_quantity: string;
}

export const EMPTY_RECIPE_LINE: RecipeLineDraft = {
  componentable_type: 'ingredient',
  componentable_id: '',
  gross_quantity: '',
  net_quantity: '',
};

/**
 * Shared recipe/BOM line editor — used both for a menu item's recipe card and
 * for a semi-finished good's own production recipe. Gross quantity (بروتو) is
 * what actually gets deducted from stock; net quantity (نيتو) is informational
 * yield only.
 */
export default function RecipeEditor({
  lines, onChange, ingredients, semiFinishedGoods, excludeSemiFinishedGoodId,
}: {
  lines: RecipeLineDraft[];
  onChange: (lines: RecipeLineDraft[]) => void;
  ingredients: RecipeComponentOption[];
  semiFinishedGoods: RecipeComponentOption[];
  /** Prevents a semi-finished good from using itself as a component of its own recipe. */
  excludeSemiFinishedGoodId?: number;
}) {
  const { t } = useTranslation();
  const availableGoods = semiFinishedGoods.filter((g) => g.id !== excludeSemiFinishedGoodId);

  const optionsFor = (type: RecipeLineDraft['componentable_type']) =>
    type === 'ingredient' ? ingredients : availableGoods;

  const unitFor = (line: RecipeLineDraft): string =>
    optionsFor(line.componentable_type).find((o) => o.id === line.componentable_id)?.unit ?? '';

  const updateLine = (index: number, patch: Partial<RecipeLineDraft>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const addLine = () => {
    onChange([...lines, { ...EMPTY_RECIPE_LINE }]);
  };

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
          <select
            className="input text-sm bg-white w-32 shrink-0"
            value={line.componentable_type}
            onChange={(e) => updateLine(index, {
              componentable_type: e.target.value as RecipeLineDraft['componentable_type'],
              componentable_id: '',
            })}
          >
            <option value="ingredient">{t('inventory.componentIngredient')}</option>
            <option value="semi_finished_good">{t('inventory.componentSemiFinishedGood')}</option>
          </select>

          <select
            className="input text-sm bg-white flex-1 min-w-0"
            value={line.componentable_id}
            onChange={(e) => updateLine(index, { componentable_id: Number(e.target.value) })}
          >
            <option value="">{t('inventory.selectComponent')}</option>
            {optionsFor(line.componentable_type).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <input
            type="number" min={0} step="0.001" required placeholder={t('inventory.grossQuantity')}
            className="input text-sm w-28 shrink-0"
            value={line.gross_quantity}
            onChange={(e) => updateLine(index, { gross_quantity: e.target.value })}
          />
          <input
            type="number" min={0} step="0.001" placeholder={t('inventory.netQuantity')}
            className="input text-sm w-28 shrink-0"
            value={line.net_quantity}
            onChange={(e) => updateLine(index, { net_quantity: e.target.value })}
          />
          <span className="text-xs text-gray-400 w-10 shrink-0">{unitFor(line)}</span>

          <button type="button" onClick={() => removeLine(index)} className="text-gray-400 hover:text-red-500 shrink-0">
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      <button type="button" onClick={addLine} className="btn btn-secondary border border-gray-200 text-sm flex items-center gap-2">
        <Plus size={14} /> {t('inventory.addIngredientLine')}
      </button>
    </div>
  );
}
