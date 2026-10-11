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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { posOrderRepo, type POSOrder, type POSOrderItem } from '../../lib/auto-care-db';
import { getCurrentTenantId } from '../../lib/db';
import './POSOrdersPage.css';

type FilterType = 'all' | 'COMPLETED' | 'ONGOING' | 'CANCELLED';

interface DeleteConfirmProps {
  order: POSOrder;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ order, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="pos-orders-delete-overlay">
      <div className="pos-orders-delete-modal">
        <div className="pos-orders-delete-icon">
          <AlertTriangle size={32} />
        </div>
        <h3>Cancel Order #{String(order.orderNumber).padStart(4, '0')}?</h3>
        {order.status === 'PAID' ? (
          <p>
            This is a <strong>PAID</strong> order. It will be marked as{' '}
            <strong>CANCELLED</strong> for audit and accounting purposes, but will
            remain permanently in your database history.
          </p>
        ) : (
          <p>
            This <strong>ONGOING</strong> order will be marked as cancelled and
            cleared from active registers.
          </p>
        )}
        <div className="pos-orders-delete-actions">
          <button className="pos-orders-btn-secondary" onClick={onCancel}>
            Keep Order
          </button>
          <button className="pos-orders-btn-danger" onClick={onConfirm}>
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function POSOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<POSOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<POSOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadOrders = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const all = await posOrderRepo.findAll(getCurrentTenantId());
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

  const filtered = useMemo(() => {
    let list = orders;

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
  }, [orders, filter, search]);

  const handleCancelOrder = async (order: POSOrder) => {
    await posOrderRepo.cancel(order.id, getCurrentTenantId());
    setDeleteTarget(null);
    await loadOrders();
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

  if (loading) {
    return (
      <div className="pos-orders-loading">
        <div className="pos-orders-spinner" />
        <span>Loading orders from database...</span>
      </div>
    );
  }

  const filterTabs: { id: FilterType; label: string }[] = [
    { id: 'all', label: `All (${orders.length})` },
    { id: 'COMPLETED', label: `Completed (${orders.filter((o) => isCompleted(o.status)).length})` },
    { id: 'ONGOING', label: `Ongoing (${orders.filter((o) => isOngoing(o.status)).length})` },
    { id: 'CANCELLED', label: `Cancelled (${orders.filter((o) => isCancelled(o.status)).length})` },
  ];

  return (
    <div className="pos-orders-root">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="pos-orders-header">
        <button
          className="pos-orders-back-btn"
          onClick={() => navigate('/auto-care/pos')}
        >
          <ChevronLeft size={18} />
          Back to POS
        </button>
        <h1 className="pos-orders-title">Orders History</h1>
        <button
          className="pos-orders-back-btn"
          onClick={() => void loadOrders(true)}
          title="Refresh orders from database"
          disabled={refreshing}
        >
          <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
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
                <p>No orders found</p>
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

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirm
          order={deleteTarget}
          onConfirm={() => handleCancelOrder(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
