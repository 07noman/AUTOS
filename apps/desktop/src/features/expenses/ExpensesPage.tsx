import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  TrendingUp,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  FileText,
  ChevronDown,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [storeId, setStoreId] = useState<string>(() => getCurrentStoreId());

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Other',
    amount: '0.01',
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
        amount: '0.01',
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showNotification('Expense deleted', 'success');
    } catch (err) {
      console.error('Error deleting expense:', err);
      showNotification('Failed to delete expense', 'error');
    }
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredExpenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExpenses.map((e) => e.id)));
    }
  };

  // Toggle single selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYearMonth = todayStr.substring(0, 7);
    const currentYear = todayStr.substring(0, 4);

    return expenses.filter((item) => {
      if (dateFilter === 'today' && item.date !== todayStr) return false;
      if (dateFilter === 'month' && !item.date.startsWith(currentYearMonth)) return false;
      if (dateFilter === 'year' && !item.date.startsWith(currentYear)) return false;

      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (methodFilter !== 'all' && item.payment_method !== methodFilter) return false;

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

  const money = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="min-h-screen bg-[#f3f0ff] font-sans">
      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#4c3299] to-[#6c4dc4] px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 gap-0.5">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-white/70 rounded-sm" />
              ))}
            </div>
            <span className="text-white font-bold text-lg ml-1">Expenses</span>
          </div>
          <nav className="flex items-center gap-1">
            {['My Expenses', 'Expense Reports', 'Configuration'].map((tab) => (
              <button
                key={tab}
                className="px-4 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md transition"
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-white/15 border border-white/20 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/20 w-48"
            />
          </div>
          <div className="relative">
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <div className="relative">
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">5</span>
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">K</div>
            <span className="text-white text-sm">My Company</span>
            <ChevronDown className="h-4 w-4 text-white/70" />
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-5 max-w-[1400px] mx-auto">
        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e1b4b]">Expenses</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track, categorize and control daily operating costs for this store
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 shadow-sm">
              <Database className="h-4 w-4 text-gray-400" />
              <span>Store: {storeId}</span>
            </div>
            <button
              onClick={() => void loadExpenses()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-sm text-gray-700 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Toast Notification ──────────────────────────────────────────────── */}
        {notification && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 border shadow-sm ${
              notification.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Today's Expense */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Today's Expense</p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1">{money(todayTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {expenses.filter((e) => e.date === todayStr).length} transactions logged today
                </p>
              </div>
            </div>
          </div>

          {/* Month Total */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Month Total</p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1">{money(monthTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Current calendar month accumulated costs
                </p>
              </div>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-50">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1">{money(allTotal)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {expenses.length} total entries in store database
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Add Expense Card ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[#1e1b4b] mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <Plus className="h-4 w-4 text-green-600" />
            </div>
            Add New Expense
          </h2>

          <form onSubmit={handleAddExpense} className="flex flex-wrap items-center gap-3">
            {/* Date */}
            <div className="relative">
              <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-white border border-gray-300 pl-10 pr-3 py-2.5 text-sm rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 w-[160px]"
                required
              />
            </div>

            {/* Category */}
            <div className="relative min-w-[140px]">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 appearance-none pr-8"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Amount */}
            <div className="flex items-center gap-0">
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-24 bg-white border border-gray-300 px-3 py-2.5 text-sm rounded-l-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 font-medium"
                required
              />
              <span className="bg-gray-100 border border-l-0 border-gray-300 px-3 py-2.5 text-sm text-gray-500 rounded-r-lg">
                Rs.
              </span>
            </div>

            {/* Payment Method */}
            <div className="relative min-w-[120px]">
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 appearance-none pr-8"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Description */}
            <div className="flex-[2] min-w-[220px]">
              <input
                type="text"
                placeholder="Description / Remarks (e.g. Shop electric bill)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-white border border-gray-300 px-3 py-2.5 text-sm rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#5b3cc4] hover:bg-[#4c2fb3] active:bg-[#3d2699] text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-md transition disabled:opacity-50 shrink-0 flex items-center gap-2"
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
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mr-1">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>

            {/* Period Filter buttons */}
            {(['month', 'today', 'year', 'all'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setDateFilter(period)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${
                  dateFilter === period
                    ? 'bg-[#5b3cc4] text-white border-[#5b3cc4] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
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
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-gray-300 px-3 py-1.5 text-xs rounded-full text-gray-600 focus:outline-none appearance-none pr-7"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Payment Method Filter */}
            <div className="relative">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-white border border-gray-300 px-3 py-1.5 text-xs rounded-full text-gray-600 focus:outline-none appearance-none pr-7"
              >
                <option value="all">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search input */}
          <div className="relative min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 pl-9 pr-3 py-1.5 text-sm rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500">
              Showing <strong className="text-gray-700">{filteredExpenses.length}</strong> of{' '}
              <strong className="text-gray-700">{expenses.length}</strong> expenses
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredExpenses.length > 0 && selectedIds.size === filteredExpenses.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Added By</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-purple-500" />
                      <p className="text-sm text-gray-400">Loading expenses for store...</p>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-xl bg-gray-100">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm font-semibold text-gray-600 mt-2">No expenses found</p>
                        <p className="text-xs text-gray-400">Add your first expense to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((ex) => (
                    <tr
                      key={ex.id}
                      className="hover:bg-purple-50/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ex.id)}
                          onChange={() => toggleSelect(ex.id)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                        {ex.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          {ex.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                        {ex.description || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                        Rs. {Number(ex.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                        {ex.payment_method}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                        {ex.added_by || 'Staff'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteExpense(ex.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
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
    </div>
  );
}
export default ExpensesPage;
