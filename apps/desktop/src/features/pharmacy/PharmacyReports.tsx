import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Download,
  AlertTriangle,
  Inbox,
  Calendar,
  DollarSign,
  ShoppingCart,
  Pill,
  ArrowUpRight,
  RotateCw,
} from 'lucide-react';
import {
  pharmacyDb,
  subscribeToPharmacyRealtime,
  getAuthBusinessId,
  type Medicine,
  type PharmacyExpense,
  type PharmacyAccountRecord,
  type PharmacySale,
  type PharmacySaleItem,
  type PurchaseOrder,
} from './pharmacyData';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export function PharmacyReports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'valuation' | 'profit-loss' | 'expiry'>('sales');
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');

  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [saleItems, setSaleItems] = useState<PharmacySaleItem[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [expenses, setExpenses] = useState<PharmacyExpense[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllReportData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [salesData, itemsData, medsData, expsData, purchData] = await Promise.all([
        pharmacyDb.getSales(),
        pharmacyDb.getAllSaleItems().catch(() => []),
        pharmacyDb.getMedicines(),
        pharmacyDb.getExpenses(),
        pharmacyDb.getPurchases(),
      ]);

      setSales(salesData);
      setSaleItems(itemsData);
      setMedicines(medsData);
      setExpenses(expsData);
      setPurchases(purchData);
    } catch (err) {
      console.error('[PharmacyReports] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadAllReportData();

    // Listen to window events
    const onSaleDone = () => void loadAllReportData();
    const onOrdersChanged = () => void loadAllReportData();
    window.addEventListener('pharmacy:sale-completed', onSaleDone);
    window.addEventListener('pharmacy:orders-changed', onOrdersChanged);

    // Supabase Realtime
    let unsubRealtime: () => void = () => {};
    void getAuthBusinessId()
      .then((bId) => {
        if (!mounted) return;
        unsubRealtime = subscribeToPharmacyRealtime(bId, (table) => {
          if (table === 'pharmacy_sales' || table === 'pharmacy_sale_items' || table === 'pharmacy_expenses') {
            void loadAllReportData();
          }
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
      window.removeEventListener('pharmacy:sale-completed', onSaleDone);
      window.removeEventListener('pharmacy:orders-changed', onOrdersChanged);
      unsubRealtime();
    };
  }, [loadAllReportData]);

  // Date filtering logic
  const now = new Date();
  const filteredSales = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'completed');

    if (dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
      return completed.filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= startOfDay && t <= endOfDay;
      });
    }

    if (dateFilter === 'week') {
      const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return completed.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
    }

    if (dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return completed.filter((s) => new Date(s.createdAt).getTime() >= startOfMonth);
    }

    return completed;
  }, [sales, dateFilter, now]);

  const filteredExpenses = useMemo(() => {
    if (dateFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      return expenses.filter((e) => e.date === todayStr);
    }
    if (dateFilter === 'week') {
      const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return expenses.filter((e) => new Date(e.date).getTime() >= cutoff);
    }
    if (dateFilter === 'month') {
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return expenses.filter((e) => e.date.startsWith(monthPrefix));
    }
    return expenses;
  }, [expenses, dateFilter, now]);

  // Metrics derived from live sales
  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  }, [filteredSales]);

  const totalInvoices = filteredSales.length;
  const avgBasket = totalInvoices > 0 ? totalSalesRevenue / totalInvoices : 0;

  // Filtered Sale Items
  const filteredSaleIdSet = useMemo(() => new Set(filteredSales.map((s) => s.id)), [filteredSales]);
  const currentPeriodItems = useMemo(
    () => saleItems.filter((it) => filteredSaleIdSet.has(it.saleId)),
    [saleItems, filteredSaleIdSet]
  );

  const totalUnitsSold = useMemo(() => {
    return currentPeriodItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [currentPeriodItems]);

  // COGS Calculation (from item purchase price or estimated 75%)
  const medPurchaseMap = useMemo(() => {
    return new Map(medicines.map((m) => [String(m.id), Number(m.purchasePrice || 0)]));
  }, [medicines]);

  const realCOGS = useMemo(() => {
    let cogs = 0;
    for (const it of currentPeriodItems) {
      const unitCost = medPurchaseMap.get(String(it.medicineId)) || Number(it.unitPrice || 0) * 0.7;
      cogs += unitCost * (Number(it.quantity) || 1);
    }
    // Fallback if no individual sale items found
    if (cogs === 0 && totalSalesRevenue > 0) {
      cogs = totalSalesRevenue * 0.7;
    }
    return cogs;
  }, [currentPeriodItems, medPurchaseMap, totalSalesRevenue]);

  const totalPeriodExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const grossProfit = Math.max(0, totalSalesRevenue - realCOGS);
  const netProfit = grossProfit - totalPeriodExpenses;

  // Inventory Asset Valuation (Total Active Inventory)
  const stockValuationCost = useMemo(() => {
    return medicines.reduce((sum, m) => sum + (Number(m.stock) || 0) * (Number(m.purchasePrice) || 0), 0);
  }, [medicines]);

  const stockValuationRetail = useMemo(() => {
    return medicines.reduce((sum, m) => sum + (Number(m.stock) || 0) * (Number(m.sellingPrice) || 0), 0);
  }, [medicines]);

  const grossInventoryMargin = Math.max(0, stockValuationRetail - stockValuationCost);

  // Near-expiry analysis
  const nearExpiryMeds = useMemo(() => {
    return medicines.filter((m) => {
      if (!m.expiryDate) return false;
      const diff = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 90;
    });
  }, [medicines, now]);

  const dateFilterLabel =
    dateFilter === 'today'
      ? "Today's"
      : dateFilter === 'week'
      ? 'This Week'
      : dateFilter === 'month'
      ? 'This Month'
      : 'All Time';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-[#00897b]" size={22} />
            <span>Pharmacy Reports & Financial Analytics</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Live Cloud Queries
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Auditing live sales revenue, prescription volumes, inventory valuation, and profit & loss.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Date Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((df) => (
              <button
                key={df.id}
                type="button"
                onClick={() => setDateFilter(df.id)}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  dateFilter === df.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadAllReportData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            title="Refresh from Supabase"
          >
            <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer font-semibold ${
            activeTab === 'sales'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Sales & Prescription Volume
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer font-semibold ${
            activeTab === 'valuation'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Stock Asset Valuation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profit-loss')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer font-semibold ${
            activeTab === 'profit-loss'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Profit & Loss Statement (P&L)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expiry')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer font-semibold ${
            activeTab === 'expiry'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Near-Expiry Risk Audit ({nearExpiryMeds.length})
        </button>
      </div>

      {/* Tab: Sales */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">{dateFilterLabel} Sales Revenue</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                Rs. {totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-teal-700 mt-1 font-medium">{totalInvoices} Orders Completed</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Average Basket Size</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                Rs. {avgBasket.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Average sale per invoice</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Medicines Dispensed</span>
              <h3 className="text-2xl font-bold text-[#00897b] mt-2">
                {totalUnitsSold} Units
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Across {totalInvoices} prescription sales</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Gross Margin Estimate</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-2">
                Rs. {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {totalSalesRevenue > 0 ? ((grossProfit / totalSalesRevenue) * 100).toFixed(1) + '% Margin' : '0%'}
              </p>
            </div>
          </div>

          {/* Sales List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>{dateFilterLabel} Invoices & Transactions ({filteredSales.length})</span>
              <span className="text-xs font-normal text-slate-500">Reading live from pharmacy_sales</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">Invoice #</th>
                    <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                    <th className="py-2.5 px-3 font-semibold">Customer / Patient</th>
                    <th className="py-2.5 px-3 font-semibold">Payment Method</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <ShoppingCart className="h-8 w-8 text-slate-300 mb-2" />
                          <p className="font-medium text-slate-600">No sales recorded for {dateFilterLabel.toLowerCase()}.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Dispense a medicine in Point of Sale to view transactions here.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => (
                      <tr key={s.id} className="text-slate-800 hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-bold text-[#00897b]">#{s.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(s.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{s.customerName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                            Completed
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          Rs. {Number(s.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stock Asset Valuation */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Inventory Cost Value</span>
              <h3 className="text-2xl font-bold text-indigo-700 mt-2">
                Rs. {stockValuationCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Acquisition cost of in-stock medicines</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Inventory Retail Value</span>
              <h3 className="text-2xl font-bold text-[#00897b] mt-2">
                Rs. {stockValuationRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Maximum retail yield at current prices</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Potential Gross Inventory Margin</span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-2">
                Rs. {grossInventoryMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {stockValuationRetail > 0
                  ? ((grossInventoryMargin / stockValuationRetail) * 100).toFixed(1) + '% Retail Markup'
                  : '0%'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-3">
              Medicines Inventory Assets Breakdown ({medicines.length} Registered Products)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">Medicine Name</th>
                    <th className="py-2.5 px-3 font-semibold">Dosage / Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">In Stock</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Retail Price</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Asset Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicines.map((m) => {
                    const totalAsset = (Number(m.stock) || 0) * (Number(m.sellingPrice) || 0);
                    return (
                      <tr key={m.id} className="text-slate-800 hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{m.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{m.dosageForm} • {m.category}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{m.stock}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">Rs. {Number(m.purchasePrice).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-[#00897b] font-bold">Rs. {Number(m.sellingPrice).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">Rs. {totalAsset.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Profit & Loss */}
      {activeTab === 'profit-loss' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Pharmacy Profit & Loss Statement (P&L)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Calculated for {dateFilterLabel.toLowerCase()} (Sales - Purchase Cost - Operating Expenses)</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 text-slate-700">
              <span className="font-semibold text-slate-900">Gross Sales Revenue:</span>
              <span className="font-bold text-slate-900 text-sm">
                Rs. {totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-500 border-b border-slate-100 pb-2">
              <span>Cost of Goods Sold (Medicines Purchase Cost):</span>
              <span className="text-rose-600 font-semibold">
                - Rs. {realCOGS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-1 font-bold text-[#00897b] text-sm">
              <span>Gross Profit Margin:</span>
              <span>Rs. {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 text-slate-600">
              <span className="font-semibold text-slate-900 block mb-2">Operating Expenses Breakdown:</span>
              {filteredExpenses.length === 0 ? (
                <p className="text-slate-400 italic">No operating expenses recorded for this period.</p>
              ) : (
                filteredExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between py-0.5 text-[11px]">
                    <span>• {e.category} {e.notes ? `(${e.notes})` : ''}:</span>
                    <span className="font-medium text-slate-700">Rs. {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between py-1 text-slate-600 border-t border-slate-100 pt-2">
              <span className="font-semibold">Total Operating Expenses:</span>
              <span className="text-rose-600 font-bold">
                - Rs. {totalPeriodExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-3 border-t-2 border-slate-200 font-bold text-base text-slate-900">
              <span>Net Pharmacy Profit / (Loss):</span>
              <span className={netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                Rs. {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Expiry Audit */}
      {activeTab === 'expiry' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              <span>Near-Expiry & Critical Expiry Audit (90 Days FEFO Window)</span>
            </h4>
            <span className="text-xs text-slate-500">{nearExpiryMeds.length} Batches Requiring Attention</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                  <th className="py-2.5 px-3 font-semibold">Medicine</th>
                  <th className="py-2.5 px-3 font-semibold">Batch #</th>
                  <th className="py-2.5 px-3 font-semibold">Expiry Date</th>
                  <th className="py-2.5 px-3 font-semibold">Days Remaining</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Units in Stock</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Potential Financial Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nearExpiryMeds.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center">
                        <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="font-medium text-slate-600">No medicines near expiry within 90 days.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  nearExpiryMeds.map((m) => {
                    const diff = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const lossAtRisk = (Number(m.stock) || 0) * (Number(m.purchasePrice) || 0);
                    return (
                      <tr key={m.id} className="text-slate-800 hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{m.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{m.batchNumber || '—'}</td>
                        <td className="py-2.5 px-3 font-semibold text-rose-600">{m.expiryDate}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            diff <= 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {diff <= 0 ? 'EXPIRED' : `${diff} days`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{m.stock}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          Rs. {lossAtRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyReports;
