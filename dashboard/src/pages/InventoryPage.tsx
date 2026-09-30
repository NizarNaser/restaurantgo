import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Package, Factory, History, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';
import RecipeEditor, { type RecipeLineDraft } from '../components/RecipeEditor';

// ── Shared types ──────────────────────────────────────────────

interface Ingredient {
  id: number;
  name: string;
  unit: 'gram' | 'piece';
  unit_price: string | null;
  current_stock: string;
  is_active: boolean;
}

interface SemiFinishedGood {
  id: number;
  name: string;
  unit: 'gram' | 'piece';
  current_stock: string;
  is_active: boolean;
}

interface StockMovement {
  id: number;
  stockable_type: string;
  type: 'in' | 'out';
  reason: string;
  quantity: string;
  occurred_at: string;
  notes: string | null;
  stockable: { name: string } | null;
  created_by: { name: string } | null;
}

type Tab = 'ingredients' | 'semi-finished' | 'movements';

const TABS: { key: Tab; labelKey: string; icon: typeof Package }[] = [
  { key: 'ingredients', labelKey: 'inventory.tabs.ingredients', icon: Package },
  { key: 'semi-finished', labelKey: 'inventory.tabs.semiFinished', icon: Factory },
  { key: 'movements', labelKey: 'inventory.tabs.movements', icon: History },
];

function componentOptions(ingredients: Ingredient[], goods: SemiFinishedGood[]) {
  return {
    ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit })),
    semiFinishedGoods: goods.map((g) => ({ id: g.id, name: g.name, unit: g.unit })),
  };
}

// ── Ingredients tab ──────────────────────────────────────────

function IngredientsTab({ ingredients, loading, onChanged }: {
  ingredients: Ingredient[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', unit: 'gram' as 'gram' | 'piece', current_stock: '', unit_price: '', entry_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/ingredients', {
        name: form.name.trim(),
        unit: form.unit,
        current_stock: form.current_stock ? Number(form.current_stock) : undefined,
        unit_price: form.unit_price ? Number(form.unit_price) : undefined,
        entry_date: form.entry_date,
      });
      setForm({ name: '', unit: 'gram', current_stock: '', unit_price: '', entry_date: new Date().toISOString().slice(0, 10) });
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message || t('inventory.createIngredientFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ingredient: Ingredient) => {
    if (!confirm(t('inventory.deleteConfirm', { name: ingredient.name }))) return;
    await api.delete(`/ingredients/${ingredient.id}`);
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('inventory.addIngredient')}</h3>
        <form onSubmit={handleAdd} className="space-y-2">
          <input type="text" required placeholder={t('inventory.namePlaceholder')} className="input w-full text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input w-full text-sm bg-white" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as 'gram' | 'piece' })}>
            <option value="gram">{t('inventory.unit.gram')}</option>
            <option value="piece">{t('inventory.unit.piece')}</option>
          </select>
          <input type="number" min={0} step="0.001" placeholder={t('inventory.initialQuantityPlaceholder')} className="input w-full text-sm" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
          <input type="number" min={0} step="0.0001" placeholder={t('inventory.unitPricePlaceholder')} className="input w-full text-sm" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          <label className="block text-xs text-gray-500">{t('inventory.entryDate')}</label>
          <input type="date" className="input w-full text-sm" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('inventory.addIngredient')}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">{t('inventory.name')}</th>
                <th className="px-4 py-3">{t('inventory.stock')}</th>
                <th className="px-4 py-3">{t('inventory.unitPrice')}</th>
                <th className="px-4 py-3 text-right">{t('orders.actionsLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ing.name}</td>
                  <td className="px-4 py-3">
                    <span className={parseFloat(ing.current_stock) <= 0 ? 'text-red-600 font-semibold' : ''}>
                      {parseFloat(ing.current_stock).toLocaleString()} {ing.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">{ing.unit_price ? `$${parseFloat(ing.unit_price).toFixed(4)}` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(ing)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {ingredients.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t('inventory.noIngredientsYet')}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Semi-finished goods tab ──────────────────────────────────

function SemiFinishedTab({ goods, ingredients, loading, onChanged }: {
  goods: SemiFinishedGood[];
  ingredients: Ingredient[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', unit: 'gram' as 'gram' | 'piece' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [recipeGood, setRecipeGood] = useState<SemiFinishedGood | null>(null);
  const [recipeLines, setRecipeLines] = useState<RecipeLineDraft[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeSaving, setRecipeSaving] = useState(false);

  const [produceGood, setProduceGood] = useState<SemiFinishedGood | null>(null);
  const [produceQty, setProduceQty] = useState('');
  const [producing, setProducing] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/semi-finished-goods', { name: form.name.trim(), unit: form.unit });
      setForm({ name: '', unit: 'gram' });
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.message || t('inventory.createGoodFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (good: SemiFinishedGood) => {
    if (!confirm(t('inventory.deleteConfirm', { name: good.name }))) return;
    await api.delete(`/semi-finished-goods/${good.id}`);
    onChanged();
  };

  const openRecipe = async (good: SemiFinishedGood) => {
    setRecipeGood(good);
    setRecipeLoading(true);
    try {
      const res = await api.get(`/semi-finished-goods/${good.id}/recipe`);
      setRecipeLines(res.data.map((l: any) => ({
        componentable_type: l.componentable_type.endsWith('Ingredient') ? 'ingredient' : 'semi_finished_good',
        componentable_id: l.componentable_id,
        gross_quantity: String(l.gross_quantity),
        net_quantity: l.net_quantity ? String(l.net_quantity) : '',
      })));
    } finally {
      setRecipeLoading(false);
    }
  };

  const saveRecipe = async () => {
    if (!recipeGood) return;
    setRecipeSaving(true);
    try {
      await api.put(`/semi-finished-goods/${recipeGood.id}/recipe`, {
        lines: recipeLines
          .filter((l) => l.componentable_id !== '')
          .map((l) => ({
            componentable_type: l.componentable_type,
            componentable_id: l.componentable_id,
            gross_quantity: Number(l.gross_quantity),
            net_quantity: l.net_quantity ? Number(l.net_quantity) : undefined,
          })),
      });
      setRecipeGood(null);
    } finally {
      setRecipeSaving(false);
    }
  };

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produceGood || !produceQty) return;
    setProducing(true);
    try {
      await api.post(`/semi-finished-goods/${produceGood.id}/produce`, { quantity: Number(produceQty) });
      setProduceGood(null);
      setProduceQty('');
      onChanged();
    } finally {
      setProducing(false);
    }
  };

  const { ingredients: ingredientOptions, semiFinishedGoods: goodOptions } = componentOptions(ingredients, goods);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('inventory.addGood')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('inventory.addGoodDesc')}</p>
        <form onSubmit={handleAdd} className="space-y-2">
          <input type="text" required placeholder={t('inventory.namePlaceholder')} className="input w-full text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input w-full text-sm bg-white" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as 'gram' | 'piece' })}>
            <option value="gram">{t('inventory.unit.gram')}</option>
            <option value="piece">{t('inventory.unit.piece')}</option>
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t('common.add')}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">{t('inventory.name')}</th>
                <th className="px-4 py-3">{t('inventory.stock')}</th>
                <th className="px-4 py-3 text-right">{t('orders.actionsLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {goods.map((good) => (
                <tr key={good.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{good.name}</td>
                  <td className="px-4 py-3">
                    <span className={parseFloat(good.current_stock) <= 0 ? 'text-red-600 font-semibold' : ''}>
                      {parseFloat(good.current_stock).toLocaleString()} {good.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => openRecipe(good)} className="text-xs text-gray-500 hover:text-[#ff4757] font-medium">{t('inventory.recipe')}</button>
                      <button onClick={() => setProduceGood(good)} className="text-xs text-gray-500 hover:text-[#ff4757] font-medium">{t('inventory.produce')}</button>
                      <button onClick={() => handleDelete(good)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {goods.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">{t('inventory.noGoodsYet')}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!recipeGood} onClose={() => setRecipeGood(null)} title={t('inventory.recipeTitle', { name: recipeGood?.name ?? '' })} size="lg">
        {recipeLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">{t('inventory.recipeDesc', { unit: recipeGood?.unit ?? '', name: recipeGood?.name ?? '' })}</p>
            <RecipeEditor
              lines={recipeLines}
              onChange={setRecipeLines}
              ingredients={ingredientOptions}
              semiFinishedGoods={goodOptions}
              excludeSemiFinishedGoodId={recipeGood?.id}
            />
            <button onClick={saveRecipe} disabled={recipeSaving} className="btn btn-primary w-full flex items-center justify-center gap-2">
              {recipeSaving ? <Loader2 size={16} className="animate-spin" /> : t('inventory.saveRecipe')}
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!produceGood} onClose={() => setProduceGood(null)} title={t('inventory.produceTitle', { name: produceGood?.name ?? '' })}>
        <form onSubmit={handleProduce} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t('inventory.quantityToProduce', { unit: produceGood?.unit ?? '' })}</label>
          <input type="number" required min={0} step="0.001" className="input w-full" value={produceQty} onChange={(e) => setProduceQty(e.target.value)} />
          <p className="text-xs text-gray-400">{t('inventory.produceWarning', { name: produceGood?.name ?? '' })}</p>
          <button type="submit" disabled={producing} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {producing ? <Loader2 size={16} className="animate-spin" /> : t('inventory.confirmProduction')}
          </button>
        </form>
      </Modal>
    </div>
  );
}

// ── Stock movements tab ──────────────────────────────────────

function MovementsTab() {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '', type: '' });

  useEffect(() => {
    setLoading(true);
    api.get('/stock-movements', { params: { ...filters, per_page: 50 } })
      .then((res) => setMovements(res.data.data))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.from')}</label>
          <input type="date" className="input text-sm" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.to')}</label>
          <input type="date" className="input text-sm" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('inventory.direction')}</label>
          <select className="input text-sm bg-white" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">{t('common.all')}</option>
            <option value="in">{t('inventory.in')}</option>
            <option value="out">{t('inventory.out')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">{t('inventory.date')}</th>
                <th className="px-4 py-3">{t('inventory.item')}</th>
                <th className="px-4 py-3">{t('inventory.direction')}</th>
                <th className="px-4 py-3">{t('inventory.reason')}</th>
                <th className="px-4 py-3">{t('inventory.quantity')}</th>
                <th className="px-4 py-3">{t('inventory.by')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(m.occurred_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.stockable?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {m.type === 'in' ? t('inventory.in') : t('inventory.out')}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{m.reason.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{parseFloat(m.quantity).toLocaleString()}</td>
                  <td className="px-4 py-3">{m.created_by?.name ?? '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('inventory.noMovementsInRange')}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function InventoryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [goods, setGoods] = useState<SemiFinishedGood[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [ingredientsRes, goodsRes] = await Promise.all([
      api.get<Ingredient[]>('/ingredients'),
      api.get<SemiFinishedGood[]>('/semi-finished-goods'),
    ]);
    setIngredients(ingredientsRes.data);
    setGoods(goodsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const depletedNames = [
    ...ingredients.filter((i) => parseFloat(i.current_stock) <= 0).map((i) => i.name),
    ...goods.filter((g) => parseFloat(g.current_stock) <= 0).map((g) => g.name),
  ];

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="text-[#ff4757]" size={24} /> {t('inventory.title')}
        </h1>
        <p className="text-gray-500 mt-1">{t('inventory.subtitle')}</p>
      </div>

      {depletedNames.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {t('inventory.outOfStockWarning', { count: depletedNames.length, names: depletedNames.join(', ') })}
          </span>
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key ? 'text-[#ff4757] border-b-2 border-[#ff4757]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} /> {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'ingredients' && <IngredientsTab ingredients={ingredients} loading={loading} onChanged={fetchAll} />}
      {activeTab === 'semi-finished' && <SemiFinishedTab goods={goods} ingredients={ingredients} loading={loading} onChanged={fetchAll} />}
      {activeTab === 'movements' && <MovementsTab />}
    </div>
  );
}
