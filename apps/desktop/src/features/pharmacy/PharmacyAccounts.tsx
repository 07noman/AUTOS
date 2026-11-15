import { useState, useEffect } from 'react';
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
import { pharmacyDb, type PharmacyAccountRecord } from './pharmacyData';

export function PharmacyAccounts() {
  const [records, setRecords] = useState<PharmacyAccountRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [closingDone, setClosingDone] = useState(false);
  const [closingCash, setClosingCash] = useState(0);

  useEffect(() => {
    let mounted = true;
    pharmacyDb
      .getAccounts()
      .then((data) => {
        if (mounted) setRecords(data);
      })
      .catch((err) => console.error('[PharmacyAccounts] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

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

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    try {
      const created = await pharmacyDb.createAccount({
        date: formData.date || new Date().toISOString().split('T')[0],
        type: formData.type as any,
        category: formData.category || 'General',
        amount: formData.amount,
        method: formData.method as any,
        reference: formData.reference || `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        notes: formData.notes || '',
      });

      setRecords((prev) => [created, ...prev]);
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="text-[#00897b]" size={20} />
            <span>Payments & Cash Drawer Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cash drawer balance, daily closing, bank transfers, and receivables/payables reconciliation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Record Transaction</span>
        </button>
      </div>

      {/* KPI Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span>Total Cash In</span>
            <ArrowDownLeft size={16} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            Rs. {cashIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Customer & Counter Receipts</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700">
            <span>Total Outflow</span>
            <ArrowUpRight size={16} />
          </div>
          <h3 className="text-2xl font-bold text-rose-700 mt-1">
            Rs. {cashOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Vendor Payments & Operating Expenses</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-teal-700">
            <span>Current Net Balance</span>
            <Wallet size={16} />
          </div>
          <h3 className="text-2xl font-bold text-teal-800 mt-1">
            Rs. {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Physical Cash & Bank Reserves</p>
        </div>
      </div>

      {/* Daily Cash Closing Drawer Tool */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle className="text-[#00897b]" size={16} />
              <span>End-of-Day Cash Drawer Closing</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify physical cash in drawer against POS sales before shifting to night staff.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600">Counted Cash (Rs.):</span>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(parseFloat(e.target.value) || 0)}
                className="w-28 bg-transparent text-slate-900 font-bold text-xs focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handlePerformClosing}
              disabled={closingDone}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm ${
                closingDone
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-[#00897b] hover:bg-[#00897b]/90 text-white'
              }`}
            >
              {closingDone ? 'Drawer Closed ✓' : 'Confirm Daily Closing'}
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Accounts Ledger Entries ({records.length})
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Category / Ref</th>
                <th className="py-3 px-4 font-semibold">Method</th>
                <th className="py-3 px-4 font-semibold">Notes</th>
                <th className="py-3 px-4 font-semibold text-right">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-slate-500">No transactions recorded yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Transactions will appear automatically from sales, or you can record them manually.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isDebit = r.type === 'Customer Payment' || r.type === 'Cash In';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-500">{r.date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isDebit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900 font-medium">{r.category}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.reference}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.method}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{r.notes || '—'}</td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          isDebit ? 'text-emerald-700' : 'text-rose-700'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Record Cash / Bank Transaction</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Transaction Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                >
                  <option value="Customer Payment">Customer Payment / Sale</option>
                  <option value="Cash In">Cash In (Owner Deposit)</option>
                  <option value="Vendor Payment">Vendor Payment</option>
                  <option value="Expense">Expense</option>
                  <option value="Cash Out">Cash Out (Withdrawal)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Payment Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Category / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Counter Sale, Bank Deposit"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Reference / Voucher #</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-101, Bank Ref"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold shadow-sm transition"
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
