import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  CalendarClock,
  ShoppingCart,
  PlusCircle,
  Truck,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import {
  pharmacyDb,
  type Medicine,
  type Supplier,
  type PharmacyExpense,
  type PharmacyAccountRecord,
} from './pharmacyData';

export function PharmacyDashboard() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<PharmacyExpense[]>([]);
  const [accounts, setAccounts] = useState<PharmacyAccountRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      pharmacyDb.getMedicines(),
      pharmacyDb.getSuppliers(),
      pharmacyDb.getExpenses(),
      pharmacyDb.getAccounts(),
    ])
      .then(([meds, sups, exps, accs]) => {
        if (mounted) {
          setMedicines(meds);
          setSuppliers(sups);
          setExpenses(exps);
          setAccounts(accs);
        }
      })
      .catch((err) => console.error('[PharmacyDashboard] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Metrics computation from real user data only
  const metrics = useMemo(() => {
    const totalMedicines = medicines.length;
    const totalUnits = medicines.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
    const inventoryValuation = medicines.reduce(
      (sum, m) => sum + (Number(m.stock) || 0) * (Number(m.purchasePrice) || 0),
      0
    );
    const potentialSalesValue = medicines.reduce(
      (sum, m) => sum + (Number(m.stock) || 0) * (Number(m.sellingPrice) || 0),
      0
    );

    const lowStockItems = medicines.filter((m) => m.stock > 0 && m.stock <= m.minStockLevel);
    const outOfStockItems = medicines.filter((m) => m.stock <= 0);

    const now = new Date();
    const ninetyDays = new Date();
    ninetyDays.setDate(now.getDate() + 90);

    const nearExpiryItems = medicines.filter((m) => {
      if (!m.expiryDate) return false;
      const exp = new Date(m.expiryDate);
      return exp > now && exp <= ninetyDays;
    });

    const expiredItems = medicines.filter((m) => {
      if (!m.expiryDate) return false;
      const exp = new Date(m.expiryDate);
      return exp <= now;
    });

    const totalPayables = suppliers.reduce((sum, s) => sum + (Number(s.outstandingBalance) || 0), 0);
    const totalMonthlyExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Real daily sales from accounts
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = accounts
      .filter((a) => a.type === 'Customer Payment' && a.date === todayStr)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    const todayOrderCount = accounts.filter(
      (a) => a.type === 'Customer Payment' && a.date === todayStr
    ).length;

    return {
      totalMedicines,
      totalUnits,
      inventoryValuation,
      potentialSalesValue,
      nearExpiryCount: nearExpiryItems.length,
      expiredCount: expiredItems.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      totalPayables,
      totalMonthlyExpense,
      nearExpiryItems,
      lowStockItems,
      todaySales,
      todayOrderCount,
    };
  }, [medicines, suppliers, expenses, accounts]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Pharmacy Overview</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              Live Store
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time medicine inventory, FEFO batch tracking, and sales analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/pharmacy/pos')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition"
          >
            <ShoppingCart size={15} />
            <span>Launch POS</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/medicines')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition"
          >
            <PlusCircle size={15} />
            <span>Add Medicine</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/purchases')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition"
          >
            <Truck size={15} />
            <span>New Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Today's Rx Sales</span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">
              Rs. {metrics.todaySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {metrics.todayOrderCount} orders logged today
            </p>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Stock Valuation (Cost)</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Package size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">
              Rs. {metrics.inventoryValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {metrics.totalMedicines} Products ({metrics.totalUnits} Units)
            </p>
          </div>
        </div>

        {/* Near Expiry / FEFO alert */}
        <div
          onClick={() => navigate('/pharmacy/expiry-batch')}
          className="bg-white border border-amber-300 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:border-amber-400 shadow-sm transition"
        >
          <div className="flex items-center justify-between text-amber-700 text-xs">
            <span>Near Expiry (90 Days)</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <CalendarClock size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-amber-800">
              {metrics.nearExpiryCount} Batches
            </h3>
            <p className="text-[11px] text-amber-700/80 mt-1">
              {metrics.nearExpiryCount > 0 ? 'Requires FEFO clearance' : 'No near-expiry items'}
            </p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => navigate('/pharmacy/medicines')}
          className="bg-white border border-rose-300 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:border-rose-400 shadow-sm transition"
        >
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span>Low / Out of Stock</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-rose-800">
              {metrics.lowStockCount + metrics.outOfStockCount} Items
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {metrics.lowStockCount + metrics.outOfStockCount > 0 ? 'Reorder purchase needed' : 'Stock levels healthy'}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Section: FEFO Critical Alerts + Recent Medicine Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Near Expiry Critical Alert Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-amber-600 h-4 w-4" />
              <h4 className="text-sm font-bold text-slate-900">FEFO Expiry Warnings</h4>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pharmacy/expiry-batch')}
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              View All Batches
            </button>
          </div>

          {metrics.nearExpiryItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 flex flex-col items-center">
              <Inbox className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs">No medicines near expiry.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 pb-2">
                    <th className="pb-2 font-semibold">Medicine</th>
                    <th className="pb-2 font-semibold">Batch</th>
                    <th className="pb-2 font-semibold">Stock</th>
                    <th className="pb-2 font-semibold">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.nearExpiryItems.slice(0, 4).map((item) => (
                    <tr key={item.id} className="text-slate-700 hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{item.name}</td>
                      <td className="py-2.5 text-slate-500">{item.batchNumber}</td>
                      <td className="py-2.5 text-slate-600">{item.stock} left</td>
                      <td className="py-2.5 text-amber-700 font-semibold">{item.expiryDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Reorder List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-rose-600 h-4 w-4" />
              <h4 className="text-sm font-bold text-slate-900">Low Stock Reorder Alert</h4>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pharmacy/medicines')}
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              Adjust Stock
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Medicine</th>
                  <th className="pb-2 font-semibold">Form / Strength</th>
                  <th className="pb-2 font-semibold">Current</th>
                  <th className="pb-2 font-semibold">Min Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center">
                        <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-xs">All inventory stock levels are healthy.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  metrics.lowStockItems.map((item) => (
                    <tr key={item.id} className="text-slate-700 hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{item.name}</td>
                      <td className="py-2.5 text-slate-500">
                        {item.dosageForm} ({item.strength})
                      </td>
                      <td className="py-2.5 text-rose-600 font-bold">{item.stock}</td>
                      <td className="py-2.5 text-slate-500">{item.minStockLevel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary Row: Payables & Operating Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Supplier Payables</span>
            <Truck size={14} className="text-teal-600" />
          </div>
          <p className="text-lg font-bold text-slate-900 mt-2">
            Rs. {metrics.totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{suppliers.length} Active distributors</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Monthly Pharmacy Expenses</span>
            <DollarSign size={14} className="text-rose-600" />
          </div>
          <p className="text-lg font-bold text-slate-900 mt-2">
            Rs. {metrics.totalMonthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{expenses.length} Expense records</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Potential Profit Margin</span>
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-600 mt-2">
            Rs.{' '}
            {(metrics.potentialSalesValue - metrics.inventoryValuation).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Estimated gross retail margin</p>
        </div>
      </div>
    </div>
  );
}

export default PharmacyDashboard;
