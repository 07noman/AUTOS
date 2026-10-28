import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Wrench,
  CreditCard,
  Calendar,
  Printer,
  ChevronLeft,
  ArrowRight,
  RotateCw,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Percent,
  Trash2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Button } from '@genx/ui/Button';
import { Badge } from '@genx/ui/Badge';
import { posOrderRepo, type POSOrder, type POSOrderItem } from '@/lib/auto-care-db';
import { productRepo, getCurrentTenantId } from '@/lib/db';
import { expenseRepo, type Expense } from '@/lib/expenses-repo';
import type { Product } from '@genx/types/domain/product';

type DateRangeType = 'today' | 'yesterday' | '7days' | 'month' | 'year' | 'all';

export function AutoCareReportsPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'parts' | 'payments' | 'expenses'>('overview');

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDate, setClearDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clearNotification, setClearNotification] = useState<string | null>(null);

  // Reset ALL orders state
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);
  const [resetAllConfirmText, setResetAllConfirmText] = useState('');
  const [resettingAll, setResettingAll] = useState(false);

  const tenantId = getCurrentTenantId();

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [posOrders, allProducts, allExpenses] = await Promise.all([
        posOrderRepo.findAll(tenantId),
        productRepo.findAll(tenantId).catch(() => []),
        expenseRepo.findAll(tenantId).catch(() => []),
      ]);
      setOrders(posOrders);
      setProducts(allProducts);
      setExpenses(allExpenses);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [tenantId]);

  const ordersOnClearDate = useMemo(() => {
    const target = new Date(clearDate + 'T00:00:00');
    const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    return orders.filter((o) => o.createdAt >= startOfDay && o.createdAt <= endOfDay);
  }, [orders, clearDate]);

  const handleClearOrders = async () => {
    setClearing(true);
    try {
      const target = new Date(clearDate + 'T12:00:00');
      const res = await posOrderRepo.clearDayOrders(target, tenantId);
      setClearConfirmOpen(false);
      setClearNotification(
        `Successfully deleted ${res.deletedCount} orders for ${clearDate}. Next order sequence reset to #${String(
          res.lastOrderNumber + 1
        ).padStart(4, '0')}.`
      );
      await loadData(true);
      setTimeout(() => setClearNotification(null), 8000);
    } catch (err) {
      console.error('Failed to clear day orders:', err);
    } finally {
      setClearing(false);
    }
  };

  /** Wipe ALL orders from Supabase + SQLite + localStorage cache, reset sequence to 0 */
  const handleResetAllOrders = async () => {
    setResettingAll(true);
    try {
      // 1. Clear localStorage cache keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('genx:pos_orders_cache:') ||
            key === 'pos_orders' ||
            key.startsWith('pos_orders_') ||
            key.includes('orderNumber') ||
            key.includes('order_number'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // 2. Delete all orders via posOrderRepo
      await posOrderRepo.resetAllOrders(tenantId);

      setResetAllConfirmOpen(false);
      setResetAllConfirmText('');
      setClearNotification(
        '✅ All orders deleted & order sequence reset to #0000. Next order will be #0001.'
      );
      await loadData(true);
      setTimeout(() => setClearNotification(null), 10000);
    } catch (err) {
      console.error('Failed to reset all orders:', err);
      setClearNotification('❌ Reset failed. Check console for details.');
    } finally {
      setResettingAll(false);
    }
  };

  // Product cost map (id/name -> costPrice)
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.id) map.set(String(p.id).toLowerCase(), Number(p.costPrice) || 0);
      if (p.name) map.set(p.name.trim().toLowerCase(), Number(p.costPrice) || 0);
    }
    return map;
  }, [products]);

  // Filter orders based on dateRange
  const filteredOrders = useMemo(() => {
    const now = new Date();

    if (dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      return orders.filter((o) => o.createdAt >= startOfDay && o.createdAt <= endOfDay);
    }

    if (dateRange === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      const endOfYesterday = startOfYesterday + 24 * 60 * 60 * 1000 - 1;
      return orders.filter((o) => o.createdAt >= startOfYesterday && o.createdAt <= endOfYesterday);
    }

    if (dateRange === '7days') {
      const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return orders.filter((o) => o.createdAt >= cutoff);
    }

    if (dateRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return orders.filter((o) => o.createdAt >= startOfMonth);
    }

    if (dateRange === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
      return orders.filter((o) => o.createdAt >= startOfYear);
    }

    if (customStart && customEnd) {
      const start = new Date(customStart).getTime();
      const end = new Date(customEnd).setHours(23, 59, 59, 999);
      return orders.filter((o) => o.createdAt >= start && o.createdAt <= end);
    }

    return orders;
  }, [orders, dateRange, customStart, customEnd]);

  // Filter expenses strictly aligned with selected date range
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateRange === 'today') {
      return expenses.filter((e) => e.date === todayStr);
    }

    if (dateRange === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return expenses.filter((e) => e.date === yesterdayStr);
    }

    if (dateRange === '7days') {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return expenses.filter((e) => e.date >= cutoff);
    }

    if (dateRange === 'month') {
      const startOfMonth = todayStr.substring(0, 7);
      return expenses.filter((e) => (e.date || '').startsWith(startOfMonth));
    }

    if (dateRange === 'year') {
      const startOfYear = todayStr.substring(0, 4);
      return expenses.filter((e) => (e.date || '').startsWith(startOfYear));
    }

    if (customStart && customEnd) {
      return expenses.filter((e) => e.date >= customStart && e.date <= customEnd);
    }

    return expenses;
  }, [expenses, dateRange, customStart, customEnd]);

  // Total expenses and category breakdown
  const { totalExpenses, expensesByCategory } = useMemo(() => {
    let total = 0;
    const catMap = new Map<string, { category: string; count: number; total: number }>();

    for (const exp of filteredExpenses) {
      const amt = Number(exp.amount) || 0;
      total += amt;
      const cat = exp.category || 'Other';
      const existing = catMap.get(cat);
      if (existing) {
        existing.count += 1;
        existing.total += amt;
      } else {
        catMap.set(cat, { category: cat, count: 1, total: amt });
      }
    }

    const expensesByCategory = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
    return { totalExpenses: total, expensesByCategory };
  }, [filteredExpenses]);

  // Financial calculations
  const stats = useMemo(() => {
    const completedOrders = filteredOrders.filter(
      (o) => o.status === 'PAID' || (o.status as any) === 'COMPLETED'
    );
    const ongoingOrders = filteredOrders.filter((o) => o.status === 'ONGOING');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'CANCELLED');

    let grossRevenue = 0;
    let totalTax = 0;
    let totalCost = 0;
    let partsRevenue = 0;
    let serviceRevenue = 0;
    let partsCount = 0;
    let serviceCount = 0;

    const partsMap = new Map<
      string,
      {
        name: string;
        type: 'product' | 'service';
        category?: string;
        quantity: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    const paymentMethods: Record<string, { count: number; total: number }> = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      credit: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    for (const order of completedOrders) {
      grossRevenue += Number(order.total) || 0;
      totalTax += Number(order.tax) || 0;

      // Payment Method Breakdown
      const method = (order.paymentMethod || 'cash').toLowerCase();
      if (method.includes('cash')) {
        paymentMethods.cash.count += 1;
        paymentMethods.cash.total += Number(order.total) || 0;
      } else if (method.includes('card') || method.includes('bank') || method.includes('pos')) {
        paymentMethods.card.count += 1;
        paymentMethods.card.total += Number(order.total) || 0;
      } else if (method.includes('credit') || method.includes('account')) {
        paymentMethods.credit.count += 1;
        paymentMethods.credit.total += Number(order.total) || 0;
      } else {
        paymentMethods.other.count += 1;
        paymentMethods.other.total += Number(order.total) || 0;
      }

      // Items calculation
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          const lineRevenue = qty * price;

          // Estimate cost price
          let unitCost = 0;
          if (item.type !== 'service') {
            const keyById = item.id ? String(item.id).toLowerCase() : '';
            const keyByName = item.name ? item.name.trim().toLowerCase() : '';
            unitCost = productCostMap.get(keyById) ?? productCostMap.get(keyByName) ?? 0;
          }
          const lineCost = qty * unitCost;

          totalCost += lineCost;

          if (item.type === 'service') {
            serviceRevenue += lineRevenue;
            serviceCount += qty;
          } else {
            partsRevenue += lineRevenue;
            partsCount += qty;
          }

          // Aggregated items table
          const itemKey = (item.name || 'Unnamed Item').trim();
          const existing = partsMap.get(itemKey);
          if (existing) {
            existing.quantity += qty;
            existing.revenue += lineRevenue;
            existing.cost += lineCost;
            existing.profit += lineRevenue - lineCost;
          } else {
            partsMap.set(itemKey, {
              name: itemKey,
              type: item.type || 'product',
              category: item.category,
              quantity: qty,
              revenue: lineRevenue,
              cost: lineCost,
              profit: lineRevenue - lineCost,
            });
          }
        }
      }
    }

    const grossProfit = grossRevenue - totalCost;
    const profitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    const netProfit = grossProfit - totalExpenses;
    const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const avgOrderValue = completedOrders.length > 0 ? grossRevenue / completedOrders.length : 0;

    const topItems = Array.from(partsMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      totalOrdersCount: filteredOrders.length,
      completedOrdersCount: completedOrders.length,
      ongoingOrdersCount: ongoingOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      grossRevenue,
      totalTax,
      totalCost,
      grossProfit,
      profitMargin,
      totalExpenses,
      netProfit,
      netMargin,
      avgOrderValue,
      partsRevenue,
      serviceRevenue,
      partsCount,
      serviceCount,
      paymentMethods,
      topItems,
    };
  }, [filteredOrders, productCostMap, totalExpenses]);

  const money = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handlePrint = () => {
    window.print();
  };

  const rangeTitle = {
    today: "Today's",
    yesterday: "Yesterday's",
    '7days': 'Last 7 Days',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time',
  }[dateRange];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-sky-500" />
            <h1 className="text-2xl font-bold text-text">Reports & Analytics</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Real-time shop performance, parts sales, revenue, cost & profit (Live Store Data)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate('/auto-care/orders')}
            className="flex items-center gap-1.5"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
            Orders History
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4 text-blue-500" />
            Print Report
          </Button>
          <Button
            variant="outline"
            onClick={() => setClearConfirmOpen(true)}
            className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-1.5"
            title="Clear orders and reset sequence numbers"
          >
            <Trash2 className="h-4 w-4 text-rose-500" />
            Clear Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => { setResetAllConfirmOpen(true); setResetAllConfirmText(''); }}
            className="border-red-500 text-red-700 hover:bg-red-50 hover:text-red-800 flex items-center gap-1.5 font-semibold"
            title="Delete ALL orders from all time and reset order numbers to 0"
          >
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Reset All History
          </Button>
          <Button
            onClick={() => navigate('/auto-care/pos')}
            className="bg-primary hover:bg-primary/90 text-white flex items-center gap-1.5"
          >
            Launch POS <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Clear Notification Banner ────────────────────────────────────────── */}
      {clearNotification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{clearNotification}</span>
          </div>
          <button
            onClick={() => setClearNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-muted" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Time Period:
          </span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDateRange(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dateRange === r.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted/50 text-text-secondary hover:bg-muted'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-secondary">
          Showing <strong>{filteredOrders.length}</strong> orders for{' '}
          <strong className="text-primary">{rangeTitle}</strong>
        </div>
      </div>

      {/* ── 5 Key Financial KPI Cards (Including Expenses & Net Profit) ─────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Gross Revenue */}
        <Card className="border border-border/80 shadow-sm hover:border-sky-500/50 transition">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">
                {rangeTitle} Gross Revenue
              </span>
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text mt-2">
              {money(stats.grossRevenue)}
            </div>
            <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
              <span>{stats.completedOrdersCount} Paid Orders</span>
              <span className="text-text-muted">· Tax: {money(stats.totalTax)}</span>
            </p>
          </CardContent>
        </Card>

        {/* 2. Cost of Goods (Parts Cost) */}
        <Card className="border border-border/80 shadow-sm hover:border-amber-500/50 transition">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Parts / Stock Cost</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text mt-2">
              {money(stats.totalCost)}
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Cost of goods sold from product inventory
            </p>
          </CardContent>
        </Card>

        {/* 3. Gross Profit */}
        <Card className="border border-border/80 shadow-sm hover:border-emerald-500/50 transition">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Gross Profit</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2">
              {money(stats.grossProfit)}
            </div>
            <div className="text-xs font-medium text-emerald-500 mt-1 flex items-center gap-1">
              <Percent className="h-3 w-3" />
              <span>{stats.profitMargin.toFixed(1)}% Gross Margin</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Total Expenses */}
        <Card className="border border-border/80 shadow-sm hover:border-rose-500/50 transition">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Total Expenses</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {money(stats.totalExpenses)}
            </div>
            <p className="text-xs text-rose-400 mt-1 flex items-center justify-between">
              <span>{filteredExpenses.length} expense entries</span>
              <button
                onClick={() => navigate('/expenses')}
                className="underline hover:text-rose-300 font-medium"
              >
                Manage
              </button>
            </p>
          </CardContent>
        </Card>

        {/* 5. Net Profit (Sales - Expenses - Cost) */}
        <Card
          className={`border shadow-sm transition ${
            stats.netProfit >= 0
              ? 'border-teal-500/50 hover:border-teal-400'
              : 'border-rose-500/50 hover:border-rose-400'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Net Profit
              </span>
              <div
                className={`p-2 rounded-lg ${
                  stats.netProfit >= 0
                    ? 'bg-teal-500/10 text-teal-500'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`text-2xl font-bold mt-2 ${
                stats.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'
              }`}
            >
              {money(stats.netProfit)}
            </div>
            <div
              className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                stats.netProfit >= 0 ? 'text-teal-500' : 'text-rose-500'
              }`}
            >
              <Percent className="h-3 w-3" />
              <span>
                {stats.netMargin.toFixed(1)}% Net Margin (Sales - Cost - Expenses)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Shop Performance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('parts')}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'parts'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Parts & Services Sale
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Sales & Payment Breakdown
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'expenses'
              ? 'border-rose-500 text-rose-500 font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Expenses & Costs Breakdown
        </button>
      </div>

      {/* ── Tab 1: Shop Performance ────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Status Breakdown */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Orders Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <div className="text-sm font-semibold text-text">Paid / Completed</div>
                    <div className="text-xs text-text-muted">Successfully invoiced</div>
                  </div>
                </div>
                <div className="text-lg font-bold text-emerald-600">
                  {stats.completedOrdersCount}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <div>
                    <div className="text-sm font-semibold text-text">Ongoing / In Bay</div>
                    <div className="text-xs text-text-muted">Awaiting completion</div>
                  </div>
                </div>
                <div className="text-lg font-bold text-amber-600">
                  {stats.ongoingOrdersCount}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                <div className="flex items-center gap-2.5">
                  <XCircle className="h-5 w-5 text-rose-500" />
                  <div>
                    <div className="text-sm font-semibold text-text">Cancelled Orders</div>
                    <div className="text-xs text-text-muted">Voided transactions</div>
                  </div>
                </div>
                <div className="text-lg font-bold text-rose-600">
                  {stats.cancelledOrdersCount}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex justify-between text-xs text-text-secondary">
                <span>Total Registered Orders:</span>
                <span className="font-bold text-text">{stats.totalOrdersCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Revenue vs Cost Summary Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Financial Performance Summary ({rangeTitle})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-xs text-text-muted">Gross Sales</span>
                  <div className="text-xl font-bold text-text mt-1">
                    {money(stats.grossRevenue)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-xs text-text-muted">Parts Cost (COGS)</span>
                  <div className="text-xl font-bold text-amber-600 mt-1">
                    {money(stats.totalCost)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-emerald-600 font-semibold">Net Profit</span>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    {money(stats.grossProfit)}
                  </div>
                </div>
              </div>

              {/* Progress bar visual for profit share */}
              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-secondary">Gross Margin Ratio</span>
                  <span className="text-emerald-600 font-bold">
                    {stats.profitMargin.toFixed(1)}% Profit / {(100 - stats.profitMargin).toFixed(1)}% Cost
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, stats.profitMargin))}%` }}
                    title={`Profit: ${stats.profitMargin.toFixed(1)}%`}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, 100 - stats.profitMargin))}%` }}
                    title={`Cost: ${(100 - stats.profitMargin).toFixed(1)}%`}
                  />
                </div>
              </div>

              {/* Parts vs Service split */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                    <Package className="h-4 w-4 text-sky-500" />
                    <span>Parts & Products Revenue</span>
                  </div>
                  <div className="text-lg font-bold text-text">
                    {money(stats.partsRevenue)}
                  </div>
                  <span className="text-xs text-text-secondary">
                    {stats.partsCount} items sold
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                    <Wrench className="h-4 w-4 text-emerald-500" />
                    <span>Services & Labor Revenue</span>
                  </div>
                  <div className="text-lg font-bold text-text">
                    {money(stats.serviceRevenue)}
                  </div>
                  <span className="text-xs text-text-secondary">
                    {stats.serviceCount} services rendered
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab 2: Parts & Services Sale ───────────────────────────────────── */}
      {activeTab === 'parts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Parts & Services Sold</CardTitle>
              <p className="text-xs text-text-secondary mt-0.5">
                Detailed sales, cost, and profit performance for every catalog item
              </p>
            </div>
            <span className="text-xs text-text-muted">
              {stats.topItems.length} unique items sold
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topItems.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-sm">
                No parts or services sold during this time period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-y border-border text-text-secondary font-semibold">
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-center">Qty Sold</th>
                      <th className="py-2.5 px-4 text-right">Total Revenue</th>
                      <th className="py-2.5 px-4 text-right">Estimated Cost</th>
                      <th className="py-2.5 px-4 text-right">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {stats.topItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-text">
                          {item.name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={item.type === 'service' ? 'info' : 'default'}
                            className="text-[10px] capitalize"
                          >
                            {item.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-text">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-text">
                          {money(item.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-text-secondary">
                          {money(item.cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          {money(item.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab 3: Sales Breakdown (Payment Methods) ────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary flex items-center justify-between">
                <span>Cash Payments</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text">
                {money(stats.paymentMethods.cash.total)}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {stats.paymentMethods.cash.count} cash orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary flex items-center justify-between">
                <span>Card / POS</span>
                <CreditCard className="h-4 w-4 text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text">
                {money(stats.paymentMethods.card.total)}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {stats.paymentMethods.card.count} electronic card orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary flex items-center justify-between">
                <span>Credit / Account</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text">
                {money(stats.paymentMethods.credit.total)}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {stats.paymentMethods.credit.count} credit orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary flex items-center justify-between">
                <span>Other Methods</span>
                <FileText className="h-4 w-4 text-purple-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-text">
                {money(stats.paymentMethods.other.total)}
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {stats.paymentMethods.other.count} other orders
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab 4: Expenses & Costs Breakdown ─────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-rose-500/30">
              <CardContent className="p-4">
                <span className="text-xs font-medium text-text-muted">Total Expenses ({rangeTitle})</span>
                <div className="text-2xl font-bold text-rose-500 mt-1">
                  {money(stats.totalExpenses)}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {filteredExpenses.length} entries recorded for this store
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/30">
              <CardContent className="p-4">
                <span className="text-xs font-medium text-text-muted">Net Operating Profit</span>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    stats.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'
                  }`}
                >
                  {money(stats.netProfit)}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Sales minus Cost of Goods and Operating Expenses
                </p>
              </CardContent>
            </Card>

            <Card className="flex flex-col justify-between">
              <CardContent className="p-4 flex items-center justify-between h-full">
                <div>
                  <span className="text-xs font-medium text-text-muted">Manage Store Expenses</span>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Add new bills, rent, payroll or utilities
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/expenses')}
                  className="bg-rose-500 hover:bg-rose-600 text-white shrink-0 flex items-center gap-1.5"
                >
                  <Wallet className="h-4 w-4" />
                  Expenses Page
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Expenses by Category</CardTitle>
                <p className="text-xs text-text-secondary mt-0.5">
                  Operating expense breakdown for {rangeTitle}
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {expensesByCategory.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">
                  No expenses recorded for {rangeTitle}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-y border-border text-text-secondary font-semibold">
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-center">Count</th>
                        <th className="py-2.5 px-4 text-right">Total Amount</th>
                        <th className="py-2.5 px-4 text-right">% of Expenses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {expensesByCategory.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-text">{cat.category}</td>
                          <td className="py-3 px-4 text-center text-text-secondary">{cat.count}</td>
                          <td className="py-3 px-4 text-right font-bold text-rose-500">
                            {money(cat.total)}
                          </td>
                          <td className="py-3 px-4 text-right text-text-secondary">
                            {stats.totalExpenses > 0
                              ? ((cat.total / stats.totalExpenses) * 100).toFixed(1)
                              : '0'}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Clear Orders Confirmation Modal ───────────────────────────────── */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">Clear Orders & Reset Numbers</h3>
                <p className="text-xs text-text-secondary mt-0.5">Permanent Deletion Warning</p>
              </div>
            </div>

            <div className="text-sm text-text-secondary space-y-3">
              <p>
                This will delete all orders placed on the selected date and reset the order number sequence back to the <strong>last order number of the previous day</strong>.
              </p>
              
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                <label className="text-xs font-semibold text-text block">
                  Select Day to Clear:
                </label>
                <input
                  type="date"
                  value={clearDate}
                  onChange={(e) => setClearDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-card border border-border text-text outline-none"
                />
                <div className="text-xs text-text-muted">
                  Found <strong>{ordersOnClearDate.length} orders</strong> on this date ({money(ordersOnClearDate.reduce((sum, o) => sum + (o.total || 0), 0))}).
                </div>
              </div>

              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700">
                ⚠️ All transactions for this day will be removed from local database, Supabase cloud, and cache. Future order numbers will continue from the previous day&apos;s last order number.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setClearConfirmOpen(false)}
                disabled={clearing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearOrders}
                disabled={clearing || ordersOnClearDate.length === 0}
                className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {clearing ? 'Clearing Orders...' : `Yes, Clear ${ordersOnClearDate.length} Orders`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset ALL History Confirmation Modal ──────────────────────────────── */}
      {resetAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/15 text-red-600">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700">Reset ALL Order History</h3>
                <p className="text-xs text-text-secondary mt-0.5">⚠️ This cannot be undone</p>
              </div>
            </div>

            <div className="text-sm text-text-secondary space-y-3">
              <p>
                This will <strong>permanently delete every order</strong> from all time — Supabase cloud, local database, and browser cache.
              </p>
              <p>
                Order numbers will reset to <strong>#0000</strong>. The very next order created will be <strong>#0001</strong>.
              </p>
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-400/30 space-y-2">
                <label className="text-xs font-semibold text-red-800 block">
                  Type <span className="font-mono font-bold">RESET</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetAllConfirmText}
                  onChange={(e) => setResetAllConfirmText(e.target.value)}
                  placeholder="Type RESET here"
                  className="w-full text-sm p-2.5 rounded-lg bg-card border border-red-400/50 text-text outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => { setResetAllConfirmOpen(false); setResetAllConfirmText(''); }}
                disabled={resettingAll}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetAllOrders}
                disabled={resettingAll || resetAllConfirmText.trim().toUpperCase() !== 'RESET'}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 font-semibold"
              >
                <AlertTriangle className="h-4 w-4" />
                {resettingAll ? 'Resetting...' : 'Yes, Delete ALL Orders'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AutoCareReportsPage;
