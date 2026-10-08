import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, Loader2, X, Sparkles, Eye, EyeOff, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';
import RecipeEditor, { type RecipeComponentOption, type RecipeLineDraft } from '../components/RecipeEditor';
import { QRCodeSVG } from 'qrcode.react';

interface Category {
  id: number;
  name: string;
  items_count: number;
  department_id: number | null;
}

interface ItemTranslation {
  locale: string;
  name: string;
  description: string;
}

interface ItemPrice {
  currency: string;
  price: string;
}

interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  weight?: string | null;
  is_available: boolean;
  is_featured?: boolean;
  price: number | string;
  category_id: number;
  image_url?: string | null;
  image_thumb_url?: string | null;
  translations?: { locale: string; name: string; description: string | null }[];
  prices?: { currency: string; price: number | string }[];
  seo_title?: Record<string, string> | null;
  seo_description?: Record<string, string> | null;
  seo_og_image?: string | null;
}

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
];

// The SEO section's language tabs follow the restaurant's *full* configured
// language set (Settings → supported_locales), not just the languages this
// one item happens to already have a content translation for — a wider set,
// hence its own label lookup instead of the (currently 3-language) LOCALES above.
const SEO_LOCALE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', es: 'Español',
  it: 'Italiano', pt: 'Português', ru: 'Русский', uk: 'Українська', tr: 'Türkçe',
  zh: '中文', ja: '日本語',
};

const emptyTranslation = (locale: string): ItemTranslation => ({ locale, name: '', description: '' });
const emptyPrice = (currency = 'USD'): ItemPrice => ({ currency, price: '' });

export default function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all');
  
  // Modal states
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryDepartmentId, setCategoryDepartmentId] = useState('');
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [itemWeight, setItemWeight] = useState('');
  const [itemFeatured, setItemFeatured] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemSeo, setItemSeo] = useState<{ seo_title: Record<string, string>; seo_description: Record<string, string>; seo_og_image: string }>({ seo_title: {}, seo_description: {}, seo_og_image: '' });
  const [activeSeoLocale, setActiveSeoLocale] = useState('en');
  const [supportedLocales, setSupportedLocales] = useState<string[]>(['en']);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemImage, setItemImage] = useState<File | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [autoTranslatedLocales, setAutoTranslatedLocales] = useState<string[]>([]);

  const [translations, setTranslations] = useState<ItemTranslation[]>([emptyTranslation('en')]);
  const [activeLocale, setActiveLocale] = useState('en');
  const [prices, setPrices] = useState<ItemPrice[]>([emptyPrice('USD')]);
  
  // QR Code state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [menuQrCode, setMenuQrCode] = useState<{ id: number; scan_count: number } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Recipe (BOM) editor state — embedded directly in the add/edit item form,
  // since an item's raw materials/semi-finished goods are picked from the
  // same inventory that Ingredients/SemiFinishedGoods pages manage.
  const [recipeLines, setRecipeLines] = useState<RecipeLineDraft[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [ingredientOptions, setIngredientOptions] = useState<RecipeComponentOption[]>([]);
  const [goodOptions, setGoodOptions] = useState<RecipeComponentOption[]>([]);

  useEffect(() => {
    fetchData();
    // Departments and inventory are optional (Restaurant Setup / Inventory) —
    // a role without those permissions just won't see the related pickers.
    api.get('/departments').then((res) => setDepartments(res.data)).catch(() => {});
    api.get('/ingredients').then((res) => setIngredientOptions(res.data)).catch(() => {});
    api.get('/semi-finished-goods').then((res) => setGoodOptions(res.data)).catch(() => {});
    api.get('/settings').then((res) => {
      setSupportedLocales(res.data.supported_locales?.length ? res.data.supported_locales : ['en']);
      setActiveSeoLocale(res.data.default_locale || 'en');
    }).catch(() => {});
  }, []);

  // /menu/items is paginated (20 per page by default) — this page is the
  // one place that needs every item at once (the category sidebar's counts
  // are unpaginated totals, so a single page here used to silently truncate
  // the table for any tenant with more than ~20 menu items). Loop through
  // every page rather than guessing a "large enough" per_page.
  const fetchAllMenuItems = async (): Promise<MenuItem[]> => {
    const perPage = 100;
    let page = 1;
    let all: MenuItem[] = [];
    while (true) {
      const res = await api.get('/menu/items', { params: { per_page: perPage, page } });
      all = all.concat(res.data.data || []);
      const lastPage = res.data.meta?.last_page ?? 1;
      if (page >= lastPage) break;
      page += 1;
    }
    return all;
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [catRes, allItems, statsRes] = await Promise.all([
        api.get('/menu/categories'),
        fetchAllMenuItems(),
        api.get('/dashboard/stats'),
      ]);
      setCategories(catRes.data.data || []);
      setItems(allItems);
      if (statsRes.data.tenant_slug) {
        setTenantSlug(statsRes.data.tenant_slug);
        setPublicUrl(statsRes.data.public_url ?? '');
      }
    } catch (error: any) {
      console.error('Failed to fetch menu data', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('auth_token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/menu/categories', {
        name: categoryName,
        is_active: true,
        department_id: categoryDepartmentId || undefined,
      });
      setCategoryName('');
      setCategoryDepartmentId('');
      setCategoryModalOpen(false);
      fetchData(); // Refresh lists
    } catch (error) {
      console.error('Failed to create category', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetItemForm = () => {
    setItemWeight('');
    setItemFeatured(false);
    setItemAvailable(true);
    setItemCategoryId('');
    setItemImage(null);
    setItemSeo({ seo_title: {}, seo_description: {}, seo_og_image: '' });
    setActiveSeoLocale('en');
    setTranslations([emptyTranslation('en')]);
    setActiveLocale('en');
    setPrices([emptyPrice('USD')]);
    setAutoTranslatedLocales([]);
    setTranslateError('');
    setRecipeLines([]);
  };

  const handleCreateOrUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        menu_category_id: parseInt(itemCategoryId),
        is_available: itemAvailable,
        is_featured: itemFeatured,
        weight: itemWeight || null,
        seo_title: itemSeo.seo_title,
        seo_description: itemSeo.seo_description,
        seo_og_image: itemSeo.seo_og_image || null,
        translations: translations
          .filter((t) => t.name.trim())
          .map((t) => ({ locale: t.locale, name: t.name, description: t.description || undefined })),
        prices: prices
          .filter((p) => p.currency.trim() && p.price !== '')
          .map((p) => ({ currency: p.currency.toUpperCase(), price: parseFloat(p.price) })),
      };

      let res;
      if (editingItem) {
        res = await api.put(`/menu/items/${editingItem.id}`, payload);
      } else {
        res = await api.post('/menu/items', payload);
      }

      // Upload image if present
      const itemId = editingItem?.id || res.data?.id;
      if (itemImage && itemId) {
        const formData = new FormData();
        formData.append('file', itemImage);
        // Must override the instance's default 'application/json' header here:
        // axios's transformRequest JSON-stringifies FormData bodies whenever it
        // sees a JSON content-type already set, silently dropping the file. Any
        // non-JSON value works — axios clears it again before the real browser
        // XHR send so the correct multipart boundary still gets added.
        await api.post(`/menu/items/${itemId}/media`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Recipe lines are edited inline in this same form but saved through
      // their own endpoint, which requires the item to already exist —
      // so this always runs after the item itself is created/updated.
      if (itemId) {
        await api.put(`/menu/items/${itemId}/recipe`, {
          lines: recipeLines
            .filter((l) => l.componentable_id !== '')
            .map((l) => ({
              componentable_type: l.componentable_type,
              componentable_id: l.componentable_id,
              gross_quantity: Number(l.gross_quantity),
              net_quantity: l.net_quantity ? Number(l.net_quantity) : undefined,
            })),
        });
      }

      resetItemForm();
      setItemModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || t('menu.saveItemFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = async (item: MenuItem) => {
    setEditingItem(item);
    setAutoTranslatedLocales([]);
    setTranslateError('');
    setItemWeight(item.weight || '');
    setItemFeatured(Boolean(item.is_featured));
    setItemAvailable(item.is_available);
    setItemCategoryId(String(item.category_id));
    setItemSeo({
      seo_title: item.seo_title ?? {},
      seo_description: item.seo_description ?? {},
      seo_og_image: item.seo_og_image ?? '',
    });
    setActiveSeoLocale(supportedLocales[0] ?? 'en');
    setTranslations(
      item.translations?.length
        ? item.translations.map((t) => ({ locale: t.locale, name: t.name, description: t.description || '' }))
        : [{ ...emptyTranslation('en'), name: item.name, description: item.description || '' }],
    );
    setActiveLocale(item.translations?.[0]?.locale ?? 'en');
    setPrices(
      item.prices?.length
        ? item.prices.map((p) => ({ currency: p.currency, price: String(p.price) }))
        : [{ ...emptyPrice('USD'), price: String(item.price) }],
    );
    setRecipeLines([]);
    setItemModalOpen(true);

    setRecipeLoading(true);
    try {
      const res = await api.get(`/menu/items/${item.id}/recipe`);
      setRecipeLines(res.data.map((l: any) => ({
        componentable_type: l.componentable_type.endsWith('Ingredient') ? 'ingredient' : 'semi_finished_good',
        componentable_id: l.componentable_id,
        gross_quantity: String(l.gross_quantity),
        net_quantity: l.net_quantity ? String(l.net_quantity) : '',
      })));
    } catch {
      // Recipe section just starts empty — the item's own fields already loaded above.
    } finally {
      setRecipeLoading(false);
    }
  };

  const currentTranslation = translations.find((t) => t.locale === activeLocale) ?? translations[0];

  const updateCurrentTranslation = (patch: Partial<ItemTranslation>) => {
    setTranslations((prev) => prev.map((t) => (t.locale === activeLocale ? { ...t, ...patch } : t)));
    setAutoTranslatedLocales((prev) => prev.filter((l) => l !== activeLocale));
  };

  // Prefer the 'en' tab as the source if it has content, otherwise the first
  // filled-in tab — the source text is sent as-is, not saved anywhere.
  const translationSource = translations.find((t) => t.locale === 'en' && t.name.trim())
    ?? translations.find((t) => t.name.trim() && t.locale !== activeLocale);

  const handleAutoTranslate = async () => {
    if (!translationSource) return;
    setTranslating(true);
    setTranslateError('');
    try {
      const res = await api.post('/menu/items/translate', {
        source_locale: translationSource.locale,
        target_locale: activeLocale,
        name: translationSource.name,
        description: translationSource.description || undefined,
      });
      setTranslations((prev) => prev.map((t) => (
        t.locale === activeLocale ? { ...t, name: res.data.name, description: res.data.description } : t
      )));
      setAutoTranslatedLocales((prev) => [...prev, activeLocale]);
    } catch (err: any) {
      setTranslateError(err.response?.data?.message || t('menu.translateFailed'));
    } finally {
      setTranslating(false);
    }
  };

  const addLocale = (locale: string) => {
    if (translations.some((t) => t.locale === locale)) {
      setActiveLocale(locale);
      return;
    }
    setTranslations((prev) => [...prev, emptyTranslation(locale)]);
    setActiveLocale(locale);
  };

  const removeLocale = (locale: string) => {
    if (translations.length === 1) return;
    const next = translations.filter((t) => t.locale !== locale);
    setTranslations(next);
    if (activeLocale === locale) setActiveLocale(next[0].locale);
  };

  const updatePriceRow = (index: number, patch: Partial<ItemPrice>) => {
    setPrices((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addPriceRow = () => setPrices((prev) => [...prev, emptyPrice('')]);

  const removePriceRow = (index: number) => {
    if (prices.length === 1) return;
    setPrices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm(t('menu.deleteItemConfirm'))) {
      try {
        await api.delete(`/menu/items/${id}`);
        fetchData();
      } catch (error) {
        console.error('Failed to delete item', error);
      }
    }
  };

  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleToggleAvailability = async (item: MenuItem) => {
    setTogglingId(item.id);
    try {
      // menu_category_id is required by MenuItemRequest even on a partial
      // update — a bare {is_available} payload fails validation.
      await api.put(`/menu/items/${item.id}`, { menu_category_id: item.category_id, is_available: !item.is_available });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)));
    } catch (error) {
      console.error('Failed to toggle availability', error);
    } finally {
      setTogglingId(null);
    }
  };

  const openQrModal = async () => {
    setQrModalOpen(true);
    setQrLoading(true);
    try {
      const targetUrl = publicUrl || `${window.location.protocol}//${window.location.host}/p/${tenantSlug || 'demo'}`;
      const existing = await api.get('/qr-codes');
      const menuQr = (existing.data as { id: number; type: string; scan_count: number }[]).find(
        (q) => q.type === 'menu',
      );
      if (menuQr) {
        setMenuQrCode(menuQr);
      } else {
        const created = await api.post('/qr-codes', { type: 'menu', target_url: targetUrl });
        setMenuQrCode(created.data);
      }
    } catch (error) {
      console.error('Failed to load QR code', error);
    } finally {
      setQrLoading(false);
    }
  };

  const filteredItems = items
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
    .filter(item => activeCategoryId === 'all' || item.category_id === activeCategoryId);

  // Group categories under their department (Kitchen, Bar, ...) so the
  // sidebar mirrors the same hierarchy used by KDS/reports — e.g. "Salad"
  // nested under "Kitchen". Categories without a department (or one that
  // was deleted) fall into an "Other" bucket, shown only if departments
  // exist at all — otherwise the list stays flat.
  const categoryGroups = departments.length === 0
    ? [{ department: null, categories }]
    : [
        ...departments.map((dept) => ({
          department: dept,
          categories: categories.filter((c) => c.department_id === dept.id),
        })),
        {
          department: null,
          categories: categories.filter((c) => !departments.some((d) => d.id === c.department_id)),
        },
      ].filter((group) => group.categories.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <p className="text-red-500 font-medium">{fetchError}</p>
        <button onClick={fetchData} className="btn btn-primary">{t('menu.retry')}</button>
        <button onClick={() => { localStorage.removeItem('auth_token'); navigate('/login'); }} className="text-sm text-gray-500 underline">
          {t('menu.loginAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t('nav.menu')}</h2>
        <div className="flex gap-3">
          <button
            onClick={openQrModal}
            className="btn btn-secondary border border-gray-200"
          >
            {t('menu.qrCode')}
          </button>
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="btn btn-secondary border border-gray-200"
          >
            <Plus size={18} className="mr-2" /> {t('dashboard.addCategory')}
          </button>
          <button
            onClick={() => {
              resetItemForm();
              setEditingItem(null);
              setItemModalOpen(true);
            }}
            className="btn btn-primary"
          >
            <Plus size={18} className="mr-2" /> {t('menu.addItem')}
          </button>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-160px)]">
        {/* Categories Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 overflow-y-auto pr-2">
          <h3 className="font-semibold text-gray-600 uppercase text-xs tracking-wider mb-2">{t('dashboard.categories')}</h3>
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium flex justify-between items-center transition-colors ${
              activeCategoryId === 'all' ? 'bg-red-50 text-[#ff4757] border border-red-100' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t('menu.allItems')}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
              activeCategoryId === 'all' ? 'bg-white text-red-600 border-red-100' : 'bg-gray-200 text-gray-600 border-transparent'
            }`}>
              {items.length}
            </span>
          </button>
          {categoryGroups.map((group) => (
            <div key={group.department?.id ?? 'other'} className="pt-2">
              {group.department && (
                <p className="px-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{group.department.name}</p>
              )}
              {!group.department && departments.length > 0 && (
                <p className="px-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t('menu.otherCategories')}</p>
              )}
              {group.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium flex justify-between items-center transition-colors ${
                    activeCategoryId === cat.id ? 'bg-red-50 text-[#ff4757] border border-red-100' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat.name}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    activeCategoryId === cat.id ? 'bg-white text-red-600 border-red-100' : 'bg-gray-200 text-gray-600 border-transparent'
                  }`}>
                    {cat.items_count || 0}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Items List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder={t('menu.searchItems')}
                className="input w-full pl-10 py-2 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-200 z-10">
                <tr>
                  <th className="px-6 py-4">{t('menu.itemName')}</th>
                  <th className="px-6 py-4">{t('salesDashboard.category')}</th>
                  <th className="px-6 py-4">{t('menu.price')}</th>
                  <th className="px-6 py-4">{t('orders.statusLabel')}</th>
                  <th className="px-6 py-4 text-right">{t('orders.actionsLabel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 overflow-hidden shrink-0">
                          {item.image_url ? (
                            <img src={item.image_thumb_url || item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{t('menu.img')}</span>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {categories.find(c => c.id === item.category_id)?.name || t('menu.unknown')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      ${parseFloat(String(item.price)).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        disabled={togglingId === item.id}
                        title={item.is_available ? t('menu.clickToHide') : t('menu.clickToShow')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                          item.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {togglingId === item.id ? <Loader2 size={12} className="animate-spin" /> : (item.is_available ? <Eye size={12} /> : <EyeOff size={12} />)}
                        {item.is_available ? t('menu.available') : t('menu.outOfStock')}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          aria-label={t('menu.editItemAria', { name: item.name })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          aria-label={t('menu.deleteItemAria', { name: item.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Search size={32} className="mb-2 opacity-50" />
                <p>{t('menu.noItemsFound')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={t('menu.addCategoryTitle')}>
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.categoryName')}</label>
            <input
              type="text"
              required
              className="input w-full"
              placeholder={t('menu.categoryNamePlaceholder')}
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
            />
          </div>
          {departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.departmentOptional')}</label>
              <select
                className="input w-full"
                value={categoryDepartmentId}
                onChange={e => setCategoryDepartmentId(e.target.value)}
              >
                <option value="">{t('menu.noneOption')}</option>
                {departments.map(dep => (
                  <option key={dep.id} value={dep.id}>{dep.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setCategoryModalOpen(false)} className="btn btn-secondary border border-gray-200">
              {t('menu.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary min-w-[100px] flex justify-center">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : t('menu.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
          resetItemForm();
        }}
        title={editingItem ? t('menu.editItem') : t('menu.addNewItem')}
        size="lg"
      >
        <form onSubmit={handleCreateOrUpdateItem} className="space-y-4">
          {/* Locale tabs — name & description per language */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
            {translations.map((tr) => (
              <button
                key={tr.locale}
                type="button"
                onClick={() => setActiveLocale(tr.locale)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tr.locale === activeLocale ? 'bg-red-50 text-[#ff4757]' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {LOCALES.find((l) => l.code === tr.locale)?.label ?? tr.locale}
                {translations.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeLocale(tr.locale); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeLocale(tr.locale); } }}
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
            <select
              value=""
              onChange={(e) => e.target.value && addLocale(e.target.value)}
              className="ml-auto text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
            >
              <option value="">{t('articles.addLanguage')}</option>
              {LOCALES.filter((l) => !translations.some((tr) => tr.locale === l.code)).map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {currentTranslation && (
            <div className="space-y-4" dir={currentTranslation.locale === 'ar' ? 'rtl' : 'ltr'}>
              {translationSource && translationSource.locale !== activeLocale && (
                <div className="flex items-center justify-between -mb-2">
                  <button
                    type="button"
                    onClick={handleAutoTranslate}
                    disabled={translating}
                    className="text-xs font-medium text-[#ff4757] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {translating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {t('menu.autoTranslateFrom', { locale: LOCALES.find((l) => l.code === translationSource.locale)?.label ?? translationSource.locale })}
                  </button>
                  {autoTranslatedLocales.includes(activeLocale) && (
                    <span className="text-xs text-gray-400">{t('menu.translatedByAi')}</span>
                  )}
                </div>
              )}
              {translateError && <p className="text-xs text-red-500 -mb-2">{translateError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.itemName')}</label>
                <input
                  type="text"
                  required={currentTranslation.locale === 'en'}
                  className="input w-full"
                  placeholder={t('menu.itemNamePlaceholder')}
                  value={currentTranslation.name}
                  onChange={(e) => updateCurrentTranslation({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.description')}</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#ff4757]"
                  rows={3}
                  placeholder={t('menu.descriptionPlaceholder')}
                  value={currentTranslation.description}
                  onChange={(e) => updateCurrentTranslation({ description: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Prices — one row per currency */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">{t('menu.prices')}</label>
              <button type="button" onClick={addPriceRow} className="text-xs font-medium text-[#ff4757] hover:underline">
                {t('menu.addCurrency')}
              </button>
            </div>
            <div className="space-y-2">
              {prices.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    required
                    className="input w-24 uppercase"
                    placeholder="USD"
                    value={p.currency}
                    onChange={(e) => updatePriceRow(i, { currency: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input flex-1"
                    placeholder="12.99"
                    value={p.price}
                    onChange={(e) => updatePriceRow(i, { price: e.target.value })}
                  />
                  {prices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePriceRow(i)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('salesDashboard.category')}</label>
            <select
              required
              className="input w-full bg-white"
              value={itemCategoryId}
              onChange={e => setItemCategoryId(e.target.value)}
            >
              <option value="" disabled>{t('menu.selectCategory')}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.weightOptional')}</label>
              <input
                type="text"
                className="input w-full"
                placeholder={t('menu.weightPlaceholder')}
                value={itemWeight}
                onChange={e => setItemWeight(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 mb-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#ff4757]"
                checked={itemFeatured}
                onChange={e => setItemFeatured(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">{t('menu.showInTrending')}</span>
            </label>
            <label className="flex items-center gap-2 mb-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#ff4757]"
                checked={itemAvailable}
                onChange={e => setItemAvailable(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">{t('menu.availableForOrdering')}</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.imageOptional')}</label>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-red-50 file:text-red-700
                hover:file:bg-red-100 cursor-pointer"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  setItemImage(e.target.files[0]);
                }
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">{t('menu.recipeSectionTitle')}</label>
              <a href="/inventory" target="_blank" rel="noreferrer" className="text-xs font-medium text-[#ff4757] hover:underline">
                {t('menu.manageInventoryLink')}
              </a>
            </div>
            <p className="text-xs text-gray-400 mb-2">{t('menu.recipeSectionDesc')}</p>
            {recipeLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
            ) : (
              <RecipeEditor
                lines={recipeLines}
                onChange={setRecipeLines}
                ingredients={ingredientOptions}
                semiFinishedGoods={goodOptions}
              />
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Globe size={16} className="text-gray-400" />
              {t('menu.searchSocialPreview')}
            </h4>

            <div className="flex flex-wrap gap-2">
              {supportedLocales.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveSeoLocale(code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeSeoLocale === code ? 'bg-[#ff4757] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {SEO_LOCALE_LABELS[code] ?? code}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.metaTitle')}</label>
              <input
                value={itemSeo.seo_title[activeSeoLocale] ?? ''}
                onChange={(e) => setItemSeo({ ...itemSeo, seo_title: { ...itemSeo.seo_title, [activeSeoLocale]: e.target.value } })}
                placeholder={t('menu.metaTitlePlaceholder')}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('menu.metaDescription')}
                <span className="text-gray-400 font-normal"> — {t('menu.metaDescriptionCount', { count: itemSeo.seo_description[activeSeoLocale]?.length ?? 0 })}</span>
              </label>
              <textarea
                value={itemSeo.seo_description[activeSeoLocale] ?? ''}
                onChange={(e) => setItemSeo({ ...itemSeo, seo_description: { ...itemSeo.seo_description, [activeSeoLocale]: e.target.value } })}
                rows={2}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.socialShareImageUrl')}</label>
              <input
                value={itemSeo.seo_og_image}
                onChange={(e) => setItemSeo({ ...itemSeo, seo_og_image: e.target.value })}
                placeholder="https://…"
                className="input w-full"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setItemModalOpen(false)} className="btn btn-secondary border border-gray-200">
              {t('menu.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary min-w-[100px] flex justify-center">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : t('menu.saveItem')}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => { setQrModalOpen(false); setMenuQrCode(null); }}
        title={t('settings.menuQrCode')}
      >
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <p className="text-center text-sm text-gray-600 mb-4">
            {t('menu.qrScanExplain')}
          </p>
          {qrLoading || !menuQrCode ? (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <Loader2 className="animate-spin text-gray-400" size={28} />
            </div>
          ) : (
            <>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <QRCodeSVG
                  value={`${(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '')}/v1/qr/${menuQrCode.id}`}
                  size={200}
                  level="H"
                />
              </div>
              <p className="text-xs text-gray-500">
                {t('menu.scannedTimes', { count: menuQrCode.scan_count })}
              </p>
            </>
          )}
          <a
            href={publicUrl || `/p/${tenantSlug || 'demo'}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            {t('menu.viewPublicMenuUrl')}
          </a>
          <button
            onClick={() => window.print()}
            disabled={!menuQrCode}
            className="btn btn-primary w-full mt-4 disabled:opacity-60"
          >
            {t('settings.printQrCode')}
          </button>
        </div>
      </Modal>

    </div>
  );
}
