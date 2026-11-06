import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  Download,
  AlertTriangle,
  FileText,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { pharmacyStorage } from './pharmacyData';

export function PharmacyReports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'valuation' | 'expiry' | 'profit-loss'>('sales');
  const [medicines] = useState(() => pharmacyStorage.getMedicines());
  const [suppliers] = useState(() => pharmacyStorage.getSuppliers());
  const [expenses] = useState(() => pharmacyStorage.getExpenses());
  const [purchases] = useState(() => pharmacyStorage.getPurchases());

  // Calculations
  const stockValuationCost = medicines.reduce((sum, m) => sum + m.stock * m.purchasePrice, 0);
  const stockValuationRetail = medicines.reduce((sum, m) => sum + m.stock * m.sellingPrice, 0);
  const grossInventoryMargin = stockValuationRetail - stockValuationCost;

  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const estimatedSales = 245000;
  const estimatedCOGS = 185000;
  const estimatedGrossProfit = estimatedSales - estimatedCOGS;
  const estimatedNetProfit = estimatedGrossProfit - totalMonthlyExpenses;

  const now = new Date();
  const nearExpiryMeds = medicines.filter((m) => {
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
          className={`px-4 py-2 rounded-xl transition ${
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
          className={`px-4 py-2 rounded-xl transition ${
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
          className={`px-4 py-2 rounded-xl transition ${
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
          className={`px-4 py-2 rounded-xl transition ${
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
              <span className="text-xs text-slate-400">Total Monthly Sales</span>
              <h3 className="text-2xl font-bold text-white mt-1">Rs. {estimatedSales.toLocaleString()}</h3>
              <p className="text-[11px] text-teal-400 mt-1">480 Total Invoices</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Average Prescription Basket</span>
              <h3 className="text-2xl font-bold text-white mt-1">Rs. 510.40</h3>
              <p className="text-[11px] text-slate-400 mt-1">2.4 items per transaction</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Cash vs Card Ratio</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">82% Cash / 18% Card</h3>
              <p className="text-[11px] text-slate-400 mt-1">Optimal retail liquidity</p>
            </div>
          </div>

          <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
            <h4 className="text-sm font-semibold text-white mb-3">Top Selling Pharmaceuticals</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/[0.06] pb-2">
                    <th className="pb-2 font-medium">Rank</th>
                    <th className="pb-2 font-medium">Medicine Name</th>
                    <th className="pb-2 font-medium">Manufacturer</th>
                    <th className="pb-2 font-medium">Monthly Units Sold</th>
                    <th className="pb-2 font-medium text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {medicines.slice(0, 5).map((med, idx) => (
                    <tr key={med.id} className="text-slate-300">
                      <td className="py-2.5 font-bold text-teal-400">#{idx + 1}</td>
                      <td className="py-2.5 font-medium text-white">{med.name}</td>
                      <td className="py-2.5 text-slate-400">{med.manufacturer}</td>
                      <td className="py-2.5">{140 - idx * 20} Packs</td>
                      <td className="py-2.5 text-right font-bold text-emerald-400">
                        Rs. {((140 - idx * 20) * med.sellingPrice).toLocaleString()}
                      </td>
                    </tr>
                  ))}
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
                Rs. {stockValuationCost.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Purchase acquisition valuation</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Inventory Retail Value</span>
              <h3 className="text-2xl font-bold text-teal-400 mt-1">
                Rs. {stockValuationRetail.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Maximum retail yield</p>
            </div>
            <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xs text-slate-400">Unrealized Gross Margin</span>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                Rs. {grossInventoryMargin.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {((grossInventoryMargin / (stockValuationRetail || 1)) * 100).toFixed(1)}% Markup
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
              <span className="font-bold text-white">Rs. {estimatedSales.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 text-slate-400 border-b border-white/[0.06] pb-2">
              <span>Less: Cost of Goods Sold (COGS):</span>
              <span className="text-rose-400">- Rs. {estimatedCOGS.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 font-bold text-teal-400 text-sm">
              <span>Gross Profit Margin:</span>
              <span>Rs. {estimatedGrossProfit.toLocaleString()}</span>
            </div>

            <div className="pt-2 border-t border-white/[0.06] text-slate-400">
              <span className="font-semibold text-white block mb-2">Operating Expenses Breakdown:</span>
              {expenses.map((e) => (
                <div key={e.id} className="flex justify-between py-0.5 text-[11px]">
                  <span>• {e.category} ({e.notes}):</span>
                  <span>Rs. {e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between py-1 text-slate-400 border-t border-white/[0.06] pt-2">
              <span>Total Operating Expenses:</span>
              <span className="text-rose-400">- Rs. {totalMonthlyExpenses.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-2 border-t-2 border-white/[0.1] font-bold text-base text-emerald-400">
              <span>Net Pharmacy Profit:</span>
              <span>Rs. {estimatedNetProfit.toLocaleString()}</span>
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
                .reduce((s, m) => s + m.stock * m.purchasePrice, 0)
                .toLocaleString()}
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
                {nearExpiryMeds.map((med) => (
                  <tr key={med.id} className="text-slate-300">
                    <td className="py-2.5 font-medium text-white">{med.name}</td>
                    <td className="py-2.5 font-mono">{med.batchNumber}</td>
                    <td className="py-2.5 text-amber-400 font-semibold">{med.expiryDate}</td>
                    <td className="py-2.5">{med.stock} Units</td>
                    <td className="py-2.5 text-right font-bold text-rose-400">
                      Rs. {(med.stock * med.purchasePrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyReports;
