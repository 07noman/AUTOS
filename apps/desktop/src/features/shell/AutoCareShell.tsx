import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid,
  Wifi,
  WifiOff,
  Cloud,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';
import UserMenu from '@/components/UserMenu';

export function AutoCareShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const { status, syncStatus, refreshPending } = useConnectivity();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  const handleSwitchModule = () => {
    localStorage.removeItem('genx:selectedModule');
    navigate('/select-module');
  };

  // Determine active app title from URL
  const getAppTitle = () => {
    const p = location.pathname;
    if (p.includes('/pos')) return 'Point of Sale';
    if (p.includes('/dashboard')) return 'Dashboard';
    if (p.includes('/jobs') || p.includes('/service-jobs')) return 'Service Jobs';
    if (p.includes('/vehicles')) return 'Vehicles';
    if (p.includes('/vehicle-history')) return 'Vehicle History';
    if (p.includes('/customers')) return 'Customers';
    if (p.includes('/inventory')) return 'Inventory';
    if (p.includes('/estimates')) return 'Estimates';
    if (p.includes('/appointments')) return 'Appointments';
    if (p.includes('/job-board')) return 'Job Board';
    if (p.includes('/payments')) return 'Payments';
    if (p.includes('/staff')) return 'Staff';
    if (p.includes('/parts')) return 'Parts & Products';
    if (p.includes('/reports')) return 'Reports';
    if (p.includes('/settings')) return 'Settings';
    return 'App';
  };

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Top Application Bar (Odoo Style) */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-[#1d1d23] text-white px-4 shrink-0 select-none z-30">
        {/* Left: Odoo-style 3x3 App Launcher Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/auto-care')}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer group"
            title="Return to Auto Care Apps Launcher"
          >
            <LayoutGrid className="h-4 w-4 text-white group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold tracking-wide">Apps</span>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">/</span>
            <Link
              to="/auto-care"
              className="text-white/70 hover:text-white font-medium transition-colors"
            >
              Auto Care
            </Link>
            <span className="text-white/40">/</span>
            <span className="text-emerald-400 font-semibold">{getAppTitle()}</span>
          </div>
        </div>

        {/* Right: Quick actions, Connectivity, User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2 text-xs text-white/70">
            {status === 'online' ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-rose-400" />
            )}
            {syncStatus === 'syncing' && <Cloud className="h-3.5 w-3.5 text-blue-400 animate-pulse" />}
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center h-7 w-7 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleSwitchModule}
            className="text-xs text-white/60 hover:text-white py-1 px-2 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Switch business type"
          >
            Switch Business
          </button>

          <div className="relative flex items-center gap-2 pl-2 border-l border-white/10">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer hover:ring-2 hover:ring-white/40 transition"
              title={user?.name || "Auto Care User"}
            >
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </button>

            {showUserMenu && (
              <UserMenu
                onLogout={logout}
                onClose={() => setShowUserMenu(false)}
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area without sidebars */}
      <main className="flex-1 overflow-y-auto bg-bg">
        <Outlet />
      </main>
    </div>
  );
}

export default AutoCareShell;
