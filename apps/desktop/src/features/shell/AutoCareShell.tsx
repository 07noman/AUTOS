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
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { PasscodeLock } from '@/components/PasscodeLock';
import { getAppSettings, isModuleUnlocked, getHiddenModulesSync } from '@/lib/app-settings';

export function AutoCareShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const { user, logout } = useAuth();
  const { status, syncStatus, refreshPending } = useConnectivity();

  // App settings protection state
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>(() =>
    getHiddenModulesSync(user?.id ?? null)
  );
  const [sessionUnlocked, setSessionUnlocked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (isMounted) {
          setIsPasscodeEnabled(Boolean(settings.is_passcode_enabled));
          setHiddenModules(settings.hidden_modules || []);
        }
      } catch (err) {
        console.warn('[AutoCareShell] Failed to load app settings:', err);
      }
    })();

    const handleSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail && isMounted) {
        setIsPasscodeEnabled(Boolean(custom.detail.is_passcode_enabled));
        setHiddenModules(custom.detail.hidden_modules || []);
      }
    };

    window.addEventListener('app_settings_changed', handleSettingsChanged);
    return () => {
      isMounted = false;
      window.removeEventListener('app_settings_changed', handleSettingsChanged);
    };
  }, []);

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
    if (p.includes('/orders')) return 'POS Orders';
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
    if (p.includes('/expenses')) return 'Expenses';
    if (p.includes('/settings')) return 'Settings';
    return 'App';
  };

  const isExpenses = location.pathname.includes('/expenses');

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Top Application Bar (Odoo Style) — omitted on Expenses module to show full native purple Odoo header */}
      {!isExpenses && (
        <header className="flex h-12 items-center justify-between border-b border-border bg-[#1d1d23] text-white px-4 shrink-0 select-none z-30">
          {/* Left: Odoo-style 3x3 App Launcher Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/auto-care')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer group"
              title="Return to Business pos & store Apps Launcher"
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
                Business pos & store
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
                onClick={() => navigate('/account-actions')}
                className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer hover:ring-2 hover:ring-white/40 transition"
                title={user?.name || "Business User"}
                aria-label="Account Actions"
              >
                {user?.name?.charAt(0).toUpperCase() || 'B'}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-bg relative">
        {(() => {
          const appTitle = getAppTitle();
          const isModuleHidden = appTitle !== 'Settings' && hiddenModules.includes(appTitle);
          const isModuleLocked =
            isPasscodeEnabled && !isModuleUnlocked(appTitle) && !sessionUnlocked[appTitle];

          if (isModuleHidden) {
            return (
              <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center select-none">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4 shadow-lg shadow-rose-500/5">
                  <EyeOff className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-text mb-2">Module Hidden by Administrator</h2>
                <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
                  The <span className="text-text font-semibold">{appTitle}</span> module is currently hidden in your store settings and cannot be accessed.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auto-care')}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20 cursor-pointer"
                >
                  Return to Launcher
                </button>
              </div>
            );
          }

          if (isModuleLocked) {
            return (
              <PasscodeLock
                moduleName={appTitle}
                onUnlock={() => setSessionUnlocked((prev) => ({ ...prev, [appTitle]: true }))}
                onClose={() => navigate('/auto-care')}
              />
            );
          }

          return <Outlet />;
        })()}
      </main>
    </div>
  );
}

export default AutoCareShell;
