import { useState } from 'react';
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Wallet,
  Building,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  pharmacyStorage,
  type PharmacyAccountRecord,
} from './pharmacyData';

export function PharmacyAccounts() {
  const [records, setRecords] = useState<PharmacyAccountRecord[]>(() => [
    {
      id: 'acc-01',
      date: '2026-11-06',
      type: 'Customer Payment',
      category: 'Prescription Sales',
      amount: 18450.0,
      method: 'Cash',
      reference: 'POS-CLOSING-06',
      notes: 'Daily counter retail sales cash collection',
    },
    {
      id: 'acc-02',
      date: '2026-11-05',
      type: 'Vendor Payment',
      category: 'Distributor Invoice',
      amount: 45000.0,
      method: 'Bank Transfer',
      reference: 'FT-994821',
      notes: 'Premier Pharma invoice payment via Meezan Bank',
    },
    {
      id: 'acc-03',
      date: '2026-11-03',
      type: 'Expense',
      category: 'Utilities',
      amount: 18450.0,
      method: 'Cash',
      reference: 'IESCO-BILL',
      notes: 'Electricity bill for cold storage',
    },
  ]);

  const [closingDone, setClosingDone] = useState(false);
  const [closingCash, setClosingCash] = useState(18450);

  const cashIn = records
    .filter((r) => r.type === 'Customer Payment' || r.type === 'Cash In')
    .reduce((sum, r) => sum + r.amount, 0);

  const cashOut = records
    .filter((r) => r.type === 'Vendor Payment' || r.type === 'Expense' || r.type === 'Cash Out')
    .reduce((sum, r) => sum + r.amount, 0);

  const handlePerformClosing = () => {
    setClosingDone(true);
    alert(`Daily Cash Closing Completed successfully! Net Cash Counted: Rs. ${closingCash.toLocaleString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark className="text-emerald-400" size={20} />
            <span>Payments & Cash Drawer Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cash drawer balance, daily closing, bank transfers, and receivables/payables reconciliation.
          </p>
        </div>
      </div>

      {/* KPI Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span>Total Cash In (Month)</span>
            <ArrowDownLeft size={16} />
          </div>
          <h3 className="text-2xl font-bold text-white mt-1">Rs. {cashIn.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Rx Counter Sales & Customer Dues</p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span>Total Outflow (Month)</span>
            <ArrowUpRight size={16} />
          </div>
          <h3 className="text-2xl font-bold text-rose-400 mt-1">Rs. {cashOut.toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Vendor Payments, Bills & Wages</p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-teal-400">
            <span>Estimated Register Cash</span>
            <Wallet size={16} />
          </div>
          <h3 className="text-2xl font-bold text-teal-300 mt-1">Rs. 24,500.00</h3>
          <p className="text-[11px] text-slate-400 mt-1">Ready for End-of-Day Closing</p>
        </div>
      </div>

      {/* Daily Cash Closing Drawer Tool */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle className="text-teal-400" size={16} />
              <span>End-of-Day Cash Drawer Closing</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify physical cash in drawer against POS sales before shifting to night staff.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#25252d] px-3 py-1.5 rounded-xl border border-white/[0.08]">
              <span className="text-xs text-slate-400">Counted Cash (Rs.):</span>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(parseFloat(e.target.value) || 0)}
                className="w-28 bg-transparent text-white font-bold text-xs focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handlePerformClosing}
              disabled={closingDone}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                closingDone
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#00897b] hover:bg-[#00897b]/90 text-white shadow-lg'
              }`}
            >
              {closingDone ? 'Drawer Closed ✓' : 'Confirm Daily Closing'}
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            Recent Accounts Ledger Entries
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Category / Ref</th>
                <th className="py-3 px-4 font-semibold">Method</th>
                <th className="py-3 px-4 font-semibold">Notes</th>
                <th className="py-3 px-4 font-semibold text-right">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {records.map((r) => {
                const isDebit = r.type === 'Customer Payment' || r.type === 'Cash In';
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 text-slate-400">{r.date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isDebit
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{r.category}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.reference}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{r.method}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{r.notes}</td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        isDebit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isDebit ? '+' : '-'} Rs. {r.amount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PharmacyAccounts;
