import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Loader2, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

interface Transaction {
  id: number;
  amount: string | number;
  currency: string;
  description: string;
  date: string;
  vendor?: string;
  reference_number?: string;
}

interface Summary {
  revenue_this_month: number;
  expense_this_month: number;
  profit_this_month: number;
  revenue_last_month: number;
  expense_last_month: number;
  profit_last_month: number;
}

interface ChartPoint {
  month: string;
  label: string;
  revenue: number;
  expense: number;
  profit: number;
}

interface ProfitLossReport {
  from: string;
  to: string;
  rows: ChartPoint[];
  totals: { revenue: number; expense: number; profit: number };
}

type Tab = 'revenues' | 'expenses' | 'report';

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function FinancialPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenues, setRevenues] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('revenues');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [form, setForm] = useState({
    amount: '',
    currency: 'USD',
    description: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    reference_number: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [sumRes, revRes, expRes, chartRes, reportRes] = await Promise.all([
        api.get('/financial/summary'),
        api.get('/financial/revenues'),
        api.get('/financial/expenses'),
        api.get('/financial/chart-data', { params: { months: 6 } }),
        api.get('/financial/reports/profit-loss'),
      ]);
      setSummary(sumRes.data);
      setRevenues(revRes.data);
      setExpenses(expRes.data);
      setChartData(chartRes.data);
      setReport(reportRes.data);
    } catch (e) {
      console.error('Failed to load financial data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'revenues' | 'expenses') => {
    setIsExporting(true);
    try {
      const res = await api.get(`/financial/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export', e);
      alert(t('financial.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const endpoint = activeTab === 'revenues' ? '/financial/revenues' : '/financial/expenses';
      await api.post(endpoint, {
        amount: parseFloat(form.amount),
        currency: form.currency,
        description: form.description,
        date: form.date,
        ...(activeTab === 'expenses' ? { vendor: form.vendor } : { reference_number: form.reference_number }),
      });
      setModalOpen(false);
      setForm({ amount: '', currency: 'USD', description: '', date: new Date().toISOString().split('T')[0], vendor: '', reference_number: '' });
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || t('financial.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, type: Tab) => {
    if (!confirm(t('financial.deleteConfirm'))) return;
    try {
      await api.delete(`/financial/${type}/${id}`);
      fetchAll();
    } catch { /* ignore */ }
  };

  const fmt = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const pct = (cur: number, prev: number) => prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;
  }

  const statCards = [
    {
      label: t('financial.revenueThisMonth'),
      value: fmt(summary?.revenue_this_month ?? 0),
      change: pct(summary?.revenue_this_month ?? 0, summary?.revenue_last_month ?? 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: t('financial.expensesThisMonth'),
      value: fmt(summary?.expense_this_month ?? 0),
      change: pct(summary?.expense_this_month ?? 0, summary?.expense_last_month ?? 0),
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-50',
      invertTrend: true,
    },
    {
      label: t('financial.netProfitThisMonth'),
      value: fmt(summary?.profit_this_month ?? 0),
      change: pct(summary?.profit_this_month ?? 0, summary?.profit_last_month ?? 0),
      icon: DollarSign,
      color: (summary?.profit_this_month ?? 0) >= 0 ? 'text-blue-600' : 'text-red-500',
      bg: (summary?.profit_this_month ?? 0) >= 0 ? 'bg-blue-50' : 'bg-red-50',
    },
  ];

  const list = activeTab === 'revenues' ? revenues : expenses;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('financial.title')}</h1>
          <p className="text-gray-500 mt-1">{t('financial.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== 'report' && (
            <button
              onClick={() => handleExport(activeTab)}
              disabled={isExporting}
              className="btn btn-outline"
            >
              {isExporting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Download size={18} className="mr-2" />}
              {t('financial.exportExcel')}
            </button>
          )}
          {activeTab !== 'report' && (
            <button onClick={() => setModalOpen(true)} className="btn btn-primary">
              <Plus size={18} className="mr-2" />
              {activeTab === 'revenues' ? t('financial.addRevenue') : t('financial.addExpense')}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statCards.map((card, i) => {
          const up = card.invertTrend ? card.change < 0 : card.change >= 0;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                  <card.icon size={20} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
                {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {t('financial.vsLastMonth', { percent: Math.abs(card.change) })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue vs. Expense Trend */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{t('financial.revenueVsExpenses')}</h2>
        {chartData.every(p => p.revenue === 0 && p.expense === 0) ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">{t('financial.noDataForPeriod')}</div>
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#747d8c' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#747d8c' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(value) => `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                contentStyle={{ borderRadius: 8, border: '1px solid #dfe4ea', fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="revenue" name={t('financial.revenue')} fill="#16a34a" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="expense" name={t('financial.expenses')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={28} />
              <Line dataKey="profit" name={t('financial.profit')} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabs + Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['revenues', 'expenses', 'report'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'text-[#ff4757] border-b-2 border-[#ff4757] bg-red-50/40'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'report' ? t('financial.profitAndLoss') : `${tab === 'revenues' ? t('financial.revenues') : t('financial.expenses')} (${tab === 'revenues' ? revenues.length : expenses.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'report' ? (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">{t('financial.month')}</th>
                  <th className="px-6 py-4 text-right">{t('financial.revenue')}</th>
                  <th className="px-6 py-4 text-right">{t('financial.expenses')}</th>
                  <th className="px-6 py-4 text-right">{t('financial.profitLoss')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!report || report.rows.every(r => r.revenue === 0 && r.expense === 0) ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      <DollarSign size={40} className="mx-auto mb-3 text-gray-200" />
                      <p className="font-medium text-gray-500">{t('financial.noActivityThisYear')}</p>
                    </td>
                  </tr>
                ) : (
                  report.rows.map(row => (
                    <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{row.label}</td>
                      <td className="px-6 py-4 text-right text-green-600 font-medium">{fmt(row.revenue)}</td>
                      <td className="px-6 py-4 text-right text-red-500 font-medium">{fmt(row.expense)}</td>
                      <td className={`px-6 py-4 text-right font-semibold ${row.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {row.profit >= 0 ? '+' : '-'}{fmt(row.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {report && (
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 font-bold text-gray-900">{t('financial.total')} ({report.from} → {report.to})</td>
                    <td className="px-6 py-4 text-right text-green-600 font-bold">{fmt(report.totals.revenue)}</td>
                    <td className="px-6 py-4 text-right text-red-500 font-bold">{fmt(report.totals.expense)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${report.totals.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {report.totals.profit >= 0 ? '+' : '-'}{fmt(report.totals.profit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">{t('financial.date')}</th>
                <th className="px-6 py-4">{t('financial.description')}</th>
                {activeTab === 'expenses' && <th className="px-6 py-4">{t('financial.vendor')}</th>}
                {activeTab === 'revenues' && <th className="px-6 py-4">{t('financial.refNumber')}</th>}
                <th className="px-6 py-4 text-right">{t('financial.amount')}</th>
                <th className="px-6 py-4 text-right">{t('orders.actionsLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <DollarSign size={40} className="mx-auto mb-3 text-gray-200" />
                    <p className="font-medium text-gray-500">{t('financial.noneRecordedYet', { type: activeTab === 'revenues' ? t('financial.revenues') : t('financial.expenses') })}</p>
                    <p className="text-xs mt-1">{t('financial.clickAddToStart', { label: activeTab === 'revenues' ? t('financial.addRevenue') : t('financial.addExpense') })}</p>
                  </td>
                </tr>
              ) : (
                list.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{row.date}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{row.description}</td>
                    {activeTab === 'expenses' && <td className="px-6 py-4 text-gray-500">{row.vendor || '-'}</td>}
                    {activeTab === 'revenues' && <td className="px-6 py-4 text-gray-500">{row.reference_number || '-'}</td>}
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${activeTab === 'revenues' ? 'text-green-600' : 'text-red-500'}`}>
                        {activeTab === 'revenues' ? '+' : '-'}{parseFloat(String(row.amount)).toFixed(2)} {row.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(row.id, activeTab)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={activeTab === 'revenues' ? t('financial.addRevenue') : t('financial.addExpense')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.amount')}</label>
              <input type="number" step="0.01" name="amount" required className="input w-full" value={form.amount} onChange={handleInput} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.currency')}</label>
              <select name="currency" className="input w-full bg-white" value={form.currency} onChange={handleInput}>
                {['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.description')}</label>
            <input type="text" name="description" required className="input w-full" value={form.description} onChange={handleInput} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.date')}</label>
            <input type="date" name="date" required className="input w-full" value={form.date} onChange={handleInput} />
          </div>
          {activeTab === 'expenses' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.vendorOptional')}</label>
              <input type="text" name="vendor" className="input w-full" value={form.vendor} onChange={handleInput} />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('financial.refNumberOptional')}</label>
              <input type="text" name="reference_number" className="input w-full" value={form.reference_number} onChange={handleInput} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary border border-gray-200">{t('menu.cancel')}</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary min-w-[120px] flex justify-center">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : t('menu.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
