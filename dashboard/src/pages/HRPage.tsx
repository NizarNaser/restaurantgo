import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Plus, Search, Edit, Trash2, Users, LogIn, LogOut, Clock,
  Banknote, CheckCircle2, Download, Eye, Loader2, PlayCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

// ── Shared types ──────────────────────────────────────────────

interface Employee {
  id: number;
  name: string;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  position: string;
  base_salary: number | string;
  currency: string;
  hire_date: string;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
}

interface StaffAccount {
  id: number;
  name: string;
  email: string;
  employee_id: number | null;
  role: string | null;
}

// Mirrors StaffAccountController::ASSIGNABLE_ROLES — owner is created once
// at signup and is never assignable through a staff account.
const ASSIGNABLE_ROLES = ['manager', 'staff', 'waiter', 'bartender', 'kitchen_display'];
const roleLabel = (role: string) => role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

interface AttendanceRecord {
  id: number;
  employee_id: number;
  check_in: string;
  check_out: string | null;
  type: string;
  notes: string | null;
  employee?: { id: number; name: string };
}

interface PayrollItem {
  id: number;
  employee_id: number;
  employee_name: string;
  position: string;
  hours_worked: number;
  base_salary: number;
  overtime_pay: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
}

interface PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  currency: string;
  status: 'draft' | 'approved' | 'paid';
  total_net: number;
  employee_count: number;
  items: PayrollItem[];
  created_at: string;
}

type Tab = 'employees' | 'attendance' | 'payroll';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'employees', labelKey: 'hr.tabs.employees' },
  { key: 'attendance', labelKey: 'hr.tabs.attendance' },
  { key: 'payroll', labelKey: 'hr.tabs.payroll' },
];

const todayIso = () => new Date().toISOString().split('T')[0];

export default function HRPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    } finally {
      setEmployeesLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('hr.title')}</h1>
        <p className="text-gray-500 mt-1">{t('hr.subtitle')}</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'text-[#ff4757] border-b-2 border-[#ff4757]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && (
        <EmployeesTab
          employees={employees}
          loading={employeesLoading}
          onChanged={fetchEmployees}
        />
      )}
      {activeTab === 'attendance' && <AttendanceTab employees={employees} />}
      {activeTab === 'payroll' && <PayrollTab />}
    </div>
  );
}

// ── Employees ─────────────────────────────────────────────────

function EmployeesTab({
  employees,
  loading,
  onChanged,
}: {
  employees: Employee[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    national_id: '',
    phone: '',
    email: '',
    position: '',
    base_salary: '',
    currency: 'USD',
    hire_date: todayIso(),
    status: 'active' as Employee['status'],
  });

  // The employee's dashboard login (User + role), linked via employee_id —
  // a separate account from the HR record above (see StaffAccountController).
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [accountForm, setAccountForm] = useState({
    wantsAccount: false,
    email: '',
    role: 'waiter',
    password: '',
    password_confirmation: '',
  });

  useEffect(() => {
    api.get<StaffAccount[]>('/staff-accounts').then((res) => setStaffAccounts(res.data)).catch(() => {});
  }, []);

  const linkedAccount = editingEmployee
    ? staffAccounts.find((a) => a.employee_id === editingEmployee.id) ?? null
    : null;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Individual setters, not a shared name-keyed handler like handleInputChange
  // above — this section's "email" would otherwise collide with the
  // employee record's own "email" input sharing the same <form>.
  const setAccountField = <K extends keyof typeof accountForm>(key: K, value: (typeof accountForm)[K]) => {
    setAccountForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAccountForm = (existing: StaffAccount | null) => {
    setAccountForm({
      wantsAccount: !!existing,
      email: existing?.email ?? '',
      role: existing?.role ?? 'waiter',
      password: '',
      password_confirmation: '',
    });
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      name: '', national_id: '', phone: '', email: '', position: '',
      base_salary: '', currency: 'USD', hire_date: todayIso(), status: 'active',
    });
    setAccountError('');
    resetAccountForm(null);
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      national_id: emp.national_id || '',
      phone: emp.phone || '',
      email: emp.email || '',
      position: emp.position,
      base_salary: String(emp.base_salary),
      currency: emp.currency,
      hire_date: emp.hire_date,
      status: emp.status,
    });
    setAccountError('');
    resetAccountForm(staffAccounts.find((a) => a.employee_id === emp.id) ?? null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAccountError('');
    try {
      const payload = { ...formData, base_salary: parseFloat(formData.base_salary) };
      let employeeId = editingEmployee?.id;
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload);
      } else {
        const res = await api.post('/employees', payload);
        employeeId = res.data.id;
        // If the account step below fails, keep the modal open in "edit"
        // mode (not "add") so retrying updates this employee instead of
        // creating a second one.
        setEditingEmployee(res.data);
      }

      if (accountForm.wantsAccount) {
        try {
          if (linkedAccount) {
            const updatePayload: Record<string, string> = {};
            if (accountForm.role !== linkedAccount.role) updatePayload.role = accountForm.role;
            if (accountForm.password) {
              updatePayload.password = accountForm.password;
              updatePayload.password_confirmation = accountForm.password_confirmation;
            }
            if (Object.keys(updatePayload).length > 0) {
              await api.put(`/staff-accounts/${linkedAccount.id}`, updatePayload);
            }
          } else {
            const res = await api.post('/staff-accounts', {
              name: formData.name,
              email: accountForm.email,
              password: accountForm.password,
              password_confirmation: accountForm.password_confirmation,
              role: accountForm.role,
            });
            await api.put(`/staff-accounts/${res.data.id}`, { employee_id: employeeId });
          }
          const refreshed = await api.get<StaffAccount[]>('/staff-accounts');
          setStaffAccounts(refreshed.data);
        } catch (accountErr: any) {
          setAccountError(accountErr.response?.data?.message || t('hr.account.saveFailed'));
          return;
        }
      }

      setModalOpen(false);
      onChanged();
    } catch (error: any) {
      alert(error.response?.data?.message || t('hr.saveEmployeeFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('hr.deleteEmployeeConfirm'))) return;
    try {
      await api.delete(`/employees/${id}`);
      onChanged();
    } catch (error) {
      console.error('Failed to delete employee', error);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.position.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end mb-4">
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus size={18} className="mr-2" /> {t('hr.addEmployee')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t('hr.searchPlaceholder')}
              className="input w-full pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">{t('hr.employee')}</th>
                <th className="px-6 py-4">{t('hr.contact')}</th>
                <th className="px-6 py-4">{t('hr.position')}</th>
                <th className="px-6 py-4">{t('hr.salary')}</th>
                <th className="px-6 py-4">{t('orders.statusLabel')}</th>
                <th className="px-6 py-4 text-right">{t('orders.actionsLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-900">{t('hr.noEmployeesFound')}</p>
                    <p className="mt-1">{t('hr.getStartedAddingStaff')}</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t('hr.hired')}: {emp.hire_date}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{emp.phone || '-'}</div>
                      <div className="text-gray-500 text-xs">{emp.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {emp.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {parseFloat(String(emp.base_salary)).toFixed(2)} {emp.currency}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.status === 'active' ? 'bg-green-100 text-green-800' :
                        emp.status === 'on_leave' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`hr.status.${emp.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEmployee ? t('hr.editEmployee') : t('hr.addNewEmployee')}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.fullName')}</label>
              <input type="text" name="name" required className="input w-full" value={formData.name} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.position')}</label>
              <input type="text" name="position" required className="input w-full" value={formData.position} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.phone')}</label>
              <input type="text" name="phone" className="input w-full" value={formData.phone} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.email')}</label>
              <input type="email" name="email" className="input w-full" value={formData.email} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.baseSalary')}</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" name="base_salary" required className="input w-full" value={formData.base_salary} onChange={handleInputChange} />
                <select name="currency" className="input w-24 bg-white" value={formData.currency} onChange={handleInputChange}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('orders.statusLabel')}</label>
              <select name="status" className="input w-full bg-white" value={formData.status} onChange={handleInputChange}>
                <option value="active">{t('hr.status.active')}</option>
                <option value="on_leave">{t('hr.status.on_leave')}</option>
                <option value="inactive">{t('hr.status.inactive')}</option>
                <option value="terminated">{t('hr.status.terminated')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.hireDate')}</label>
              <input type="date" name="hire_date" required className="input w-full" value={formData.hire_date} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.nationalId')}</label>
              <input type="text" name="national_id" className="input w-full" value={formData.national_id} onChange={handleInputChange} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            {linkedAccount ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-800">{t('hr.account.title')}</p>
                <p className="text-xs text-gray-400">{t('hr.account.linkedEmail', { email: linkedAccount.email })}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.account.role')}</label>
                    <select className="input w-full bg-white" value={accountForm.role} onChange={(e) => setAccountField('role', e.target.value)}>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{t(`restaurantSetup.roles.${r}`, { defaultValue: roleLabel(r) })}</option>
                      ))}
                    </select>
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.account.newPassword')}</label>
                    <input type="password" className="input w-full" value={accountForm.password} onChange={(e) => setAccountField('password', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.confirmNewPassword')}</label>
                    <input
                      type="password" className="input w-full"
                      value={accountForm.password_confirmation} onChange={(e) => setAccountField('password_confirmation', e.target.value)}
                      required={!!accountForm.password}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" checked={accountForm.wantsAccount} onChange={(e) => setAccountField('wantsAccount', e.target.checked)} />
                  {t('hr.account.createToggle')}
                </label>
                {accountForm.wantsAccount && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.email')}</label>
                      <input type="email" required className="input w-full" value={accountForm.email} onChange={(e) => setAccountField('email', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.account.role')}</label>
                      <select className="input w-full bg-white" value={accountForm.role} onChange={(e) => setAccountField('role', e.target.value)}>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{t(`restaurantSetup.roles.${r}`, { defaultValue: roleLabel(r) })}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.password')}</label>
                      <input type="password" required className="input w-full" value={accountForm.password} onChange={(e) => setAccountField('password', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.confirmNewPassword')}</label>
                      <input type="password" required className="input w-full" value={accountForm.password_confirmation} onChange={(e) => setAccountField('password_confirmation', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {accountError && <p className="text-xs text-red-500 mt-2">{accountError}</p>}
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">
              {t('menu.cancel')}
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? t('hr.saving') : t('hr.saveEmployee')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Attendance ────────────────────────────────────────────────

function AttendanceTab({ employees }: { employees: Employee[] }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance', { params: { per_page: 30 } });
      setRecords(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch attendance', error);
    } finally {
      setLoading(false);
    }
  };

  const employeeName = (id: number) =>
    employees.find((e) => e.id === id)?.name ?? t('hr.employeeNumber', { id });

  const openRecord = (employeeId: number) =>
    records.find((r) => r.employee_id === employeeId && !r.check_out);

  const handleCheckIn = async () => {
    if (!selectedEmployee) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.post('/attendance/checkin', { employee_id: Number(selectedEmployee) });
      setNotice(t('hr.checkedIn'));
      fetchRecords();
    } catch (error: any) {
      setNotice(error.response?.data?.message || t('hr.checkInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedEmployee) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.post('/attendance/checkout', { employee_id: Number(selectedEmployee) });
      setNotice(t('hr.checkedOut', { hours: res.data.hours_worked }));
      fetchRecords();
    } catch (error: any) {
      setNotice(error.response?.data?.message || t('hr.checkOutFailed'));
    } finally {
      setBusy(false);
    }
  };

  const selectedIsCheckedIn = selectedEmployee
    ? Boolean(openRecord(Number(selectedEmployee)))
    : false;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#ff4757]" />
          {t('hr.clockInOut')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="input max-w-xs bg-white"
          >
            <option value="">{t('hr.selectEmployee')}</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} — {emp.position}</option>
            ))}
          </select>
          <button
            onClick={handleCheckIn}
            disabled={!selectedEmployee || busy || selectedIsCheckedIn}
            className="btn btn-primary flex items-center gap-2"
          >
            <LogIn size={16} /> {t('hr.checkIn')}
          </button>
          <button
            onClick={handleCheckOut}
            disabled={!selectedEmployee || busy || !selectedIsCheckedIn}
            className="btn btn-outline flex items-center gap-2"
          >
            <LogOut size={16} /> {t('hr.checkOut')}
          </button>
          {notice && <span className="text-sm text-gray-500">{notice}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{t('hr.recentRecords')}</h2>
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Clock size={40} className="mx-auto mb-3 text-gray-200" />
            {t('hr.noAttendanceYet')}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">{t('hr.employee')}</th>
                  <th className="px-6 py-3">{t('hr.checkIn')}</th>
                  <th className="px-6 py-3">{t('hr.checkOut')}</th>
                  <th className="px-6 py-3 text-right">{t('hr.hours')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const hours = r.check_out
                    ? ((new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3_600_000).toFixed(2)
                    : null;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {r.employee?.name ?? employeeName(r.employee_id)}
                      </td>
                      <td className="px-6 py-3">{new Date(r.check_in).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        {r.check_out ? (
                          new Date(r.check_out).toLocaleString()
                        ) : (
                          <span className="text-amber-600 font-medium">{t('hr.stillClockedIn')}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">{hours ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Payroll ───────────────────────────────────────────────────

const PAYROLL_STATUS_STYLES: Record<PayrollRun['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
};

function PayrollTab() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [period, setPeriod] = useState({ period_start: '', period_end: '' });
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [viewingRun, setViewingRun] = useState<PayrollRun | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payroll', { params: { per_page: 30 } });
      setRuns(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch payroll runs', error);
    } finally {
      setLoading(false);
    }
  };

  const openRunModal = () => {
    setPeriod({ period_start: '', period_end: '' });
    setRunError(null);
    setRunModalOpen(true);
  };

  const handleRunPayroll = async (e: FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setRunError(null);
    try {
      await api.post('/payroll/run', period);
      setRunModalOpen(false);
      fetchRuns();
    } catch (error: any) {
      setRunError(error.response?.data?.message || t('hr.generatePayrollFailed'));
    } finally {
      setRunning(false);
    }
  };

  const approveRun = async (run: PayrollRun) => {
    setActionBusyId(run.id);
    try {
      await api.post(`/payroll/${run.id}/approve`);
      fetchRuns();
    } catch (error: any) {
      alert(error.response?.data?.message || t('hr.approvePayrollFailed'));
    } finally {
      setActionBusyId(null);
    }
  };

  const markPaid = async (run: PayrollRun) => {
    if (!confirm(t('hr.markPaidConfirm'))) return;
    setActionBusyId(run.id);
    try {
      await api.post(`/payroll/${run.id}/pay`);
      fetchRuns();
    } catch (error: any) {
      alert(error.response?.data?.message || t('hr.markPaidFailed'));
    } finally {
      setActionBusyId(null);
    }
  };

  const downloadPdf = async (run: PayrollRun) => {
    try {
      const res = await api.get(`/payroll/${run.id}/export/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-${run.period_start}-${run.period_end}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert(t('hr.downloadPdfFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openRunModal} className="btn btn-primary flex items-center gap-2">
          <PlayCircle size={18} /> {t('hr.runPayroll')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Banknote size={40} className="mx-auto mb-3 text-gray-200" />
            {t('hr.noPayrollRunsYet')}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">{t('hr.period')}</th>
                  <th className="px-6 py-3">{t('orders.statusLabel')}</th>
                  <th className="px-6 py-3 text-right">{t('hr.employees')}</th>
                  <th className="px-6 py-3 text-right">{t('hr.totalNet')}</th>
                  <th className="px-6 py-3 text-right">{t('orders.actionsLabel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {run.period_start} → {run.period_end}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${PAYROLL_STATUS_STYLES[run.status]}`}>
                        {t(`hr.payrollStatus.${run.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">{run.employee_count}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">
                      {run.total_net.toFixed(2)} {run.currency}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          onClick={() => setViewingRun(run)}
                          title={t('hr.viewDetails')}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Eye size={16} />
                        </button>
                        {run.status === 'draft' && (
                          <button
                            onClick={() => approveRun(run)}
                            disabled={actionBusyId === run.id}
                            title={t('hr.approve')}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {run.status === 'approved' && (
                          <button
                            onClick={() => markPaid(run)}
                            disabled={actionBusyId === run.id}
                            title={t('hr.markAsPaid')}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          >
                            <Banknote size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => downloadPdf(run)}
                          title={t('hr.downloadPdf')}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run payroll modal */}
      <Modal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} title={t('hr.runPayroll')}>
        <form onSubmit={handleRunPayroll} className="space-y-4">
          {runError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{runError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.periodStart')}</label>
            <input
              type="date"
              required
              className="input w-full"
              value={period.period_start}
              onChange={(e) => setPeriod((p) => ({ ...p, period_start: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('hr.periodEnd')}</label>
            <input
              type="date"
              required
              className="input w-full"
              value={period.period_end}
              onChange={(e) => setPeriod((p) => ({ ...p, period_end: e.target.value }))}
            />
          </div>
          <p className="text-xs text-gray-400">
            {t('hr.runPayrollDesc')}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setRunModalOpen(false)} className="btn btn-outline">{t('menu.cancel')}</button>
            <button type="submit" disabled={running} className="btn btn-primary flex items-center gap-2">
              {running && <Loader2 size={16} className="animate-spin" />}
              {t('hr.generate')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View run modal */}
      <Modal
        isOpen={viewingRun !== null}
        onClose={() => setViewingRun(null)}
        title={viewingRun ? t('hr.payrollPeriodTitle', { start: viewingRun.period_start, end: viewingRun.period_end }) : ''}
        size="xl"
      >
        {viewingRun && (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2">{t('hr.employee')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.hours')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.base')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.overtime')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.bonuses')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.deductions')}</th>
                  <th className="px-4 py-2 text-right">{t('hr.net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viewingRun.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{item.employee_name}</div>
                      <div className="text-xs text-gray-400">{item.position}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{item.hours_worked.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right">{item.base_salary.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{item.overtime_pay.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{item.bonuses.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{item.deductions.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{item.net_salary.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 font-bold text-gray-900">
                  <td className="px-4 py-2" colSpan={6}>{t('hr.totalEmployees', { count: viewingRun.items.length })}</td>
                  <td className="px-4 py-2 text-right">
                    {viewingRun.total_net.toFixed(2)} {viewingRun.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
