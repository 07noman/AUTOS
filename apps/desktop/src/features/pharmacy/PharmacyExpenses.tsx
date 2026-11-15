import { useState, useEffect } from 'react';
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
  pharmacyDb,
  type PharmacyExpense,
} from './pharmacyData';

export function PharmacyExpenses() {
  const [expenses, setExpenses] = useState<PharmacyExpense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    pharmacyDb
      .getExpenses()
      .then((data) => {
        if (mounted) setExpenses(data);
      })
      .catch((err) => console.error('[PharmacyExpenses] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  const [formData, setFormData] = useState<Partial<PharmacyExpense>>({
    date: new Date().toISOString().split('T')[0],
    category: 'Electricity/Utility',
    amount: 0,
    method: 'Cash',
    notes: '',
    loggedBy: 'Admin',
  });

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    try {
      const created = await pharmacyDb.createExpense({
        date: formData.date || new Date().toISOString().split('T')[0],
        category: formData.category as any,
        amount: formData.amount,
        method: formData.method as any,
        notes: formData.notes || '',
        loggedBy: formData.loggedBy || 'Admin',
      });

      setExpenses((prev) => [created, ...prev]);
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this expense record?')) {
      try {
        await pharmacyDb.deleteExpense(id);
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } catch (err: any) {
        alert(err.message || 'Failed to save, check internet');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="text-[#00897b]" size={20} />
            <span>Pharmacy Operating Expenses</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track daily operating costs, store rent, refrigeration power, staff salary, and supplies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500">Total Expenses Logged</span>
          <h3 className="text-2xl font-bold text-rose-700 mt-1">Rs. {totalExpense.toLocaleString()}</h3>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500">Largest Cost Center</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">Rent & Electricity</h3>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500">Total Entries</span>
          <h3 className="text-2xl font-bold text-teal-800 mt-1">{expenses.length} Records</h3>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Notes / Purpose</th>
                <th className="py-3 px-4 font-semibold">Payment Mode</th>
                <th className="py-3 px-4 font-semibold">Logged By</th>
                <th className="py-3 px-4 font-semibold">Amount (Rs.)</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No operating expenses recorded yet. Click '+ Add Expense' to log costs.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-500">{e.date}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium border border-slate-200 text-slate-700">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-sm">{e.notes}</td>
                    <td className="py-3 px-4 text-slate-500">{e.method}</td>
                    <td className="py-3 px-4 text-slate-500">{e.loggedBy}</td>
                    <td className="py-3 px-4 font-bold text-rose-700">Rs. {e.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Record Operating Expense</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Expense Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
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
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank">Bank Account</option>
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
                <label className="block text-slate-700 font-medium mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Electric bill payment, invoice #..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
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
