import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  TrendingDown,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  Tag,
} from 'lucide-react';
import { safeUUID } from '@/lib/uuid';
import { expenseRepo, type Expense, getCurrentStoreId } from '@/lib/expenses-repo';
import { useAuth } from '@/hooks/useAuth';

const CATEGORIES = [
  'Rent',
  'Salary',
  'Utility',
  'Fuel',
  'Maintenance',
  'Tea / Food',
  'Supplies',
  'Marketing',
  'Repair',
  'Other',
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa', 'Card', 'Other'];

export function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [storeId, setStoreId] = useState<string>(() => getCurrentStoreId());

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Other',
    amount: '',
    payment_method: 'Cash',
    description: '',
  });

  // Filter States
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year'>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Keep storeId in sync with localStorage changes
  useEffect(() => {
    const handleStorage = () => {
      const active = getCurrentStoreId();
      if (active !== storeId) {
        setStoreId(active);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storeId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const activeStore = getCurrentStoreId();
      setStoreId(activeStore);
      const data = await expenseRepo.findAll(activeStore);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      showNotification('Could not load expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
  }, [storeId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(form.amount);
    if (!form.amount || isNaN(numAmount) || numAmount <= 0) {
      showNotification('Please enter a valid expense amount greater than 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const activeStore = getCurrentStoreId();
      const newExp = await expenseRepo.create({
        id: safeUUID(),
        store_id: activeStore,
        date: form.date,
        category: form.category,
        amount: numAmount,
        payment_method: form.payment_method,
        description: form.description.trim() || undefined,
        added_by: user?.email || user?.name || 'Staff',
      });

      setExpenses((prev) => [newExp, ...prev.filter((item) => item.id !== newExp.id)]);
      setForm({
        date: new Date().toISOString().split('T')[0],
        category: 'Other',
        amount: '',
        payment_method: 'Cash',
        description: '',
      });
      showNotification('Expense added successfully!', 'success');
    } catch (err) {
      console.error('Error adding expense:', err);
      showNotification('Failed to add expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      const activeStore = getCurrentStoreId();
      await expenseRepo.delete(id, activeStore);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      showNotification('Expense deleted', 'success');
    } catch (err) {
      console.error('Error deleting expense:', err);
      showNotification('Failed to delete expense', 'error');
    }
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYearMonth = todayStr.substring(0, 7); // YYYY-MM
    const currentYear = todayStr.substring(0, 4); // YYYY

    return expenses.filter((item) => {
      // Date filter
      if (dateFilter === 'today' && item.date !== todayStr) return false;
      if (dateFilter === 'month' && !item.date.startsWith(currentYearMonth)) return false;
      if (dateFilter === 'year' && !item.date.startsWith(currentYear)) return false;

      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // Payment method filter
      if (methodFilter !== 'all' && item.payment_method !== methodFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const catMatch = item.category.toLowerCase().includes(q);
        const byMatch = (item.added_by || '').toLowerCase().includes(q);
        const amountMatch = String(item.amount).includes(q);
        if (!descMatch && !catMatch && !byMatch && !amountMatch) return false;
      }

      return true;
    });
  }, [expenses, dateFilter, categoryFilter, methodFilter, searchQuery]);

  // Financial KPI calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const todayTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.date === todayStr)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses, todayStr]
  );

  const monthTotal = useMemo(
    () =>
      expenses
        .filter((e) => (e.date || '').startsWith(currentMonthStr))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses, currentMonthStr]
  );

  const allTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );

  const money = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#0f172a] min-h-screen text-slate-100 font-sans">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Expenses
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-700 text-teal-400 border border-slate-600">
                  CORE MODULE
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Track, categorize and control daily operating costs for this store
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Store:</span>
            <strong className="text-teal-400">{storeId}</strong>
          </div>

          <button
            onClick={() => void loadExpenses()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Toast Notification ──────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 border animate-in fade-in transition ${
            notification.type === 'error'
              ? 'bg-red-950/80 border-red-800 text-red-200'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── 3 Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Expense */}
        <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-xl shadow-md hover:border-slate-600 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Today's Expense</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{money(todayTotal)}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {expenses.filter((e) => e.date === todayStr).length} transactions logged today
          </p>
        </div>

        {/* Month Total */}
        <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-xl shadow-md hover:border-slate-600 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Month Total</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-400 mt-2">{money(monthTotal)}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Current calendar month accumulated costs
          </p>
        </div>

        {/* All Time / Total Expenses */}
        <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-xl shadow-md hover:border-slate-600 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Expenses</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-2">{money(allTotal)}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {expenses.length} total entries in store database
          </p>
        </div>
      </div>

      {/* ── Add Expense Card ─────────────────────────────────────────────────── */}
      <div className="bg-slate-800/95 border border-slate-700 p-4 sm:p-5 rounded-xl shadow-md">
        <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-teal-400" />
          Add New Expense
        </h2>

        <form onSubmit={handleAddExpense} className="flex flex-wrap items-center gap-2.5">
          {/* Date */}
          <div className="flex-1 min-w-[140px]">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-slate-700/90 border border-slate-600 px-3 py-2 text-sm rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              required
            />
          </div>

          {/* Category */}
          <div className="flex-1 min-w-[150px]">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-slate-700/90 border border-slate-600 px-3 py-2 text-sm rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="w-32">
            <input
              type="number"
              step="any"
              min="0.01"
              placeholder="Amount (Rs)"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full bg-slate-700/90 border border-slate-600 px-3 py-2 text-sm rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 font-medium"
              required
            />
          </div>

          {/* Payment Method */}
          <div className="w-32">
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className="w-full bg-slate-700/90 border border-slate-600 px-3 py-2 text-sm rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex-[2] min-w-[180px]">
            <input
              type="text"
              placeholder="Description / Remarks (e.g. Shop electric bill)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-700/90 border border-slate-600 px-3 py-2 text-sm rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-900 font-bold px-6 py-2 rounded-lg text-sm shadow-md transition disabled:opacity-50 shrink-0 flex items-center gap-1.5"
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Expense
          </button>
        </form>
      </div>

      {/* ── Filter & Search Toolbar ─────────────────────────────────────────── */}
      <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>

          {/* Period Filter buttons */}
          {(['month', 'today', 'year', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setDateFilter(period)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                dateFilter === period
                  ? 'bg-teal-500 text-slate-900 font-bold shadow'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {period === 'month'
                ? 'This Month'
                : period === 'today'
                ? 'Today'
                : period === 'year'
                ? 'This Year'
                : 'All Time'}
            </button>
          ))}

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-700/80 border border-slate-600 px-2.5 py-1 text-xs rounded-lg text-slate-200 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-slate-700/80 border border-slate-600 px-2.5 py-1 text-xs rounded-lg text-slate-200 focus:outline-none"
          >
            <option value="all">All Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700/90 border border-slate-600 pl-8 pr-3 py-1 text-xs rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800">
          <div className="text-xs text-slate-300">
            Showing <strong>{filteredExpenses.length}</strong> of <strong>{expenses.length}</strong>{' '}
            expenses
            {filteredExpenses.length > 0 && (
              <span className="ml-2 text-teal-400 font-semibold">
                (Filtered Total: {money(filteredTotal)})
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-700/90 text-xs uppercase text-slate-300 border-b border-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold">Payment Method</th>
                <th className="py-3 px-4 font-semibold">Added By</th>
                <th className="py-3 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-teal-400" />
                    Loading expenses for store...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                    <Wallet className="h-8 w-8 mx-auto mb-2 text-slate-500 opacity-50" />
                    No expenses found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((ex) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-slate-700/40 transition-colors border-b border-slate-700/40"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {ex.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 border border-slate-600 text-slate-200">
                        <Tag className="h-3 w-3 text-teal-400" />
                        {ex.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {ex.description || <span className="text-slate-500 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white whitespace-nowrap">
                      Rs. {Number(ex.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                        <CreditCard className="h-3 w-3 text-slate-400" />
                        {ex.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {ex.added_by || 'Staff'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteExpense(ex.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                        title="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default ExpensesPage;
