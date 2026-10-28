import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Bell,
  MessageSquare,
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
  const navigate = useNavigate();
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

  const selectedModule = localStorage.getItem('genx:selectedModule');
  const returnToLauncher = () => {
    if (selectedModule === 'auto_care' || selectedModule === 'auto-parts') {
      navigate('/auto-care');
    } else if (selectedModule) {
      navigate(`/business/${selectedModule}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f0ff] font-sans text-slate-800">
      {/* ── Top Navigation Bar (Odoo Style) ─────────────────────────────────── */}
      <header className="bg-gradient-to-r from-[#4c3299] to-[#6c4dc4] px-6 py-2.5 flex items-center justify-between shadow-md select-none sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={returnToLauncher}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
            title="Return to Apps Launcher"
          >
            <div className="grid grid-cols-3 gap-0.5 group-hover:scale-105 transition-transform">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-white/90 rounded-sm" />
              ))}
            </div>
            <span className="text-white font-bold text-base tracking-wide ml-1">Expenses</span>
          </button>

          <nav className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-white/15 rounded-md transition shadow-sm"
            >
              My Expenses
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedModule === 'auto_care' || selectedModule === 'auto-parts') {
                  navigate('/auto-care/reports');
                } else if (selectedModule) {
                  navigate(`/business/${selectedModule}/reports`);
                } else {
                  navigate('/reports');
                }
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition cursor-pointer"
            >
              Expense Reports
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedModule === 'auto_care' || selectedModule === 'auto-parts') {
                  navigate('/auto-care/settings');
                } else if (selectedModule) {
                  navigate(`/business/${selectedModule}/settings`);
                } else {
                  navigate('/settings');
                }
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition cursor-pointer"
            >
              Configuration
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-white/15 border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/60 focus:outline-none focus:bg-white/25 w-36 sm:w-48 transition"
            />
          </div>

          <div className="relative cursor-pointer">
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
              3
            </span>
            <Bell className="w-4 h-4 text-white/80 hover:text-white transition" />
          </div>

          <div className="relative cursor-pointer">
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
              5
            </span>
            <MessageSquare className="w-4 h-4 text-white/80 hover:text-white transition" />
          </div>

          <button
            type="button"
            onClick={() => navigate('/account-actions')}
            className="flex items-center gap-2 hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer"
            title="Account Actions"
          >
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'K'}
            </div>
            <span className="text-white text-xs font-medium hidden md:inline">
              {user?.name || 'My Company'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/70" />
          </button>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────────────── */}
      <main className="px-4 sm:px-8 py-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1e1b4b] tracking-tight">Expenses</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Track, categorize and control daily operating costs for this store
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 shadow-sm">
              <Database className="h-3.5 w-3.5 text-purple-600" />
              <span>Store: <strong className="font-mono text-purple-900">{storeId}</strong></span>
            </div>
            <button
              onClick={() => void loadExpenses()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Toast Notification ──────────────────────────────────────────────── */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border shadow-sm transition animate-in fade-in ${
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

        {/* ── 3 Summary KPI Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Today's Expense */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-[#e0f2fe] text-[#0284c7]">
                <Calendar className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Today&apos;s Expense
                </p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1 tracking-tight">
                  {money(todayTotal)}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {expenses.filter((e) => e.date === todayStr).length} transactions logged today
                </p>
              </div>
            </div>
          </div>

          {/* Month Total */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-[#dcfce7] text-[#16a34a]">
                <TrendingUp className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Month Total
                </p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1 tracking-tight">
                  {money(monthTotal)}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  Current calendar month accumulated costs
                </p>
              </div>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-[#f3e8ff] text-[#9333ea]">
                <Database className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Expenses
                </p>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1 tracking-tight">
                  {money(allTotal)}
                </p>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {expenses.length} total entries in store database
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Add New Expense Card ─────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#1e1b4b] mb-4 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#5b3cc4] text-white flex items-center justify-center shadow-sm">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </div>
            Add New Expense
          </h2>

          <form onSubmit={handleAddExpense} className="flex flex-wrap items-center gap-3">
            {/* Date */}
            <div className="relative min-w-[150px]">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-white border border-slate-300 px-3 py-2.5 text-xs sm:text-sm rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 font-medium shadow-xs"
                required
              />
            </div>

            {/* Category */}
            <div className="relative min-w-[140px]">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 appearance-none pr-8 font-medium shadow-xs"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Amount with Rs. suffix */}
            <div className="flex items-center min-w-[130px]">
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-24 bg-white border border-slate-300 px-3 py-2.5 text-xs sm:text-sm rounded-l-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 font-semibold shadow-xs"
                required
              />
              <span className="bg-slate-100 border border-l-0 border-slate-300 px-3 py-2.5 text-xs sm:text-sm text-slate-500 rounded-r-xl font-medium select-none">
                Rs.
              </span>
            </div>

            {/* Payment Method */}
            <div className="relative min-w-[130px]">
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 appearance-none pr-8 font-medium shadow-xs"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Description */}
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                placeholder="Description / Remarks (e.g. Shop electric bill)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 shadow-xs"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#5b3cc4] hover:bg-[#4c2fb3] active:bg-[#3d2699] text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition disabled:opacity-50 shrink-0 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 stroke-[2.5]" />
              )}
              Add Expense
            </button>
          </form>
        </div>

        {/* ── Filter & Search Toolbar ─────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200/70 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter:</span>
            </div>

            {/* Period Filter buttons */}
            {(['month', 'today', 'year', 'all'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setDateFilter(period)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  dateFilter === period
                    ? 'bg-[#5b3cc4] text-white border-[#5b3cc4] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
                className="bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-full text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none pr-7 font-medium"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Payment Method Filter */}
            <div className="relative">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-white border border-slate-200 px-3 py-1.5 text-xs rounded-full text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none pr-7 font-medium"
              >
                <option value="all">All Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Search input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </div>

        {/* ── Table Card ──────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-700 font-bold">{filteredExpenses.length}</strong> of{' '}
              <strong className="text-slate-700 font-bold">{expenses.length}</strong> expenses
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#f8fafc] border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredExpenses.length > 0 && selectedIds.size === filteredExpenses.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DATE</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CATEGORY</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DESCRIPTION</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">AMOUNT</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">PAYMENT METHOD</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">ADDED BY</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-purple-600" />
                      <p className="text-xs text-slate-400">Loading expenses for store...</p>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-400">
                          <FileText className="h-8 w-8 stroke-[1.8]" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 mt-2">No expenses found</p>
                        <p className="text-xs text-slate-400">Add your first expense to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((ex) => (
                    <tr
                      key={ex.id}
                      className="hover:bg-purple-50/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ex.id)}
                          onChange={() => toggleSelect(ex.id)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                        {ex.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
                          {ex.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {ex.description || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                        Rs. {Number(ex.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {ex.payment_method}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {ex.added_by || 'Staff'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteExpense(ex.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
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
      </main>
    </div>
  );
}
export default ExpensesPage;
