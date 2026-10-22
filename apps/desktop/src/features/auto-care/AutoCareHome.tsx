import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Car,
  History,
  Users,
  Package,
  FileText,
  BarChart3,
  Settings,
  ClipboardList,
  CreditCard,
  CalendarDays,
  User,
  Boxes,
  ChevronDown,
  MessageSquare,
  Clock3,
  WrenchIcon,
  LogOut,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PasscodeLock } from "@/components/PasscodeLock";
import { getAppSettings, isModuleUnlocked } from "@/lib/app-settings";

export type AutoCareApp = {
  id: string;
  name: string;
  icon: React.ElementType;
  iconBg: string;
  href: string;
};

export const AUTO_CARE_APPS: AutoCareApp[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: LayoutDashboard,
    iconBg: "bg-[#3949ab]",
    href: "/auto-care/dashboard",
  },
  {
    id: "pos",
    name: "Point of Sale",
    icon: ShoppingCart,
    iconBg: "bg-[#00897b]",
    href: "/auto-care/pos",
  },
  {
    id: "service-jobs",
    name: "Service Jobs",
    icon: Wrench,
    iconBg: "bg-[#f57c00]",
    href: "/auto-care/service-jobs",
  },
  {
    id: "vehicles",
    name: "Vehicles",
    icon: Car,
    iconBg: "bg-[#7b1fa2]",
    href: "/auto-care/vehicles",
  },
  {
    id: "vehicle-history",
    name: "Vehicle History",
    icon: History,
    iconBg: "bg-[#00838f]",
    href: "/auto-care/vehicle-history",
  },
  {
    id: "customers",
    name: "Customers",
    icon: Users,
    iconBg: "bg-[#d81b60]",
    href: "/auto-care/customers",
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Package,
    iconBg: "bg-[#3949ab]",
    href: "/auto-care/inventory",
  },
  {
    id: "estimates",
    name: "Estimates",
    icon: FileText,
    iconBg: "bg-[#f9a825]",
    href: "/auto-care/estimates",
  },
  {
    id: "appointments",
    name: "Appointments",
    icon: CalendarDays,
    iconBg: "bg-[#00897b]",
    href: "/auto-care/appointments",
  },
  {
    id: "job-board",
    name: "Job Board",
    icon: ClipboardList,
    iconBg: "bg-[#e53935]",
    href: "/auto-care/job-board",
  },
  {
    id: "payments",
    name: "Payments",
    icon: CreditCard,
    iconBg: "bg-[#7cb342]",
    href: "/auto-care/payments",
  },
  {
    id: "staff",
    name: "Staff",
    icon: User,
    iconBg: "bg-[#6a1b9a]",
    href: "/auto-care/staff",
  },
  {
    id: "parts",
    name: "Parts & Products",
    icon: Boxes,
    iconBg: "bg-[#ef6c00]",
    href: "/auto-care/parts",
  },
  {
    id: "orders",
    name: "POS Orders",
    icon: Receipt,
    iconBg: "bg-[#0d9488]",
    href: "/auto-care/orders",
  },
  {
    id: "reports",
    name: "Reports",
    icon: BarChart3,
    iconBg: "bg-[#0288d1]",
    href: "/auto-care/reports",
  },
  {
    id: "settings",
    name: "Settings",
    icon: Settings,
    iconBg: "bg-[#546e7a]",
    href: "/auto-care/settings",
  },
];

export function AutoCareHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  // Feature 1 & 2 states
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [pendingAppForUnlock, setPendingAppForUnlock] = useState<AutoCareApp | null>(null);

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
        console.warn("[AutoCareHome] Failed to load app settings:", err);
      }
    })();

    const handleSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail && isMounted) {
        setIsPasscodeEnabled(Boolean(custom.detail.is_passcode_enabled));
        setHiddenModules(custom.detail.hidden_modules || []);
      }
    };

    window.addEventListener("app_settings_changed", handleSettingsChanged);
    return () => {
      isMounted = false;
      window.removeEventListener("app_settings_changed", handleSettingsChanged);
    };
  }, []);

  const openApp = (app: AutoCareApp) => {
    // If passcode protection is enabled and module not unlocked in current session
    if (isPasscodeEnabled && !isModuleUnlocked(app.name)) {
      setPendingAppForUnlock(app);
      return;
    }

    navigate(app.href);
  };

  const handleUnlockSuccess = () => {
    if (pendingAppForUnlock) {
      const targetHref = pendingAppForUnlock.href;
      setPendingAppForUnlock(null);
      navigate(targetHref);
    }
  };

  const handleSwitchBusiness = () => {
    localStorage.removeItem("genx:selectedModule");
    navigate("/select-module");
  };

  // Filter out any modules present in hidden_modules (Settings is never hidden)
  const visibleModules = AUTO_CARE_APPS.filter(
    (app) => app.name === "Settings" || !hiddenModules.includes(app.name)
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1d1d23] text-white select-none">
      {/* =====================================================
          SUBTLE ODOO-STYLE DOT BACKGROUND
      ====================================================== */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* =====================================================
          VERY SUBTLE CENTER LIGHT
      ====================================================== */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.025] blur-3xl" />

      {/* =====================================================
          TOP BAR
      ====================================================== */}
      <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-white/[0.06] px-5 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide text-white/90">
            GENX
          </span>
          <span className="text-xs text-white/40">/</span>
          <span className="text-xs text-slate-400">Business pos & store Launcher</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Notification / Messages */}
          <button
            type="button"
            aria-label="Messages"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <MessageSquare className="h-[19px] w-[19px]" />
            <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              3
            </span>
          </button>

          {/* Clock */}
          <button
            type="button"
            aria-label="Activities"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Clock3 className="h-[19px] w-[19px]" />
          </button>

          {/* Tools */}
          <button
            type="button"
            aria-label="Tools"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <WrenchIcon className="h-[19px] w-[19px]" />
          </button>

          {/* Business name dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.06]"
            >
              Business pos & store
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#25252d] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => navigate('/account-actions')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-500/10 cursor-pointer hover:ring-2 hover:ring-white/40 transition"
              title={user?.name || "Business User"}
              aria-label="Account Actions"
            >
              {user?.name?.charAt(0).toUpperCase() || "B"}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN APPLICATION LAUNCHER
      ====================================================== */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-68px)] max-w-[1080px] items-start justify-center px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="w-full">
          {/* =================================================
              BRAND / TITLE
          ================================================== */}
          <div className="mb-10 text-center sm:mb-12">
            <div className="mb-2.5 text-[12px] font-semibold tracking-[0.2em] text-slate-400 sm:text-[13px]">
              GENX CLOUD
            </div>

            <h1 className="text-[24px] font-semibold tracking-tight text-white sm:text-[27px]">
              Business pos & store
            </h1>
          </div>

          {/* =================================================
              APPLICATION GRID (FILTERED BY VISIBILITY)
          ================================================== */}
          <div className="mx-auto grid max-w-[850px] grid-cols-3 justify-items-center gap-x-6 gap-y-9 sm:grid-cols-4 sm:gap-x-10 sm:gap-y-12 md:grid-cols-5 md:gap-x-12 md:gap-y-14">
            {visibleModules.map((app) => {
              const Icon = app.icon;

              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app)}
                  className="group flex w-[100px] flex-col items-center outline-none cursor-pointer"
                >
                  {/* =========================================
                      APP ICON
                  ========================================== */}
                  <div
                    className={`
                      relative flex h-[70px] w-[70px]
                      items-center justify-center
                      rounded-[13px]
                      border border-white/[0.10]
                      shadow-[0_5px_18px_rgba(0,0,0,0.25)]
                      transition-all duration-150
                      group-hover:-translate-y-1
                      group-hover:scale-[1.035]
                      group-hover:border-white/[0.20]
                      group-hover:shadow-[0_10px_25px_rgba(0,0,0,0.35)]
                      group-focus-visible:ring-2
                      group-focus-visible:ring-white/40
                      sm:h-[76px] sm:w-[76px]
                      ${app.iconBg}
                    `}
                  >
                    {/* subtle inner highlight */}
                    <div className="pointer-events-none absolute inset-[1px] rounded-[12px] bg-gradient-to-b from-white/[0.12] to-transparent" />

                    <Icon
                      strokeWidth={1.8}
                      className="relative z-10 h-[32px] w-[32px] text-white drop-shadow-md sm:h-[34px] sm:w-[34px]"
                    />
                  </div>

                  {/* =========================================
                      APP NAME
                  ========================================== */}
                  <span className="mt-2.5 max-w-[100px] text-center text-[12px] font-medium leading-[16px] text-slate-200 transition-colors group-hover:text-white sm:text-[13px]">
                    {app.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURE 1: 4-DIGIT MASTER PASSCODE LOCK MODAL
      ====================================================== */}
      {pendingAppForUnlock && (
        <PasscodeLock
          moduleName={pendingAppForUnlock.name}
          onUnlock={handleUnlockSuccess}
          onClose={() => setPendingAppForUnlock(null)}
        />
      )}
    </main>
  );
}

export default AutoCareHome;
