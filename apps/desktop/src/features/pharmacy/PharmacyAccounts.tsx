import { useState } from 'react';
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CheckCircle,
  Inbox,
  X,
} from 'lucide-react';
import { pharmacyStorage, type PharmacyAccountRecord } from './pharmacyData';

export function PharmacyAccounts() {
  const [records, setRecords] = useState<PharmacyAccountRecord[]>(() =>
    pharmacyStorage.getAccounts()
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [closingDone, setClosingDone] = useState(false);
  const [closingCash, setClosingCash] = useState(0);

  const [formData, setFormData] = useState<Partial<PharmacyAccountRecord>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Customer Payment',
    category: 'Counter Sale',
    amount: 0,
    method: 'Cash',
    reference: '',
    notes: '',
  });

  const cashIn = records
    .filter((r) => r.type === 'Customer Payment' || r.type === 'Cash In')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const cashOut = records
    .filter((r) => r.type === 'Vendor Payment' || r.type === 'Expense' || r.type === 'Cash Out')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const netBalance = cashIn - cashOut;

  const handlePerformClosing = () => {
    setClosingDone(true);
    alert(`Daily Cash Closing Completed! Counted Cash: Rs. ${closingCash.toLocaleString()}`);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    const newRecord: PharmacyAccountRecord = {
      id: `acc-${Date.now()}`,
      date: formData.date || new Date().toISOString().split('T')[0],
      type: formData.type as any,
      category: formData.category || 'General',
      amount: formData.amount,
      method: formData.method as any,
      reference: formData.reference || `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: formData.notes || '',
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    pharmacyStorage.saveAccounts(updated);
    setModalOpen(false);
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

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Record Transaction</span>
        </button>
      </div>

      {/* KPI Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span>Total Cash In</span>
            <ArrowDownLeft size={16} />
          </div>
          <h3 className="text-2xl font-bold text-white mt-1">
            Rs. {cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Customer & Counter Receipts</p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span>Total Outflow</span>
            <ArrowUpRight size={16} />
          </div>
          <h3 className="text-2xl font-bold text-rose-400 mt-1">
            Rs. {cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Vendor Payments & Operating Expenses</p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-teal-400">
            <span>Current Net Balance</span>
            <Wallet size={16} />
          </div>
          <h3 className="text-2xl font-bold text-teal-300 mt-1">
            Rs. {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Physical Cash & Bank Reserves</p>
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
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
            Accounts Ledger Entries ({records.length})
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
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <Inbox className="h-8 w-8 text-slate-600 mb-2" />
                      <p>No transactions recorded yet.</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Transactions will appear automatically from sales, or you can record them manually.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
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
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{r.notes || '—'}</td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          isDebit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isDebit ? '+' : '-'} Rs. {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Transaction Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Record Cash / Bank Transaction</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Transaction Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="Customer Payment">Customer Payment / Sale</option>
                  <option value="Cash In">Cash In (Owner Deposit)</option>
                  <option value="Vendor Payment">Vendor Payment</option>
                  <option value="Expense">Expense</option>
                  <option value="Cash Out">Cash Out (Withdrawal)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Payment Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Category / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Counter Sale, Bank Deposit"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reference / Voucher #</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-101, Bank Ref"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyAccounts;
