import { useState } from 'react';
import {
  Wallet,
  Plus,
  DollarSign,
  Calendar,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  pharmacyStorage,
  type PharmacyExpense,
} from './pharmacyData';

export function PharmacyExpenses() {
  const [expenses, setExpenses] = useState<PharmacyExpense[]>(() =>
    pharmacyStorage.getExpenses()
  );
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<PharmacyExpense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'Electricity/Utility',
    amount: 0,
    method: 'Cash',
    notes: '',
    loggedBy: 'Admin',
  });

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    const newExp: PharmacyExpense = {
      id: `exp-${Date.now()}`,
      date: formData.date || new Date().toISOString().split('T')[0],
      category: formData.category as any,
      amount: formData.amount,
      method: formData.method as any,
      notes: formData.notes || '',
      loggedBy: formData.loggedBy || 'Admin',
    };

    const updated = [newExp, ...expenses];
    setExpenses(updated);
    pharmacyStorage.saveExpenses(updated);
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this expense record?')) {
      const updated = expenses.filter((e) => e.id !== id);
      setExpenses(updated);
      pharmacyStorage.saveExpenses(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="text-rose-400" size={20} />
            <span>Pharmacy Operating Expenses</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track daily operating costs, store rent, refrigeration power, staff salary, and supplies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Expenses Logged</span>
          <h3 className="text-2xl font-bold text-rose-400 mt-1">Rs. {totalExpense.toLocaleString()}</h3>
        </div>
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Largest Cost Center</span>
          <h3 className="text-2xl font-bold text-white mt-1">Rent & Electricity</h3>
        </div>
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Entries</span>
          <h3 className="text-2xl font-bold text-teal-400 mt-1">{expenses.length} Records</h3>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Notes / Purpose</th>
                <th className="py-3 px-4 font-semibold">Payment Mode</th>
                <th className="py-3 px-4 font-semibold">Logged By</th>
                <th className="py-3 px-4 font-semibold">Amount (Rs.)</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4 text-slate-400">{e.date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] font-medium border border-white/[0.06] text-white">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-sm">{e.notes}</td>
                  <td className="py-3 px-4 text-slate-400">{e.method}</td>
                  <td className="py-3 px-4 text-slate-400">{e.loggedBy}</td>
                  <td className="py-3 px-4 font-bold text-rose-400">Rs. {e.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Record Operating Expense</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Expense Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="Electricity/Utility">Electricity / Utility Bill</option>
                  <option value="Rent">Shop Rent</option>
                  <option value="Salary">Staff & Pharmacist Salary</option>
                  <option value="Refrigeration">Cold Storage / Fridge Maintenance</option>
                  <option value="Packaging">Paper Bags & Prescription Envelopes</option>
                  <option value="Maintenance">Shop Maintenance / Cleaning</option>
                  <option value="Other">Other Expenses</option>
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
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank">Bank Account</option>
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
                <label className="block text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Electric bill payment, invoice #..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white"
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
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyExpenses;
