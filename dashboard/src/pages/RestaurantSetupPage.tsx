import React, { useEffect, useState } from 'react';
import { DndContext, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { Plus, Loader2, Trash2, Armchair, Layers, Printer as PrinterIcon, UserPlus, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

// ── Shared types ──────────────────────────────────────────────

interface HallRecord {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  tables_count?: number;
}

interface TableRecord {
  id: number;
  hall_id: number;
  table_number: string;
  capacity: number | null;
  shape: 'round' | 'square' | 'rect';
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  status: 'vacant' | 'occupied';
}

interface DepartmentRecord {
  id: number;
  name: string;
  sort_order: number;
  kds_enabled: boolean;
}

interface PrinterRecord {
  id: number;
  name: string;
  department_id: number | null;
  connection_type: 'wifi' | 'bluetooth';
  address: string;
  is_primary: boolean;
  department?: { id: number; name: string } | null;
}

interface BranchOption {
  id: number;
  name: string;
}

interface StaffAccount {
  id: number;
  name: string;
  email: string;
  branch_id: number | null;
  employee_id: number | null;
  role: string | null;
  is_active: boolean;
}

interface EmployeeOption {
  id: number;
  name: string;
}

interface StaffCardRecord {
  id: number;
  user_id: number;
  card_identifier: string;
  is_active: boolean;
}

type Tab = 'halls' | 'departments' | 'printers' | 'staff';

const TABS: { key: Tab; labelKey: string; icon: typeof Armchair }[] = [
  { key: 'halls', labelKey: 'restaurantSetup.tabs.hallsAndTables', icon: Armchair },
  { key: 'departments', labelKey: 'restaurantSetup.tabs.departments', icon: Layers },
  { key: 'printers', labelKey: 'restaurantSetup.tabs.printers', icon: PrinterIcon },
  { key: 'staff', labelKey: 'restaurantSetup.tabs.staffAccounts', icon: UserPlus },
];

// ── Halls & Tables ───────────────────────────────────────────

function DraggableTable({ table, onOpenDelete }: { table: TableRecord; onOpenDelete: (t: TableRecord) => void }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `table-${table.id}` });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: table.pos_x,
    top: table.pos_y,
    width: table.width,
    height: table.height,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 10 : 1,
  };

  const isOccupied = table.status === 'occupied';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border-4 flex flex-col items-center justify-center text-xs font-bold cursor-grab active:cursor-grabbing select-none shadow-sm ${
        table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
      } ${isOccupied ? 'border-red-500 bg-red-50 text-red-700' : 'border-green-500 bg-green-50 text-green-700'}`}
      {...listeners}
      {...attributes}
    >
      <span>{table.table_number}</span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onOpenDelete(table)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 mt-0.5"
        aria-label={t('restaurantSetup.deleteTable')}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function HallsTab() {
  const { t } = useTranslation();
  const [halls, setHalls] = useState<HallRecord[]>([]);
  const [activeHallId, setActiveHallId] = useState<number | null>(null);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hallName, setHallName] = useState('');
  const [addingHall, setAddingHall] = useState(false);
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '', shape: 'square' as TableRecord['shape'] });
  const [addingTable, setAddingTable] = useState(false);
  const [error, setError] = useState('');

  const fetchHalls = async () => {
    const res = await api.get<HallRecord[]>('/halls');
    setHalls(res.data);
    if (!activeHallId && res.data.length) setActiveHallId(res.data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchHalls(); }, []);

  const fetchTables = async (hallId: number) => {
    const res = await api.get<TableRecord[]>('/tables', { params: { hall_id: hallId } });
    setTables(res.data);
  };

  useEffect(() => {
    if (activeHallId) fetchTables(activeHallId);
  }, [activeHallId]);

  const handleAddHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hallName.trim()) return;
    setAddingHall(true);
    try {
      const res = await api.post<HallRecord>('/halls', { name: hallName.trim() });
      setHallName('');
      await fetchHalls();
      setActiveHallId(res.data.id);
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.halls.createHallFailed'));
    } finally {
      setAddingHall(false);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHallId || !tableForm.table_number.trim()) return;
    setAddingTable(true);
    setError('');
    try {
      await api.post('/tables', {
        hall_id: activeHallId,
        table_number: tableForm.table_number.trim(),
        capacity: tableForm.capacity ? Number(tableForm.capacity) : undefined,
        shape: tableForm.shape,
        pos_x: 20, pos_y: 20,
      });
      setTableForm({ table_number: '', capacity: '', shape: 'square' });
      await fetchTables(activeHallId);
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.halls.createTableFailed'));
    } finally {
      setAddingTable(false);
    }
  };

  const handleDeleteTable = async (table: TableRecord) => {
    if (!confirm(t('restaurantSetup.halls.deleteTableConfirm', { number: table.table_number }))) return;
    try {
      await api.delete(`/tables/${table.id}`);
      setTables((prev) => prev.filter((tb) => tb.id !== table.id));
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.halls.deleteTableFailed'));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const tableId = Number(String(active.id).replace('table-', ''));
    const table = tables.find((t) => t.id === tableId);
    if (!table || (delta.x === 0 && delta.y === 0)) return;

    const pos_x = Math.max(0, Math.round(table.pos_x + delta.x));
    const pos_y = Math.max(0, Math.round(table.pos_y + delta.y));

    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, pos_x, pos_y } : t)));
    api.put(`/tables/${tableId}`, { pos_x, pos_y }).catch(() => setError(t('restaurantSetup.halls.savePositionFailed')));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('restaurantSetup.halls.halls')}</h3>
          <div className="space-y-1">
            {halls.map((h) => (
              <button
                key={h.id}
                onClick={() => setActiveHallId(h.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  activeHallId === h.id ? 'bg-red-50 text-[#ff4757] font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {h.name} <span className="text-xs text-gray-400">({h.tables_count ?? 0})</span>
              </button>
            ))}
            {halls.length === 0 && <p className="text-xs text-gray-400">{t('restaurantSetup.halls.noHallsYet')}</p>}
          </div>
          <form onSubmit={handleAddHall} className="flex gap-1 mt-3">
            <input
              type="text" placeholder={t('restaurantSetup.halls.newHallNamePlaceholder')} className="input flex-1 text-sm"
              value={hallName} onChange={(e) => setHallName(e.target.value)}
            />
            <button type="submit" disabled={addingHall} className="btn btn-primary px-2.5">
              {addingHall ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </form>
        </div>

        {activeHallId && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('restaurantSetup.halls.addTable')}</h3>
            <form onSubmit={handleAddTable} className="space-y-2">
              <input
                type="text" required placeholder={t('restaurantSetup.halls.tableNumberPlaceholder')} className="input w-full text-sm"
                value={tableForm.table_number}
                onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
              />
              <input
                type="number" min={1} placeholder={t('restaurantSetup.halls.capacityPlaceholder')} className="input w-full text-sm"
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
              />
              <select
                className="input w-full text-sm bg-white"
                value={tableForm.shape}
                onChange={(e) => setTableForm({ ...tableForm, shape: e.target.value as TableRecord['shape'] })}
              >
                <option value="square">{t('restaurantSetup.halls.square')}</option>
                <option value="round">{t('restaurantSetup.halls.round')}</option>
                <option value="rect">{t('restaurantSetup.halls.rectangle')}</option>
              </select>
              <button type="submit" disabled={addingTable} className="btn btn-primary w-full text-sm flex items-center justify-center gap-2">
                {addingTable ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t('restaurantSetup.halls.addTable')}
              </button>
            </form>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div className="lg:col-span-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-3">{t('restaurantSetup.halls.dragHint')}</p>
          {activeHallId ? (
            <DndContext onDragEnd={handleDragEnd}>
              <div className="relative w-full h-[520px] bg-gray-50 border border-dashed border-gray-300 rounded-xl overflow-hidden">
                {tables.map((tbl) => (
                  <DraggableTable key={tbl.id} table={tbl} onOpenDelete={handleDeleteTable} />
                ))}
                {tables.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                    {t('restaurantSetup.halls.noTablesAddOne')}
                  </p>
                )}
              </div>
            </DndContext>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">{t('restaurantSetup.halls.createHallToStart')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Departments ──────────────────────────────────────────────

function DepartmentsTab() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDepartments = async () => {
    const res = await api.get<DepartmentRecord[]>('/departments');
    setDepartments(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchDepartments(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/departments', { name: name.trim() });
      setName('');
      await fetchDepartments();
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.departments.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (department: DepartmentRecord) => {
    if (!confirm(t('restaurantSetup.departments.deleteConfirm', { name: department.name }))) return;
    await api.delete(`/departments/${department.id}`);
    setDepartments((prev) => prev.filter((d) => d.id !== department.id));
  };

  const handleToggleKds = async (department: DepartmentRecord) => {
    await api.put(`/departments/${department.id}`, { kds_enabled: !department.kds_enabled });
    setDepartments((prev) => prev.map((d) => (d.id === department.id ? { ...d, kds_enabled: !d.kds_enabled } : d)));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-800">{d.name}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#ff4757]"
                  checked={d.kds_enabled}
                  onChange={() => handleToggleKds(d)}
                />
                {t('restaurantSetup.departments.kitchenScreen')}
              </label>
              <button onClick={() => handleDelete(d)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {departments.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">{t('restaurantSetup.departments.noDepartmentsYet')}</p>}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input type="text" placeholder={t('restaurantSetup.departments.namePlaceholder')} className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={saving} className="btn btn-primary px-4 flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {t('restaurantSetup.departments.add')}
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Printers ─────────────────────────────────────────────────

function PrintersTab() {
  const { t } = useTranslation();
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', department_id: '', connection_type: 'wifi' as 'wifi' | 'bluetooth', address: '', is_primary: false });

  const fetchAll = async () => {
    const [printersRes, deptRes] = await Promise.all([api.get<PrinterRecord[]>('/printers'), api.get<DepartmentRecord[]>('/departments')]);
    setPrinters(printersRes.data);
    setDepartments(deptRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/printers', {
        name: form.name.trim(),
        department_id: form.department_id || undefined,
        connection_type: form.connection_type,
        address: form.address.trim(),
        is_primary: form.is_primary,
      });
      setForm({ name: '', department_id: '', connection_type: 'wifi', address: '', is_primary: false });
      setModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.printers.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (printer: PrinterRecord) => {
    if (!confirm(t('restaurantSetup.printers.deleteConfirm', { name: printer.name }))) return;
    await api.delete(`/printers/${printer.id}`);
    setPrinters((prev) => prev.filter((p) => p.id !== printer.id));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {printers.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {p.name} {p.is_primary && <span className="text-xs text-amber-600 font-normal">· {t('restaurantSetup.printers.primary')}</span>}
              </p>
              <p className="text-xs text-gray-400">{p.department?.name ?? t('restaurantSetup.printers.unassigned')} · {p.connection_type} · {p.address}</p>
            </div>
            <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-500">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {printers.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">{t('restaurantSetup.printers.noPrintersYet')}</p>}
      </div>
      <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
        <Plus size={16} /> {t('restaurantSetup.printers.addPrinter')}
      </button>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('restaurantSetup.printers.addPrinter')}>
        <form onSubmit={handleAdd} className="space-y-3">
          <input type="text" required placeholder={t('restaurantSetup.printers.namePlaceholder')} className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input w-full bg-white" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">{t('restaurantSetup.printers.noDepartment')}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input w-full bg-white" value={form.connection_type} onChange={(e) => setForm({ ...form, connection_type: e.target.value as 'wifi' | 'bluetooth' })}>
            <option value="wifi">{t('restaurantSetup.printers.wifi')}</option>
            <option value="bluetooth">{t('restaurantSetup.printers.bluetooth')}</option>
          </select>
          <input
            type="text" required
            placeholder={form.connection_type === 'wifi' ? t('restaurantSetup.printers.ipAddressPlaceholder') : t('restaurantSetup.printers.bluetoothAddressPlaceholder')}
            className="input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} className="rounded border-gray-300" />
            {t('restaurantSetup.printers.usePrimary')}
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t('menu.save')}
          </button>
        </form>
      </Modal>
    </div>
  );
}

// ── Staff accounts ───────────────────────────────────────────

const ASSIGNABLE_ROLES = ['manager', 'staff', 'waiter', 'bartender', 'kitchen_display'];
const roleLabel = (role: string) => role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function StaffAccountsTab() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [cards, setCards] = useState<StaffCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', role: 'waiter', branch_id: '' });

  const [cardAccount, setCardAccount] = useState<StaffAccount | null>(null);
  const [cardForm, setCardForm] = useState({ card_identifier: '', access_code: '' });
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState('');

  const fetchAll = async () => {
    const [accountsRes, branchesRes, employeesRes, cardsRes] = await Promise.all([
      api.get<StaffAccount[]>('/staff-accounts'),
      api.get<BranchOption[]>('/branches'),
      api.get<EmployeeOption[]>('/employees').catch(() => ({ data: [] })),
      api.get<StaffCardRecord[]>('/staff-cards').catch(() => ({ data: [] })),
    ]);
    setAccounts(accountsRes.data);
    setBranches(branchesRes.data);
    setEmployees(employeesRes.data);
    setCards(cardsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/staff-accounts', { ...form, branch_id: form.branch_id || undefined });
      setForm({ name: '', email: '', password: '', password_confirmation: '', role: 'waiter', branch_id: '' });
      setModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || t('restaurantSetup.staff.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleLinkEmployee = async (account: StaffAccount, employeeId: string) => {
    await api.put(`/staff-accounts/${account.id}`, { employee_id: employeeId || null });
    await fetchAll();
  };

  const openCardModal = (account: StaffAccount) => {
    setCardAccount(account);
    setCardError('');
    const existing = cards.find((c) => c.user_id === account.id);
    setCardForm({ card_identifier: existing?.card_identifier ?? '', access_code: '' });
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardAccount) return;
    setCardSaving(true);
    setCardError('');
    try {
      const existing = cards.find((c) => c.user_id === cardAccount.id);
      if (existing) {
        const payload: Record<string, string> = { card_identifier: cardForm.card_identifier };
        if (cardForm.access_code) payload.access_code = cardForm.access_code;
        await api.put(`/staff-cards/${existing.id}`, payload);
      } else {
        await api.post('/staff-cards', { user_id: cardAccount.id, ...cardForm });
      }
      setCardAccount(null);
      await fetchAll();
    } catch (err: any) {
      setCardError(err.response?.data?.message || t('restaurantSetup.staff.saveCardFailed'));
    } finally {
      setCardSaving(false);
    }
  };

  const handleDeleteCard = async () => {
    const existing = cardAccount && cards.find((c) => c.user_id === cardAccount.id);
    if (!existing || !confirm(t('restaurantSetup.staff.removeCardConfirm'))) return;
    await api.delete(`/staff-cards/${existing.id}`);
    setCardAccount(null);
    await fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {accounts.map((a) => {
          const hasCard = cards.some((c) => c.user_id === a.id);
          return (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                <p className="text-xs text-gray-400 truncate">{a.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="input text-xs py-1 bg-white w-36"
                  value={a.employee_id ?? ''}
                  onChange={(e) => handleLinkEmployee(a, e.target.value)}
                  title={t('restaurantSetup.staff.linkEmployeeTitle')}
                >
                  <option value="">{t('restaurantSetup.staff.noEmployeeLink')}</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <button
                  onClick={() => openCardModal(a)}
                  className={`p-1.5 rounded-lg ${hasCard ? 'text-[#ff4757] bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={hasCard ? t('restaurantSetup.staff.editCard') : t('restaurantSetup.staff.registerCard')}
                >
                  <CreditCard size={16} />
                </button>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">{a.role ? t(`restaurantSetup.roles.${a.role}`, { defaultValue: roleLabel(a.role) }) : '—'}</span>
              </div>
            </div>
          );
        })}
        {accounts.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">{t('restaurantSetup.staff.noAccountsYet')}</p>}
      </div>
      <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
        <Plus size={16} /> {t('restaurantSetup.staff.addAccount')}
      </button>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('restaurantSetup.staff.addAccount')}>
        <form onSubmit={handleAdd} className="space-y-3">
          <input type="text" required placeholder={t('restaurantSetup.staff.fullNamePlaceholder')} className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="email" required placeholder={t('restaurantSetup.staff.emailPlaceholder')} className="input w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input type="password" required placeholder={t('login.password')} className="input w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input type="password" required placeholder={t('settings.confirmNewPassword')} className="input w-full" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} />
          <select className="input w-full bg-white" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{t(`restaurantSetup.roles.${r}`, { defaultValue: roleLabel(r) })}</option>)}
          </select>
          <select className="input w-full bg-white" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
            <option value="">{t('restaurantSetup.staff.noSpecificBranch')}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t('restaurantSetup.staff.createAccount')}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!cardAccount} onClose={() => setCardAccount(null)} title={t('restaurantSetup.staff.staffCardTitle', { name: cardAccount?.name ?? '' })}>
        <form onSubmit={handleSaveCard} className="space-y-3">
          <p className="text-xs text-gray-400">
            {t('restaurantSetup.staff.cardExplain')}
          </p>
          <input
            type="text" required placeholder={t('restaurantSetup.staff.cardIdentifierPlaceholder')} className="input w-full"
            value={cardForm.card_identifier} onChange={(e) => setCardForm({ ...cardForm, card_identifier: e.target.value })}
          />
          <input
            type="text" placeholder={cards.some((c) => c.user_id === cardAccount?.id) ? t('restaurantSetup.staff.newAccessCodePlaceholder') : t('restaurantSetup.staff.accessCodePlaceholder')}
            required={!cards.some((c) => c.user_id === cardAccount?.id)}
            className="input w-full"
            value={cardForm.access_code} onChange={(e) => setCardForm({ ...cardForm, access_code: e.target.value })}
          />
          {cardError && <p className="text-xs text-red-500">{cardError}</p>}
          <button type="submit" disabled={cardSaving} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {cardSaving ? <Loader2 size={16} className="animate-spin" /> : t('restaurantSetup.staff.saveCard')}
          </button>
          {cards.some((c) => c.user_id === cardAccount?.id) && (
            <button type="button" onClick={handleDeleteCard} className="btn w-full text-sm text-red-600 hover:bg-red-50 flex items-center justify-center gap-2">
              <Trash2 size={14} /> {t('restaurantSetup.staff.removeCard')}
            </button>
          )}
        </form>
      </Modal>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function RestaurantSetupPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('halls');

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.restaurantSetup')}</h1>
        <p className="text-gray-500 mt-1">{t('restaurantSetup.pageSubtitle')}</p>
      </div>

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

      {activeTab === 'halls' && <HallsTab />}
      {activeTab === 'departments' && <DepartmentsTab />}
      {activeTab === 'printers' && <PrintersTab />}
      {activeTab === 'staff' && <StaffAccountsTab />}
    </div>
  );
}
