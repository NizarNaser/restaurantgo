import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Loader2, X, ArrowLeft, Lock, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import PosPrinter from '../plugins/posPrinter';
import { buildDepartmentTicket, buildFullBillTicket, bytesToBase64 } from '../lib/escpos';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/Modal';
import ApprovalModal from '../components/ApprovalModal';
import SectionsBar from '../components/SectionsBar';
import CategoriesList from '../components/CategoriesList';
import ProductsGrid from '../components/ProductsGrid';
import InvoicePanel from '../components/InvoicePanel';
import type {
  OrderRecord, DiscountCardRecord, DiscountApplicationRecord, InvoiceRecord,
  DepartmentRecord, CategoryRecord, MenuItemOption, PrinterRecord, CartLine, CurrentShiftRecord,
} from '../types/pos';

const NO_DEPARTMENT_KEY = 'none';

interface FloorTableSummary {
  id: number;
  hall_id: number;
  table_number: string;
  status: 'vacant' | 'occupied';
}

export default function TableOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { tableNumber?: string; hallName?: string | null; isVacant?: boolean } };
  const params = useParams<{ tableId: string }>();
  const tableId = Number(params.tableId);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const username = useAuthStore((s) => s.user?.name);

  const [tableNumber, setTableNumber] = useState(location.state?.tableNumber ?? '');
  const [hallName, setHallName] = useState<string | null | undefined>(location.state?.hallName);
  const [isVacant, setIsVacant] = useState<boolean>(location.state?.isVacant ?? false);

  // A hard refresh (or a direct link) lands here with no router state — go
  // fetch the table's own basics once instead of assuming they're vacant.
  useEffect(() => {
    if (location.state) return;
    Promise.all([api.get<FloorTableSummary[]>('/floor/tables'), api.get<{ id: number; name: string }[]>('/floor/halls')])
      .then(([tablesRes, hallsRes]) => {
        const match = tablesRes.data.find((tbl) => tbl.id === tableId);
        if (!match) return;
        setTableNumber(match.table_number);
        setIsVacant(match.status === 'vacant');
        setHallName(hallsRes.data.find((h) => h.id === match.hall_id)?.name ?? null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const [shift, setShift] = useState<CurrentShiftRecord | null>(null);
  useEffect(() => {
    api.get<CurrentShiftRecord>('/shifts/current').then((res) => setShift(res.data?.id ? res.data : null)).catch(() => {});
  }, []);

  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [openedBy, setOpenedBy] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');

  const [showTransfer, setShowTransfer] = useState(false);
  const [vacantTables, setVacantTables] = useState<{ id: number; table_number: string }[]>([]);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [showTransferApproval, setShowTransferApproval] = useState(false);

  const [showDiscountLookup, setShowDiscountLookup] = useState(false);
  const [discountCardNumber, setDiscountCardNumber] = useState('');
  const [lookedUpCard, setLookedUpCard] = useState<DiscountCardRecord | null>(null);
  const [discountMode, setDiscountMode] = useState<'deduct' | 'accumulate'>('deduct');
  const [discountError, setDiscountError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [requestingDiscount, setRequestingDiscount] = useState(false);
  const [pendingApplication, setPendingApplication] = useState<DiscountApplicationRecord | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  // Starts blank (not NO_DEPARTMENT_KEY) so the very first section tab —
  // usually a real department, not the "Other" bucket — gets selected once
  // sectionTabs loads, rather than defaulting straight to "Other".
  const [activeDeptKey, setActiveDeptKey] = useState<string>('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [printNotice, setPrintNotice] = useState('');

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [printingBill, setPrintingBill] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showMobileInvoice, setShowMobileInvoice] = useState(false);

  const loadMenuOptions = () => {
    Promise.all([
      api.get<DepartmentRecord[]>('/floor/departments').catch(() => ({ data: [] })),
      api.get('/menu/categories'),
      api.get('/menu/items', { params: { per_page: 200, is_available: 1 } }),
      api.get<PrinterRecord[]>('/floor/printers').catch(() => ({ data: [] })),
    ]).then(([deptRes, catRes, itemsRes, printersRes]) => {
      setDepartments(deptRes.data);
      setCategories(catRes.data.data ?? []);
      setMenuItems(itemsRes.data.data ?? []);
      setPrinters(printersRes.data);
    });
  };

  const loadOrder = () => {
    setLoading(true);
    setLocked(false);
    api.get(`/tables/${tableId}/order`)
      .then((res) => {
        setOrder(res.data.order);
        setCanEdit(res.data.can_edit);
        setOpenedBy(res.data.opened_by);
        loadMenuOptions();
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setLocked(true);
        } else {
          setError(t('tableOrder.loadFailed'));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isVacant) {
      setLoading(false);
    } else {
      loadOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Keeps the invoice panel's subtotal/tax/total live (not just after an
  // explicit "print bill" click) whenever the order's totals actually change.
  useEffect(() => {
    if (order && order.items.length > 0) {
      api.get<InvoiceRecord>(`/orders/${order.id}/invoice`).then((res) => setInvoice(res.data)).catch(() => {});
    } else {
      setInvoice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.total, order?.discount_amount]);

  const handleOpenTable = async () => {
    setOpening(true);
    setError('');
    try {
      const res = await api.post(`/tables/${tableId}/open`);
      setOrder(res.data.order);
      setCanEdit(true);
      setOpenedBy(null);
      setIsVacant(false);
      loadMenuOptions();
    } catch (err: any) {
      setError(err.response?.data?.message || t('tableOrder.openFailed'));
    } finally {
      setOpening(false);
    }
  };

  // Department → categories, with a bucket for categories with no department.
  const sectionTabs = useMemo(() => {
    const tabs = departments.map((d) => ({ key: String(d.id), label: d.name }));
    const hasUnassigned = categories.some((c) => !c.department_id);
    return hasUnassigned ? [...tabs, { key: NO_DEPARTMENT_KEY, label: t('tableOrder.other') }] : tabs;
  }, [departments, categories, t]);

  useEffect(() => {
    if (sectionTabs.length && !sectionTabs.some((tab) => tab.key === activeDeptKey)) {
      setActiveDeptKey(sectionTabs[0].key);
    }
  }, [sectionTabs, activeDeptKey]);

  const categoriesInActiveDept = useMemo(() => {
    return categories.filter((c) => (activeDeptKey === NO_DEPARTMENT_KEY ? !c.department_id : String(c.department_id) === activeDeptKey));
  }, [categories, activeDeptKey]);

  useEffect(() => {
    if (categoriesInActiveDept.length && !categoriesInActiveDept.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(categoriesInActiveDept[0].id);
    } else if (categoriesInActiveDept.length === 0) {
      setActiveCategoryId(null);
    }
  }, [categoriesInActiveDept, activeCategoryId]);

  const isSearching = search.trim().length > 0;

  // Searching looks across the whole open section, not just the selected
  // category — picking a category is a shortcut, not a hard filter.
  const productsToShow = useMemo(() => {
    if (isSearching) {
      const term = search.trim().toLowerCase();
      const categoryIds = new Set(categoriesInActiveDept.map((c) => c.id));
      return menuItems.filter((i) => i.category_id != null && categoryIds.has(i.category_id) && i.name.toLowerCase().includes(term));
    }
    return menuItems.filter((i) => i.category_id === activeCategoryId);
  }, [isSearching, search, categoriesInActiveDept, menuItems, activeCategoryId]);

  const productsTitle = isSearching
    ? t('tableOrder.searchResults')
    : categoriesInActiveDept.find((c) => c.id === activeCategoryId)?.name ?? '';

  const addToCart = (item: MenuItemOption) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.id);
      if (existing) {
        return prev.map((l) => (l.menu_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: parseFloat(String(item.price)), quantity: 1 }];
    });
  };

  const updateCartQuantity = (menuItemId: number, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.menu_item_id !== menuItemId)
        : prev.map((l) => (l.menu_item_id === menuItemId ? { ...l, quantity } : l))
    );
  };

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  /**
   * Sends each department's newly-added lines straight to that department's
   * configured printer — no dialog, no manual printer selection. Only does
   * anything inside the native POS app; in the regular browser dashboard
   * (or when a department has no printer configured yet) it's a no-op.
   */
  const autoPrintDepartmentTickets = async (addedLines: CartLine[]) => {
    if (!Capacitor.isNativePlatform()) return;

    const byDepartment = new Map<number, CartLine[]>();
    for (const cartLine of addedLines) {
      const categoryId = menuItems.find((m) => m.id === cartLine.menu_item_id)?.category_id;
      const departmentId = categoryId != null ? categories.find((c) => c.id === categoryId)?.department_id : null;
      if (!departmentId) continue;
      byDepartment.set(departmentId, [...(byDepartment.get(departmentId) ?? []), cartLine]);
    }

    for (const [departmentId, lines] of byDepartment) {
      const printer = printers.find((p) => p.department_id === departmentId);
      const department = departments.find((d) => d.id === departmentId);
      if (!printer || !department || department.kds_enabled) continue;

      try {
        const bytes = buildDepartmentTicket({
          departmentName: department.name,
          tableNumber,
          hallName,
          items: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
          timestamp: new Date().toISOString(),
        });
        await PosPrinter.print({ connectionType: printer.connection_type, address: printer.address, data: bytesToBase64(bytes) });
      } catch (err: any) {
        setPrintNotice(t('tableOrder.printToDepartmentFailed', { department: department.name, error: err.message ?? t('tableOrder.unknownError') }));
      }
    }
  };

  const handleAddItems = async () => {
    if (!order || cart.length === 0) return;
    setSubmitting(true);
    setError('');
    setPrintNotice('');
    try {
      const res = await api.post(`/orders/${order.id}/items`, {
        items: cart.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
      });
      setOrder(res.data);
      const addedLines = cart;
      setCart([]);
      await autoPrintDepartmentTickets(addedLines);
    } catch (err: any) {
      setError(err.response?.data?.message || t('tableOrder.addItemsFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintBill = async () => {
    if (!order) return;
    setPrintingBill(true);
    setError('');
    setPrintNotice('');
    try {
      const res = await api.get<InvoiceRecord>(`/orders/${order.id}/invoice`);
      setInvoice(res.data);

      const primaryPrinter = printers.find((p) => p.is_primary);
      if (Capacitor.isNativePlatform() && primaryPrinter) {
        try {
          const bytes = buildFullBillTicket({
            tableNumber,
            hallName,
            items: res.data.items.map((i) => ({ name: i.name, weight: i.weight, quantity: i.quantity, subtotal: i.subtotal })),
            subtotal: res.data.order.total,
            taxRate: res.data.order.tax_rate,
            taxAmount: res.data.order.tax_amount,
            serviceChargeRate: res.data.order.service_charge_rate,
            serviceChargeAmount: res.data.order.service_charge_amount,
            grandTotal: res.data.order.grand_total,
            currency: res.data.order.currency,
            openedAt: res.data.order.created_at,
            closedAt: res.data.order.paid_at,
            staffName: res.data.opened_by,
          });
          await PosPrinter.print({ connectionType: primaryPrinter.connection_type, address: primaryPrinter.address, data: bytesToBase64(bytes) });
        } catch (err: any) {
          setPrintNotice(t('tableOrder.printToPrimaryFailed', { error: err.message ?? t('tableOrder.unknownError') }));
        }
      } else {
        setTimeout(() => window.print(), 50);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('tableOrder.loadBillFailed'));
    } finally {
      setPrintingBill(false);
    }
  };

  const handleLookupCard = async () => {
    if (!discountCardNumber.trim()) return;
    setLookingUp(true);
    setDiscountError('');
    setLookedUpCard(null);
    try {
      const res = await api.get<DiscountCardRecord>('/discount-cards/lookup', { params: { card_number: discountCardNumber.trim() } });
      setLookedUpCard(res.data);
    } catch (err: any) {
      setDiscountError(err.response?.data?.message || t('tableOrder.cardNotFound'));
    } finally {
      setLookingUp(false);
    }
  };

  const handleRequestDiscount = async () => {
    if (!order || !lookedUpCard) return;
    setRequestingDiscount(true);
    setDiscountError('');
    try {
      const res = await api.post<DiscountApplicationRecord>(`/orders/${order.id}/discount-requests`, {
        discount_card_id: lookedUpCard.id,
        mode: discountMode,
      });
      setPendingApplication(res.data);
      setShowDiscountLookup(false);
    } catch (err: any) {
      setDiscountError(err.response?.data?.message || t('tableOrder.requestDiscountFailed'));
    } finally {
      setRequestingDiscount(false);
    }
  };

  const handleApproveDiscount = async (credential: { password?: string; access_code?: string }) => {
    if (!pendingApplication) return;
    await api.post(`/discount-requests/${pendingApplication.id}/approve`, credential);
    setShowApprovalModal(false);
    setPendingApplication(null);
    setLookedUpCard(null);
    loadOrder();
  };

  const handleRejectDiscount = async () => {
    if (!pendingApplication) return;
    await api.post(`/discount-requests/${pendingApplication.id}/reject`);
    setPendingApplication(null);
  };

  const openTransferModal = async () => {
    setShowTransfer(true);
    setTransferTargetId('');
    const res = await api.get('/floor/tables');
    setVacantTables(
      (res.data as { id: number; table_number: string; status: string }[])
        .filter((tbl) => tbl.status === 'vacant' && tbl.id !== tableId)
        .map((tbl) => ({ id: tbl.id, table_number: tbl.table_number }))
    );
  };

  const handleConfirmTransferTarget = () => {
    if (!transferTargetId) return;
    setShowTransfer(false);
    setShowTransferApproval(true);
  };

  const handleApproveTransfer = async (credential: { password?: string; access_code?: string }) => {
    await api.post(`/tables/${tableId}/transfer`, { to_table_id: Number(transferTargetId), ...credential });
    setShowTransferApproval(false);
    navigate('/halls');
  };

  const handleCloseTable = async () => {
    const message = order && order.items.length > 0
      ? t('tableOrder.closeConfirm')
      : t('tableOrder.releaseConfirm');
    if (!confirm(message)) return;
    setClosing(true);
    setError('');
    try {
      await api.post(`/tables/${tableId}/close`);
      navigate('/halls');
    } catch (err: any) {
      setError(err.response?.data?.message || t('tableOrder.closeFailed'));
    } finally {
      setClosing(false);
    }
  };

  const invoicePanelProps = order ? {
    order,
    cart,
    cartTotal,
    onUpdateCartQuantity: updateCartQuantity,
    onAddItems: handleAddItems,
    submitting,
    invoice,
    error,
    printNotice,
    onPrintBill: handlePrintBill,
    printingBill,
    onCloseTable: handleCloseTable,
    closing,
    canEdit,
    hasTransferPermission: hasPermission('transfer tables'),
    onOpenTransfer: openTransferModal,
    discount: {
      hasPermission: hasPermission('manage discount cards'),
      pendingApplication,
      showLookup: showDiscountLookup,
      onToggleLookup: () => setShowDiscountLookup(true),
      cardNumber: discountCardNumber,
      onCardNumberChange: setDiscountCardNumber,
      onLookupCard: handleLookupCard,
      lookingUp,
      error: discountError,
      lookedUpCard,
      mode: discountMode,
      onModeChange: setDiscountMode,
      onRequestDiscount: handleRequestDiscount,
      requesting: requestingDiscount,
      onApproveClick: () => setShowApprovalModal(true),
      onReject: handleRejectDiscount,
    },
  } : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/halls')}
            className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 shrink-0"
          >
            <ArrowLeft size={16} /> {t('tableOrder.backToTables')}
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">
              {t('orders.tableNumber', { number: tableNumber })}
            </h1>
            {hallName && <p className="text-xs text-gray-400 truncate">{hallName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
          {username && <span className="font-medium text-gray-700">{username}</span>}
          <span className="hidden sm:inline-flex items-center gap-1">
            <Clock size={13} />
            {shift ? t('tableOrder.currentShift', { name: shift.opened_by?.name ?? '' }) : t('tableOrder.noShiftOpen')}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin text-[#ff4757]" size={32} />
        </div>
      ) : isVacant && !order ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-gray-500">{t('tableOrder.tableIsVacant')}</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleOpenTable} disabled={opening} className="btn btn-primary flex items-center justify-center gap-2 mx-auto">
              {opening ? <Loader2 size={18} className="animate-spin" /> : t('tableOrder.openTable')}
            </button>
          </div>
        </div>
      ) : locked ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Lock size={28} className="mx-auto text-amber-500" />
            <p className="text-gray-700 font-medium">{t('tableOrder.handledByOther')}</p>
            <p className="text-sm text-gray-400">{t('tableOrder.askOwnerManager')}</p>
          </div>
        </div>
      ) : (
        <>
          {!canEdit && (
            <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded-lg shrink-0">
              <Lock size={14} />
              {t('tableOrder.lockedTo', { name: openedBy ?? t('tableOrder.anotherStaffMember') })}
            </div>
          )}

          <SectionsBar
            sections={sectionTabs}
            activeKey={activeDeptKey}
            onSelect={(key) => { setActiveDeptKey(key); setSearch(''); }}
            emptyLabel={t('tableOrder.noCategoriesYet')}
          />

          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            <div className="lg:w-1/5 lg:border-r border-gray-100 shrink-0">
              <CategoriesList
                categories={categoriesInActiveDept}
                activeCategoryId={activeCategoryId}
                onSelect={(id) => { setActiveCategoryId(id); setSearch(''); }}
                emptyLabel={t('tableOrder.noCategoriesYet')}
              />
            </div>

            <div className="flex-1 lg:border-r border-gray-100 min-h-0">
              <ProductsGrid
                title={productsTitle}
                items={productsToShow}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('tableOrder.searchMenuItems')}
                onAdd={addToCart}
                emptyLabel={t('tableOrder.noItemsInDepartment')}
              />
            </div>

            {invoicePanelProps && (
              <div className="hidden lg:block lg:w-[380px] shrink-0">
                <InvoicePanel {...invoicePanelProps} />
              </div>
            )}
          </div>

          {order && (
            <div className="lg:hidden shrink-0 border-t border-gray-200 bg-white p-3 flex items-center justify-between">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{order.currency} {(parseFloat(order.total) + cartTotal).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{t('tableOrder.itemsCount', { count: order.items.length + cart.length })}</p>
              </div>
              <button type="button" onClick={() => setShowMobileInvoice(true)} className="btn btn-primary text-sm">
                {t('tableOrder.viewInvoice')}
              </button>
            </div>
          )}
        </>
      )}

      {showMobileInvoice && invoicePanelProps && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobileInvoice(false)}
            aria-label={t('common.close')}
            className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-700 bg-white rounded-full p-1 shadow-sm"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-h-0">
            <InvoicePanel {...invoicePanelProps} />
          </div>
        </div>
      )}

      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title={t('tableOrder.transferTableTitle', { number: tableNumber })}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('tableOrder.moveOrderExplain')}</p>
          <select className="input w-full bg-white" value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)}>
            <option value="">{t('tableOrder.selectATable')}</option>
            {vacantTables.map((vt) => (
              <option key={vt.id} value={vt.id}>{t('orders.tableNumber', { number: vt.table_number })}</option>
            ))}
          </select>
          {vacantTables.length === 0 && <p className="text-xs text-gray-400">{t('tableOrder.noVacantTables')}</p>}
          <button
            onClick={handleConfirmTransferTarget}
            disabled={!transferTargetId}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {t('tableOrder.transfer')}
          </button>
        </div>
      </Modal>

      <ApprovalModal
        isOpen={showTransferApproval}
        onClose={() => setShowTransferApproval(false)}
        title={t('tableOrder.approveTransfer')}
        onApprove={handleApproveTransfer}
      />

      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={t('tableOrder.approveDiscount')}
        onApprove={handleApproveDiscount}
      />
    </div>
  );
}
