/**
 * PharmacyShell — Top navigation bar for all Pharmacy sub-modules
 * Features [Apps] launcher return button, quick POS jump, and user controls.
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid,
  ShoppingCart,
  Wifi,
  ChevronDown,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { migrateLocalDataIfNeeded } from './pharmacyData';

export function PharmacyShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('genx_businessType', 'pharmacy');
    localStorage.setItem('genx:selectedModule', 'pharmacy');
    void migrateLocalDataIfNeeded();
  }, []);

  const getModuleTitle = () => {
    const p = location.pathname;
    if (p.includes('/dashboard')) return 'Pharmacy Dashboard';
    if (p.includes('/medicines')) return 'Medicines & Inventory';
    if (p.includes('/expiry-batch')) return 'Expiry & Batch Tracking (FEFO)';
    if (p.includes('/suppliers')) return 'Vendors & Suppliers';
    if (p.includes('/purchases')) return 'Purchase Orders';
    if (p.includes('/accounts')) return 'Payments & Accounts';
    if (p.includes('/customers')) return 'Customers & Patients';
    if (p.includes('/expenses')) return 'Expenses';
    if (p.includes('/reports')) return 'Reports & Analytics';
    if (p.includes('/staff')) return 'Staff & Permissions';
    if (p.includes('/settings')) return 'Pharmacy Settings';
    return 'Pharmacy';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          {/* Apps Launcher Button */}
          <Link
            to="/pharmacy"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition border border-teal-200"
            title="Return to Pharmacy Launcher"
          >
            <LayoutGrid className="h-5 w-5 text-teal-700" />
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide text-slate-900">GENX Pharmacy</span>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold text-teal-600">{getModuleTitle()}</span>
          </div>
        </div>

        {/* Right side shortcuts & profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Direct Launch to POS */}
          <Link
            to="/pharmacy/pos"
            className="flex items-center gap-1.5 rounded-lg bg-[#00897b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#00897b]/90 transition"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open POS</span>
          </Link>

          {/* Online badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <Wifi className="h-3 w-3" />
            <span>Online</span>
          </div>

          {/* User menu dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 rounded-lg p-1 text-slate-600 hover:bg-slate-100 transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00897b] text-xs font-bold text-white shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'P'}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Pharmacist'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email || 'pharmacy@genxpos.com'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('genx_businessType');
                    localStorage.removeItem('genx:selectedModule');
                    navigate('/select-module');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Switch Business
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Module Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full bg-[#f8fafc]">
        <Outlet />
      </main>
    </div>
  );
}

export default PharmacyShell;
