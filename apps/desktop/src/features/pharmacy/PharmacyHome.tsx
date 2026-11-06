/**
 * PharmacyHome — Master Launcher for Pharmacy Business Type
 * Displays clean Odoo-style app launcher grid with Pharmacy modules.
 */

import { useState } from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Pill,
  CalendarClock,
  Truck,
  FileCheck2,
  Landmark,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronDown,
  MessageSquare,
  Clock3,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export interface PharmacyApp {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  href: string;
  badge?: string;
}

const PHARMACY_APPS: PharmacyApp[] = [
  {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Fast counter billing, barcode & cash sale',
    icon: ShoppingCart,
    iconBg: 'bg-[#00897b]',
    href: '/pharmacy/pos',
    badge: 'Main POS',
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Sales, profit, inventory & alerts',
    icon: LayoutDashboard,
    iconBg: 'bg-[#3949ab]',
    href: '/pharmacy/dashboard',
  },
  {
    id: 'medicines',
    name: 'Medicines & Inventory',
    description: 'Drug database, brands, dosage & stock',
    icon: Pill,
    iconBg: 'bg-[#0288d1]',
    href: '/pharmacy/medicines',
  },
  {
    id: 'expiry-batch',
    name: 'Expiry & Batches',
    description: 'FEFO tracking, near-expiry & disposal',
    icon: CalendarClock,
    iconBg: 'bg-[#e53935]',
    href: '/pharmacy/expiry-batch',
    badge: 'FEFO',
  },
  {
    id: 'suppliers',
    name: 'Vendors & Suppliers',
    description: 'Pharma distributors, balances & ledger',
    icon: Truck,
    iconBg: 'bg-[#5e35b1]',
    href: '/pharmacy/suppliers',
  },
  {
    id: 'purchases',
    name: 'Purchase Orders',
    description: 'Invoices, batch entry & stock-in',
    icon: FileCheck2,
    iconBg: 'bg-[#f57c00]',
    href: '/pharmacy/purchases',
  },
  {
    id: 'accounts',
    name: 'Payments & Accounts',
    description: 'Daily cash closing, payables & receivables',
    icon: Landmark,
    iconBg: 'bg-[#43a047]',
    href: '/pharmacy/accounts',
  },
  {
    id: 'customers',
    name: 'Customers & Patients',
    description: 'Prescription history & credit balances',
    icon: Users,
    iconBg: 'bg-[#d81b60]',
    href: '/pharmacy/customers',
  },
  {
    id: 'expenses',
    name: 'Expenses',
    description: 'Daily operating costs, rent & utilities',
    icon: Wallet,
    iconBg: 'bg-[#e11d48]',
    href: '/pharmacy/expenses',
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    description: 'Sales profit, valuation & audit logs',
    icon: BarChart3,
    iconBg: 'bg-[#00acc1]',
    href: '/pharmacy/reports',
  },
  {
    id: 'staff',
    name: 'Staff & Roles',
    description: 'Pharmacist, cashier & admin access',
    icon: ShieldCheck,
    iconBg: 'bg-[#6a1b9a]',
    href: '/pharmacy/staff',
  },
  {
    id: 'settings',
    name: 'Pharmacy Settings',
    description: 'Drug license, receipts & thermal printer',
    icon: Settings,
    iconBg: 'bg-[#546e7a]',
    href: '/pharmacy/settings',
  },
];

export function PharmacyHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleSwitchBusiness = () => {
    localStorage.removeItem('genx:selectedModule');
    navigate('/select-module');
  };

  return (
    <div className="relative min-h-screen bg-[#1c1c24] text-white selection:bg-[#00897b]/30 selection:text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00897b]/[0.035] blur-3xl" />

      {/* Top bar */}
      <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-white/[0.06] px-5 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-white/90">GENX</span>
          <span className="text-xs text-white/40">/</span>
          <span className="text-xs text-teal-400 font-medium">Pharmacy Cloud</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <MessageSquare className="h-[19px] w-[19px]" />
            <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              2
            </span>
          </button>

          <button
            type="button"
            aria-label="Activity"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Clock3 className="h-[19px] w-[19px]" />
          </button>

          {/* Business dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.06]"
            >
              <span className="h-2 w-2 rounded-full bg-[#00897b]" />
              Pharmacy
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#25252d] p-1.5 shadow-2xl z-50">
                <button
                  type="button"
                  onClick={handleSwitchBusiness}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Switch Business Type
                </button>
                <div className="my-1 border-t border-white/5" />
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* User avatar */}
          <button
            type="button"
            onClick={() => navigate('/account-actions')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00897b] text-sm font-bold text-white shadow-lg shadow-[#00897b]/20 cursor-pointer hover:ring-2 hover:ring-white/40 transition"
            title={user?.name || 'Pharmacy Admin'}
          >
            {user?.name?.charAt(0).toUpperCase() || 'P'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-68px)] max-w-[1100px] items-start justify-center px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="w-full">
          <div className="mb-10 text-center sm:mb-12">
            <div className="mb-2 text-[12px] font-semibold tracking-[0.2em] text-[#00897b]">
              GENX PHARMACY MANAGEMENT
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
              Pharmacy
            </h1>
            <p className="mt-1.5 text-xs text-slate-400">
              Medicines, batch expiry, FEFO inventory and point of sale
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 sm:gap-6">
            {PHARMACY_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => navigate(app.href)}
                  className="group relative flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] hover:shadow-xl cursor-pointer"
                >
                  {app.badge && (
                    <span className="absolute top-2.5 right-2.5 rounded-md bg-[#00897b]/20 px-1.5 py-0.5 text-[10px] font-medium text-teal-300 border border-[#00897b]/30">
                      {app.badge}
                    </span>
                  )}

                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-200 group-hover:scale-110 ${app.iconBg}`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <span className="mt-3.5 text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {app.name}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                    {app.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default PharmacyHome;
