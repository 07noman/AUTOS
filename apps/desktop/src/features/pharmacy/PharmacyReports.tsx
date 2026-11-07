import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Download,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import { pharmacyStorage } from './pharmacyData';

export function PharmacyReports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'valuation' | 'expiry' | 'profit-loss'>('sales');
  const [medicines] = useState(() => pharmacyStorage.getMedicines());
  const [expenses] = useState(() => pharmacyStorage.getExpenses());
  const [accounts] = useState(() => pharmacyStorage.getAccounts());

  // Real calculations
  const stockValuationCost = medicines.reduce((sum, m) => sum + (Number(m.stock) || 0) * (Number(m.purchasePrice) || 0), 0);
  const stockValuationRetail = medicines.reduce((sum, m) => sum + (Number(m.stock) || 0) * (Number(m.sellingPrice) || 0), 0);
  const grossInventoryMargin = Math.max(0, stockValuationRetail - stockValuationCost);

  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Real Sales from accounts
  const salesRecords = accounts.filter((a) => a.type === 'Customer Payment');
  const realSalesRevenue = salesRecords.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalSalesCount = salesRecords.length;
  const avgBasket = totalSalesCount > 0 ? realSalesRevenue / totalSalesCount : 0;

  // Real COGS estimated from margins
  const estimatedCOGS = realSalesRevenue * 0.75;
  const grossProfit = Math.max(0, realSalesRevenue - estimatedCOGS);
  const netProfit = grossProfit - totalMonthlyExpenses;

  const now = new Date();
  const nearExpiryMeds = medicines.filter((m) => {
    if (!m.expiryDate) return false;
    const diff = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 90;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-teal-400" size={20} />
            <span>Pharmacy Reports & Financial Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Audit pharmacy performance, inventory asset valuation, and drug expiry loss statements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/[0.08] transition self-start sm:self-auto cursor-pointer"
        >
          <Download size={14} />
          <span>Export / Print Report</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'sales'
              ? 'bg-[#00897b] text-white font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Sales & Medicine Volume
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'valuation'
              ? 'bg-[#00897b] text-white font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Stock Asset Valuation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profit-loss')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'profit-loss'
              ? 'bg-[#00897b] text-white font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Profit & Loss Statement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expiry')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'expiry'
              ? 'bg-[#00897b] text-white font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Near-Expiry Risk Audit ({nearExpiryMeds.length})
        </button>
      </div>

      {/* Tab: Sales */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Total Sales Revenue</span>
              <h3 className="text-2xl font-bold text-white mt-1">
                Rs. {realSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-teal-400 mt-1">{totalSalesCount} Total Invoices</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Average Basket Size</span>
              <h3 className="text-2xl font-bold text-white mt-1">
                Rs. {avgBasket.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Based on logged orders</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Total Prescriptions</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{totalSalesCount} Invoices</h3>
              <p className="text-[11px] text-slate-400 mt-1">Point of Sale register receipts</p>
            </div>
          </div>

          <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-semibold text-white mb-3">Registered Pharmaceutical Products ({medicines.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/[0.06] pb-2">
                    <th className="pb-2 font-medium">Rank</th>
                    <th className="pb-2 font-medium">Medicine Name</th>
                    <th className="pb-2 font-medium">Manufacturer</th>
                    <th className="pb-2 font-medium">Current Stock</th>
                    <th className="pb-2 font-medium text-right">Retail Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {medicines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <Inbox className="h-8 w-8 text-slate-600 mb-2" />
                          <p>No medicines logged in inventory yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    medicines.map((med, idx) => (
                      <tr key={med.id} className="text-slate-300">
                        <td className="py-2.5 font-bold text-teal-400">#{idx + 1}</td>
                        <td className="py-2.5 font-medium text-white">{med.name}</td>
                        <td className="py-2.5 text-slate-400">{med.manufacturer || '—'}</td>
                        <td className="py-2.5">{med.stock} Units</td>
                        <td className="py-2.5 text-right font-bold text-emerald-400">
                          Rs. {Number(med.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

      {/* Tab: Stock Valuation */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Inventory Cost Value</span>
              <h3 className="text-2xl font-bold text-indigo-400 mt-1">
                Rs. {stockValuationCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Purchase acquisition valuation</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Inventory Retail Value</span>
              <h3 className="text-2xl font-bold text-teal-400 mt-1">
                Rs. {stockValuationRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Maximum retail yield</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Potential Gross Margin</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                Rs. {grossInventoryMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {stockValuationRetail > 0
                  ? ((grossInventoryMargin / stockValuationRetail) * 100).toFixed(1) + '% Markup'
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Profit & Loss */}
      {activeTab === 'profit-loss' && (
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-6 shadow-xl max-w-2xl mx-auto space-y-4">
          <h3 className="text-base font-bold text-white border-b border-white/[0.08] pb-3">
            Pharmacy Monthly Profit & Loss Statement (P&L)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 text-slate-300">
              <span className="font-semibold text-white">Gross Sales Revenue:</span>
              <span className="font-bold text-white">
                Rs. {realSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-400 border-b border-white/[0.06] pb-2">
              <span>Estimated Cost of Goods Sold (COGS):</span>
              <span className="text-rose-400">
                - Rs. {estimatedCOGS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-1 font-bold text-teal-400 text-sm">
              <span>Gross Profit Margin:</span>
              <span>Rs. {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] text-slate-400">
              <span className="font-semibold text-white block mb-2">Operating Expenses Breakdown:</span>
              {expenses.length === 0 ? (
                <p className="text-slate-500 italic">No operating expenses recorded yet.</p>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} className="flex justify-between py-0.5 text-[11px]">
                    <span>• {e.category} {e.notes ? `(${e.notes})` : ''}:</span>
                    <span>Rs. {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between py-1 text-slate-400 border-t border-white/[0.06] pt-2">
              <span>Total Operating Expenses:</span>
              <span className="text-rose-400">
                - Rs. {totalMonthlyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-white/[0.1] font-bold text-base text-emerald-400">
              <span>Net Pharmacy Profit / (Loss):</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                Rs. {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Expiry Audit */}
      {activeTab === 'expiry' && (
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>Near-Expiry Risk Audit (≤90 Days Remaining)</span>
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Total Potential Financial Risk:{' '}
            <span className="text-amber-400 font-bold">
              Rs.{' '}
              {nearExpiryMeds
                .reduce((s, m) => s + (Number(m.stock) || 0) * (Number(m.purchasePrice) || 0), 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/[0.06] pb-2">
                  <th className="pb-2 font-medium">Medicine</th>
                  <th className="pb-2 font-medium">Batch</th>
                  <th className="pb-2 font-medium">Expiry Date</th>
                  <th className="pb-2 font-medium">Stock</th>
                  <th className="pb-2 font-medium text-right">Valuation at Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {nearExpiryMeds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center">
                        <Inbox className="h-8 w-8 text-slate-600 mb-2" />
                        <p>No medicines near expiry.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  nearExpiryMeds.map((med) => (
                    <tr key={med.id} className="text-slate-300">
                      <td className="py-2.5 font-medium text-white">{med.name}</td>
                      <td className="py-2.5 font-mono">{med.batchNumber || '—'}</td>
                      <td className="py-2.5 text-amber-400 font-semibold">{med.expiryDate}</td>
                      <td className="py-2.5">{med.stock} Units</td>
                      <td className="py-2.5 text-right font-bold text-rose-400">
                        Rs.{' '}
                        {((Number(med.stock) || 0) * (Number(med.purchasePrice) || 0)).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
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
