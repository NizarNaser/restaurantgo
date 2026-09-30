import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Receipt, Percent, Loader2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

interface SummaryReport {
  mode: 'orders' | 'items';
  orders_count: number;
  items_sold?: number;
  income: number;
  discounts: number | null;
  average_order: number;
}

interface StaffRow {
  user_id: number;
  name: string;
  orders_count: number;
  income: number;
}

interface ChartPoint {
  key: string;
  label: string;
  income: number;
}

interface Option { id: number; name: string; }
interface CategoryOption extends Option { department_id: number | null; }
interface MenuItemOption extends Option { category_id: number; }
interface TableOption { id: number; table_number: string; hall_name: string | null; }

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof DollarSign; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function SalesDashboardPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [menuItemId, setMenuItemId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [tableId, setTableId] = useState('');
  const [staffId, setStaffId] = useState('');

  const [branches, setBranches] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [shifts, setShifts] = useState<{ id: number; opened_at: string }[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);

  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Option[]>('/branches').then((res) => setBranches(res.data)).catch(() => {});
    api.get<Option[]>('/departments').then((res) => setDepartments(res.data)).catch(() => {});
    api.get('/menu/categories').then((res) => setCategories(res.data.data ?? res.data)).catch(() => {});
    api.get('/menu/items', { params: { per_page: 500 } }).then((res) => setMenuItems(res.data.data ?? res.data)).catch(() => {});
    api.get('/shifts').then((res) => setShifts(res.data.data ?? [])).catch(() => {});
    api.get<TableOption[]>('/reports/tables').then((res) => setTables(res.data)).catch(() => {});
  }, []);

  const filters = {
    from, to,
    branch_id: branchId || undefined,
    department_id: departmentId || undefined,
    category_id: categoryId || undefined,
    menu_item_id: menuItemId || undefined,
    shift_id: shiftId || undefined,
    table_id: tableId || undefined,
    staff_id: staffId || undefined,
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<SummaryReport>('/reports/sales/summary', { params: filters }),
      // Deliberately not filtered by table_id/staff_id — this breakdown is
      // meant to stay a stable comparison across staff regardless of the
      // summary's own filter selection, and it also doubles as the Staff
      // filter dropdown's option source below.
      api.get<StaffRow[]>('/reports/sales/by-staff', { params: { from, to, branch_id: branchId || undefined } }),
      api.get<ChartPoint[]>('/reports/sales/chart-data', { params: { from, to, branch_id: branchId || undefined, table_id: tableId || undefined, staff_id: staffId || undefined, group_by: 'day' } }),
    ]).then(([summaryRes, staffRes, chartRes]) => {
      setSummary(summaryRes.data);
      setStaffRows(staffRes.data);
      setChartData(chartRes.data);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, branchId, departmentId, categoryId, menuItemId, shiftId, tableId, staffId]);

  const categoriesInDept = categories.filter((c) => !departmentId || String(c.department_id) === departmentId);
  const itemsInCategory = menuItems.filter((i) => !categoryId || String(i.category_id) === categoryId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-[#ff4757]" size={24} /> {t('salesDashboard.title')}
        </h2>
        <p className="text-sm text-gray-500">{t('salesDashboard.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.from')}</label>
          <input type="date" className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.to')}</label>
          <input type="date" className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {branches.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.branch')}</label>
            <select className="input text-sm bg-white" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.department')}</label>
          <select className="input text-sm bg-white" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setCategoryId(''); setMenuItemId(''); }}>
            <option value="">{t('common.all')}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.category')}</label>
          <select className="input text-sm bg-white" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setMenuItemId(''); }}>
            <option value="">{t('common.all')}</option>
            {categoriesInDept.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.product')}</label>
          <select className="input text-sm bg-white" value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {itemsInCategory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        {shifts.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.shift')}</label>
            <select className="input text-sm bg-white" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{new Date(s.opened_at).toLocaleString()}</option>)}
            </select>
          </div>
        )}
        {tables.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.table')}</label>
            <select className="input text-sm bg-white" value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {tables.map((t2) => <option key={t2.id} value={t2.id}>{t2.hall_name ? `${t2.hall_name} — ` : ''}{t('orders.tableNumber', { number: t2.table_number })}</option>)}
            </select>
          </div>
        )}
        {staffRows.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('salesDashboard.staff')}</label>
            <select className="input text-sm bg-white" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t('common.all')}</option>
              {staffRows.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={DollarSign} label={t('salesDashboard.income')} value={summary ? summary.income.toFixed(2) : '—'} />
            <StatTile icon={Receipt} label={t('orders.title')} value={summary ? String(summary.orders_count) : '—'} hint={summary?.items_sold !== undefined ? t('salesDashboard.itemsCount', { count: summary.items_sold }) : undefined} />
            <StatTile icon={TrendingUp} label={t('salesDashboard.averageOrder')} value={summary ? summary.average_order.toFixed(2) : '—'} />
            <StatTile icon={Percent} label={t('salesDashboard.discountsGiven')} value={summary?.discounts !== null && summary?.discounts !== undefined ? summary.discounts.toFixed(2) : t('salesDashboard.notAvailable')} hint={summary?.mode === 'items' ? t('salesDashboard.notAvailableForProduct') : undefined} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('salesDashboard.incomeOverTime')}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#747d8c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#747d8c' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip />
                <Bar dataKey="income" name={t('salesDashboard.income')} fill="#ff4757" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('salesDashboard.byStaff')}</h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {staffRows.map((row) => (
                <div key={row.user_id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-gray-800">{row.name}</span>
                  <span className="text-sm text-gray-500">{t('salesDashboard.ordersIncomeLine', { count: row.orders_count, income: row.income.toFixed(2) })}</span>
                </div>
              ))}
              {staffRows.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">{t('salesDashboard.noSalesInRange')}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
