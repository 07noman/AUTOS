import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Trash2,
  Info,
  ChevronLeft,
  X,
  ShoppingCart,
  AlertTriangle,
  RotateCw,
  Printer,
  BarChart3,
  Calendar,
  FileText,
  DollarSign,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { posOrderRepo, type POSOrder, type POSOrderItem } from '../../lib/auto-care-db';
import { getCurrentTenantId } from '../../lib/db';
import './POSOrdersPage.css';

type FilterType = 'all' | 'COMPLETED' | 'ONGOING' | 'CANCELLED';
type DateFilterType = 'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom';

interface DeleteConfirmProps {
  order: POSOrder;
  onConfirmCancel: () => void;
  onPermanentDelete: () => void;
  onClose: () => void;
}

function DeleteConfirm({ order, onConfirmCancel, onPermanentDelete, onClose }: DeleteConfirmProps) {
  return (
    <div className="pos-orders-delete-overlay">
      <div className="pos-orders-delete-modal">
        <div className="pos-orders-delete-icon">
          <AlertTriangle size={32} />
        </div>
        <h3>Manage Order #{String(order.orderNumber).padStart(4, '0')}</h3>
        <p>
          You can mark this order as <strong>CANCELLED</strong> or <strong>PERMANENTLY DELETE</strong> it from the database history.
        </p>
        <div className="pos-orders-delete-actions" style={{ flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'center' }}>
            <button className="pos-orders-btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Keep Order
            </button>
            <button
              className="pos-orders-btn-secondary"
              onClick={onConfirmCancel}
              style={{ flex: 1, borderColor: '#f59e0b', color: '#b45309' }}
            >
              Mark Cancelled
            </button>
          </div>
          <button
            className="pos-orders-btn-danger"
            onClick={onPermanentDelete}
            style={{ width: '100%', background: '#dc2626' }}
          >
            <Trash2 size={14} style={{ display: 'inline', marginRight: 4 }} />
            Permanently Delete from Database
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResetAllModalProps {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  resetting: boolean;
}

function ResetAllModal({ onConfirm, onCancel, resetting }: ResetAllModalProps) {
  const [confirmText, setConfirmText] = useState('');

  return (
    <div className="pos-orders-delete-overlay">
      <div className="pos-orders-delete-modal" style={{ maxWidth: 460 }}>
        <div className="pos-orders-delete-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
          <AlertTriangle size={32} />
        </div>
        <h3 style={{ color: '#b91c1c' }}>Reset ALL Order History?</h3>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          This will <strong>permanently delete all orders</strong> from Supabase cloud, local database, and browser cache.
        </p>
        <p style={{ fontSize: 13, color: '#475569' }}>
          The order number sequence will be reset to <strong>#0000</strong>. The very next order created will start from <strong>#0001</strong>.
        </p>
        <div style={{ margin: '14px 0', textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
            Type <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>RESET</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET here"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #fca5a5',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div className="pos-orders-delete-actions">
          <button className="pos-orders-btn-secondary" onClick={onCancel} disabled={resetting}>
            Cancel
          </button>
          <button
            className="pos-orders-btn-danger"
            style={{ background: '#dc2626', borderColor: '#b91c1c' }}
            disabled={resetting || confirmText.trim().toUpperCase() !== 'RESET'}
            onClick={() => void onConfirm()}
          >
            {resetting ? 'Resetting...' : 'Yes, Delete ALL Orders'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SummaryModalProps {
  orders: POSOrder[];
  dateTitle: string;
  onClose: () => void;
}

function SummaryReportModal({ orders, dateTitle, onClose }: SummaryModalProps) {
  const money = (amount: number) =>
    `Rs. ${Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const completed = orders.filter((o) => o.status === 'PAID' || (o.status as any) === 'COMPLETED');
  const ongoing = orders.filter((o) => o.status === 'ONGOING');
  const cancelled = orders.filter((o) => o.status === 'CANCELLED');

  const grossSales = completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const totalTax = completed.reduce((sum, o) => sum + (Number(o.tax) || 0), 0);
  const netPaid = completed.reduce((sum, o) => sum + (Number(o.paidAmount ?? o.total) || 0), 0);

  const payments = completed.reduce<Record<string, { count: number; total: number }>>((acc, o) => {
    const pm = (o.paymentMethod || 'cash').toLowerCase();
    const key = pm.includes('cash')
      ? 'Cash'
      : pm.includes('card') || pm.includes('bank')
      ? 'Card / Bank'
      : pm.includes('credit') || pm.includes('account')
      ? 'Credit'
      : 'Other';
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Number(o.total) || 0;
    return acc;
  }, {});

  // Sold items map
  const itemsMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const o of completed) {
    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        const key = item.name || 'Item';
        const qty = Number(item.quantity) || 1;
        const lineTotal = qty * (Number(item.price) || 0);
        const cur = itemsMap.get(key) || { name: key, quantity: 0, total: 0 };
        cur.quantity += qty;
        cur.total += lineTotal;
        itemsMap.set(key, cur);
      }
    }
  }
  const topItems = Array.from(itemsMap.values()).sort((a, b) => b.total - a.total);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Summary Report - ${dateTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; margin: 20px; font-size: 13px; color: #111; }
          .header { text-align: center; border-bottom: 2px dashed #444; padding-bottom: 12px; margin-bottom: 14px; }
          .header h2 { margin: 0 0 4px 0; font-size: 18px; }
          .header p { margin: 2px 0; color: #555; font-size: 12px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 8px 0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
          .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; border-top: 1px solid #111; padding-top: 6px; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { text-align: left; border-bottom: 1px solid #111; padding: 4px 0; }
          td { padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .text-right { text-align: right; }
          .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #777; border-top: 1px dashed #aaa; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>GENX POS — SUMMARY REPORT</h2>
          <p><strong>Period:</strong> ${dateTitle}</p>
          <p><strong>Generated At:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div class="section-title">Order Counts</div>
        <div class="row"><span>Total Orders:</span><strong>${orders.length}</strong></div>
        <div class="row"><span>Completed / Paid:</span><strong>${completed.length}</strong></div>
        <div class="row"><span>Ongoing / Pending:</span><strong>${ongoing.length}</strong></div>
        <div class="row"><span>Cancelled:</span><strong>${cancelled.length}</strong></div>

        <div class="section-title">Financial Summary</div>
        <div class="row"><span>Gross Sales:</span><span>${money(grossSales)}</span></div>
        <div class="row"><span>Total Tax:</span><span>${money(totalTax)}</span></div>
        <div class="total-row"><span>Net Amount Collected:</span><span>${money(netPaid)}</span></div>

        <div class="section-title">Payment Methods</div>
        ${Object.entries(payments)
          .map(
            ([pm, st]) =>
              `<div class="row"><span>${pm} (${st.count} orders):</span><strong>${money(st.total)}</strong></div>`
          )
          .join('')}

        <div class="section-title">Top Items / Parts Sold</div>
        <table>
          <thead>
            <tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Total</th></tr>
          </thead>
          <tbody>
            ${
              topItems.length === 0
                ? '<tr><td colspan="3" style="text-align:center;color:#888;">No items sold</td></tr>'
                : topItems
                    .map(
                      (it) =>
                        `<tr><td>${it.name}</td><td class="text-right">${it.quantity}</td><td class="text-right">${money(it.total)}</td></tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>

        <div class="footer">
          <p>Printed from GENX POS Auto Care Module</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <div className="pos-orders-delete-overlay">
      <div className="pos-orders-summary-modal">
        <div className="pos-orders-summary-modal-header">
          <div className="flex items-center gap-2">
            <FileText className="text-teal-600" size={22} />
            <div>
              <h3>Summary Report</h3>
              <p className="text-xs text-slate-500">{dateTitle}</p>
            </div>
          </div>
          <button className="pos-orders-detail-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pos-orders-summary-modal-body">
          {/* Stats Bar */}
          <div className="pos-orders-summary-stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Orders</span>
              <span className="stat-value">{orders.length}</span>
              <span className="stat-sub">{completed.length} Paid</span>
            </div>
            <div className="stat-card highlight">
              <span className="stat-label">Gross Sales</span>
              <span className="stat-value">{money(grossSales)}</span>
              <span className="stat-sub">Tax: {money(totalTax)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Net Collected</span>
              <span className="stat-value text-emerald-600">{money(netPaid)}</span>
              <span className="stat-sub">{completed.length} Transactions</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="pos-orders-summary-section">
            <h4 className="pos-orders-summary-heading">Payment Method Breakdown</h4>
            <div className="pos-orders-summary-pay-grid">
              {Object.entries(payments).map(([method, data]) => (
                <div key={method} className="pay-method-pill">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{method}</span>
                    <span>{data.count} orders</span>
                  </div>
                  <div className="text-sm font-bold text-teal-700 mt-1">{money(data.total)}</div>
                </div>
              ))}
              {Object.keys(payments).length === 0 && (
                <p className="text-xs text-slate-400">No payments recorded for this period.</p>
              )}
            </div>
          </div>

          {/* Sold Items */}
          <div className="pos-orders-summary-section">
            <h4 className="pos-orders-summary-heading">
              Parts & Items Sold ({topItems.length})
            </h4>
            <div className="pos-orders-summary-items-list">
              {topItems.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No items sold in this period.</p>
              ) : (
                topItems.map((item, idx) => (
                  <div key={idx} className="pos-orders-summary-item-row">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">{item.quantity} qty</span>
                    <span className="item-total">{money(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="pos-orders-summary-modal-footer">
          <button className="pos-orders-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="pos-orders-btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer size={16} />
            Print Summary Report
          </button>
        </div>
      </div>
    </div>
  );
}

export function POSOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<POSOrder[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const tenantId = getCurrentTenantId();
        const raw = localStorage.getItem(`genx:pos_orders_cache:${tenantId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(() => orders.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selected, setSelected] = useState<POSOrder | null>(() => orders[0] ?? null);
  const [deleteTarget, setDeleteTarget] = useState<POSOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadOrders = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const tenantId = getCurrentTenantId();
    try {
      // 1. Instant local load from SQLite and IndexedDB (< 5ms)
      const local = await posOrderRepo.findLocal(tenantId);
      if (local.length > 0) {
        setOrders(local);
        setSelected((prev) => prev ?? local[0] ?? null);
        setLoading(false);
      }

      // 2. Background revalidation from database / Supabase
      const all = await posOrderRepo.findAll(tenantId);
      setOrders(all);
      setSelected((prev) => {
        if (!prev && all.length > 0) return all[0];
        if (prev) return all.find((o) => o.id === prev.id) ?? all[0] ?? null;
        return null;
      });
    } catch (e) {
      console.error('Failed to load POS orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const onFocus = () => void loadOrders();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadOrders]);

  const isCompleted = (status: string) => {
    const s = String(status || '').toUpperCase();
    return s === 'PAID' || s === 'COMPLETED';
  };

  const isOngoing = (status: string) => {
    const s = String(status || '').toUpperCase();
    return s === 'ONGOING' || s === 'PENDING';
  };

  const isCancelled = (status: string) => {
    const s = String(status || '').toUpperCase();
    return s === 'CANCELLED';
  };

  // Date filtering logic
  const dateFilteredOrders = useMemo(() => {
    const now = new Date();

    if (dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      return orders.filter((o) => o.createdAt >= startOfDay && o.createdAt <= endOfDay);
    }

    if (dateFilter === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      const endOfYesterday = startOfYesterday + 24 * 60 * 60 * 1000 - 1;
      return orders.filter((o) => o.createdAt >= startOfYesterday && o.createdAt <= endOfYesterday);
    }

    if (dateFilter === '7days') {
      const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return orders.filter((o) => o.createdAt >= cutoff);
    }

    if (dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return orders.filter((o) => o.createdAt >= startOfMonth);
    }

    if (dateFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart).getTime();
      const end = new Date(customEnd).setHours(23, 59, 59, 999);
      return orders.filter((o) => o.createdAt >= start && o.createdAt <= end);
    }

    return orders;
  }, [orders, dateFilter, customStart, customEnd]);

  // Combined status and search filtering
  const filtered = useMemo(() => {
    let list = dateFilteredOrders;

    // Filter by status tab
    if (filter === 'COMPLETED') {
      list = list.filter((o) => isCompleted(o.status));
    } else if (filter === 'ONGOING') {
      list = list.filter((o) => isOngoing(o.status));
    } else if (filter === 'CANCELLED') {
      list = list.filter((o) => isCancelled(o.status));
    }

    // Search query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          String(o.orderNumber).padStart(4, '0').includes(q) ||
          (o.customerName ?? '').toLowerCase().includes(q) ||
          (o.paymentMethod ?? '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [dateFilteredOrders, filter, search]);

  const handleCancelOrder = async (order: POSOrder) => {
    await posOrderRepo.cancel(order.id, getCurrentTenantId());
    setDeleteTarget(null);
    setNotification(`Order #${String(order.orderNumber).padStart(4, '0')} marked as cancelled.`);
    setTimeout(() => setNotification(null), 6000);
    await loadOrders(true);
  };

  const handlePermanentDeleteOrder = async (order: POSOrder) => {
    await posOrderRepo.deleteOrder(order.id, getCurrentTenantId());
    setDeleteTarget(null);
    setNotification(`Order #${String(order.orderNumber).padStart(4, '0')} permanently removed from database.`);
    setTimeout(() => setNotification(null), 6000);
    await loadOrders(true);
  };

  const handleResetAllOrders = async () => {
    setResettingAll(true);
    try {
      const tenantId = getCurrentTenantId();
      await posOrderRepo.resetAllOrders(tenantId);
      setOrders([]);
      setSelected(null);
      setResetAllOpen(false);
      setNotification('✅ All orders deleted & order sequence reset to #0000. Next order will start from #0001.');
      setTimeout(() => setNotification(null), 8000);
      await loadOrders(true);
    } catch (err) {
      console.error('Failed to reset all orders:', err);
      setNotification('❌ Failed to reset orders.');
    } finally {
      setResettingAll(false);
    }
  };

  const handleLoadInPOS = (order: POSOrder) => {
    if (order.status !== 'ONGOING') return;
    const params = new URLSearchParams({
      loadOrderId: order.id,
      loadOrderNumber: String(order.orderNumber),
    });
    navigate(`/auto-care/pos?${params.toString()}`);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) =>
    `Rs. ${Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const statusLabel = (s: string) => {
    const upper = String(s || '').toUpperCase();
    if (upper === 'ONGOING' || upper === 'PENDING') return 'Ongoing';
    if (upper === 'PAID' || upper === 'COMPLETED') return 'Completed';
    if (upper === 'CANCELLED') return 'Cancelled';
    return s;
  };

  const totalItems = (order: POSOrder) =>
    order.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  if (loading && orders.length === 0) {
    return (
      <div className="pos-orders-loading">
        <div className="pos-orders-spinner" />
        <span>Loading orders...</span>
      </div>
    );
  }

  const dateFilterLabels: Record<DateFilterType, string> = {
    today: "Today's Orders",
    yesterday: "Yesterday's Orders",
    '7days': 'Last 7 Days',
    month: 'This Month',
    all: 'All Time Orders',
    custom: 'Custom Date Range',
  };

  const dateTitle = dateFilterLabels[dateFilter];

  const filterTabs: { id: FilterType; label: string }[] = [
    { id: 'all', label: `All (${dateFilteredOrders.length})` },
    {
      id: 'COMPLETED',
      label: `Completed (${dateFilteredOrders.filter((o) => isCompleted(o.status)).length})`,
    },
    {
      id: 'ONGOING',
      label: `Ongoing (${dateFilteredOrders.filter((o) => isOngoing(o.status)).length})`,
    },
    {
      id: 'CANCELLED',
      label: `Cancelled (${dateFilteredOrders.filter((o) => isCancelled(o.status)).length})`,
    },
  ];

  return (
    <div className="pos-orders-root">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="pos-orders-header">
        <div className="flex items-center gap-3">
          <button
            className="pos-orders-back-btn"
            onClick={() => navigate('/auto-care/pos')}
          >
            <ChevronLeft size={18} />
            Back to POS
          </button>
          <h1 className="pos-orders-title">Orders History</h1>
        </div>

        {/* Action Buttons: Summary Report & Reports & Analytics */}
        <div className="flex items-center gap-2.5">
          <button
            className="pos-orders-action-btn summary"
            onClick={() => setSummaryOpen(true)}
            title="Print summary of orders"
          >
            <Printer size={16} />
            <span>Summary Report</span>
          </button>

          <button
            className="pos-orders-action-btn reports"
            onClick={() => navigate('/auto-care/reports')}
            title="Go to Reports & Analytics"
          >
            <BarChart3 size={16} />
            <span>Reports & Analytics</span>
          </button>

          <button
            className="pos-orders-action-btn reset"
            onClick={() => setResetAllOpen(true)}
            title="Permanently delete all orders and reset order numbers to #0000"
          >
            <Trash2 size={16} />
            <span>Reset All History</span>
          </button>

          <button
            className="pos-orders-back-btn"
            onClick={() => void loadOrders(true)}
            title="Refresh orders from database"
            disabled={refreshing}
          >
            <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Notification Banner ────────────────────────────────────────── */}
      {notification && (
        <div style={{
          margin: '0 24px 12px',
          padding: '10px 14px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          color: '#15803d',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Date Range Bar ────────────────────────────────────────────────── */}
      <div className="pos-orders-date-bar">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-slate-400" />
          <span className="pos-orders-date-label">Date Filter:</span>
          <div className="pos-orders-date-tabs">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Orders' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`pos-orders-date-btn${dateFilter === d.id ? ' active' : ''}`}
                onClick={() => setDateFilter(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              className="pos-orders-date-input"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="pos-orders-date-input"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        <div className="pos-orders-date-count">
          Showing <strong>{filtered.length}</strong> orders for {dateTitle}
        </div>
      </div>

      {/* ── Body: list + detail ─────────────────────────────────────────── */}
      <div className="pos-orders-body">
        {/* ── Left: Order list ──────────────────────────────────────────── */}
        <div className="pos-orders-list-panel">
          {/* Search */}
          <div className="pos-orders-search-wrap">
            <Search size={16} className="pos-orders-search-icon" />
            <input
              className="pos-orders-search-input"
              placeholder="Search orders by number, customer, payment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="pos-orders-search-clear"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="pos-orders-filter-bar">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                className={`pos-orders-filter-btn${filter === tab.id ? ' active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="pos-orders-list">
            {filtered.length === 0 ? (
              <div className="pos-orders-empty">
                <ShoppingCart size={32} opacity={0.3} />
                <p>No orders found for {dateTitle}</p>
                {dateFilter === 'today' && orders.length > 0 && (
                  <button
                    className="text-xs text-teal-600 underline font-medium cursor-pointer"
                    onClick={() => setDateFilter('all')}
                  >
                    View All Time Orders ({orders.length} total)
                  </button>
                )}
              </div>
            ) : (
              filtered.map((order) => (
                <div
                  key={order.id}
                  className={`pos-orders-list-item${
                    selected?.id === order.id ? ' selected' : ''
                  }${order.status === 'CANCELLED' ? ' cancelled' : ''}`}
                  onClick={() => {
                    setSelected(order);
                    setDetailOpen(true);
                  }}
                >
                  <div className="pos-orders-item-left">
                    <span className="pos-orders-item-num">
                      #{String(order.orderNumber).padStart(4, '0')}
                    </span>
                    <div className="pos-orders-item-meta">
                      <span className="pos-orders-item-date">{formatDate(order.createdAt)}</span>
                      <span className="pos-orders-item-time">{formatTime(order.createdAt)}</span>
                    </div>
                    {order.customerName && (
                      <span className="pos-orders-item-customer">{order.customerName}</span>
                    )}
                  </div>

                  <div className="pos-orders-item-right">
                    <span className="pos-orders-item-total">
                      {formatCurrency(order.total)}
                    </span>
                    <span className={`pos-orders-status-badge ${order.status.toLowerCase()}`}>
                      {statusLabel(order.status)}
                    </span>
                    <div className="pos-orders-item-actions">
                      <button
                        className="pos-orders-icon-btn info"
                        title="View details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(order);
                          setDetailOpen(true);
                        }}
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="pos-orders-icon-btn delete"
                        title="Cancel order"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(order);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Detail panel ───────────────────────────────────────── */}
        <div className={`pos-orders-detail-panel${detailOpen ? ' open' : ''}`}>
          {!selected ? (
            <div className="pos-orders-detail-empty">
              <ShoppingCart size={40} opacity={0.2} />
              <p>Select an order to view details</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="pos-orders-detail-header">
                <div>
                  <h2 className="pos-orders-detail-num">
                    Order #{String(selected.orderNumber).padStart(4, '0')}
                  </h2>
                  <span className={`pos-orders-status-badge ${selected.status.toLowerCase()}`}>
                    {statusLabel(selected.status)}
                  </span>
                </div>
                <button
                  className="pos-orders-detail-close"
                  onClick={() => setDetailOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Detail body */}
              <div className="pos-orders-detail-body">
                {/* Info row */}
                <div className="pos-orders-detail-info">
                  <div className="pos-orders-detail-info-item">
                    <span className="label">Date</span>
                    <span className="value">{formatDate(selected.createdAt)}</span>
                  </div>
                  <div className="pos-orders-detail-info-item">
                    <span className="label">Time</span>
                    <span className="value">{formatTime(selected.createdAt)}</span>
                  </div>
                  {selected.customerName && (
                    <div className="pos-orders-detail-info-item">
                      <span className="label">Customer</span>
                      <span className="value">{selected.customerName}</span>
                    </div>
                  )}
                  {selected.paymentMethod && (
                    <div className="pos-orders-detail-info-item">
                      <span className="label">Payment</span>
                      <span className="value" style={{ textTransform: 'capitalize' }}>
                        {selected.paymentMethod}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items list */}
                <div className="pos-orders-detail-items">
                  <h3 className="pos-orders-detail-section-title">Items</h3>
                  {selected.items.length === 0 ? (
                    <p className="pos-orders-detail-no-items">No items</p>
                  ) : (
                    selected.items.map((item: POSOrderItem, idx: number) => (
                      <div key={idx} className="pos-orders-detail-item-row">
                        <div className="pos-orders-detail-item-info">
                          <span className="pos-orders-detail-item-name">{item.name}</span>
                          <span className="pos-orders-detail-item-qty">
                            {item.quantity} × {formatCurrency(item.price)}
                          </span>
                        </div>
                        <span className="pos-orders-detail-item-total">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Totals */}
                <div className="pos-orders-detail-totals">
                  <div className="pos-orders-total-row">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selected.subtotal)}</span>
                  </div>
                  <div className="pos-orders-total-row">
                    <span>Tax</span>
                    <span>{formatCurrency(selected.tax)}</span>
                  </div>
                  <div className="pos-orders-total-row total">
                    <span>Total</span>
                    <span>{formatCurrency(selected.total)}</span>
                  </div>
                  {selected.paidAmount != null && (
                    <div className="pos-orders-total-row">
                      <span>Paid</span>
                      <span>{formatCurrency(selected.paidAmount)}</span>
                    </div>
                  )}
                  <div className="pos-orders-total-row">
                    <span>Items</span>
                    <span>{totalItems(selected)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pos-orders-detail-actions">
                  {selected.status === 'ONGOING' && (
                    <button
                      className="pos-orders-btn-primary"
                      onClick={() => handleLoadInPOS(selected)}
                    >
                      Continue in POS
                    </button>
                  )}
                  {selected.status !== 'CANCELLED' && (
                    <button
                      className="pos-orders-btn-secondary"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Summary Report Modal ──────────────────────────────────────────── */}
      {summaryOpen && (
        <SummaryReportModal
          orders={dateFilteredOrders}
          dateTitle={dateTitle}
          onClose={() => setSummaryOpen(false)}
        />
      )}

      {/* ── Reset ALL History Modal ──────────────────────────────────────── */}
      {resetAllOpen && (
        <ResetAllModal
          onConfirm={handleResetAllOrders}
          onCancel={() => setResetAllOpen(false)}
          resetting={resettingAll}
        />
      )}

      {/* ── Delete / Cancel confirm modal ─────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          order={deleteTarget}
          onConfirmCancel={() => handleCancelOrder(deleteTarget)}
          onPermanentDelete={() => handlePermanentDeleteOrder(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default POSOrdersPage;
