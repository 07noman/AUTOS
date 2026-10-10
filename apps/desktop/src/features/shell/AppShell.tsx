import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Wifi,
  WifiOff,
  Cloud,
  Moon,
  Sun,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@genx/ui/Button';
import { Avatar, AvatarFallback } from '@genx/ui/Avatar';
import { Badge } from '@genx/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';
import UserMenu from '@/components/UserMenu';

const navItems = [
  { icon: ShoppingCart, label: 'POS', path: '/pos' },
  { icon: Receipt, label: 'Advanced POS', path: '/pos/advanced' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: Boxes, label: 'Inventory', path: '/inventory' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const BUSINESS_LABELS: Record<string, { label: string; icon: string }> = {
  restaurant: { label: 'Restaurant POS', icon: '🍽️' },
  bakery: { label: 'Bakery POS', icon: '🥐' },
  mart: { label: 'Mart & Grocery POS', icon: '🛒' },
  retail: { label: 'Retail Shop POS', icon: '🛍️' },
  clothing: { label: 'Clothing POS', icon: '👕' },
  furniture: { label: 'Furniture POS', icon: '🛋️' },
  bar: { label: 'Cafe & Bar POS', icon: '☕' },
  'auto-parts': { label: 'Auto Parts POS', icon: '🔧' },
  auto_care: { label: 'Auto Care POS', icon: '🔧' },
  general: { label: 'General POS', icon: '📦' },
};

export function AppShell() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const { status, syncStatus, pendingCount, refreshPending } = useConnectivity();

  const selectedModule = localStorage.getItem('genx:selectedModule') || 'general';
  const currentBusiness = BUSINESS_LABELS[selectedModule] || {
    label: 'Cloud POS',
    icon: '🏪',
  };

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

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <aside
        className={clsx(
          'flex flex-col border-r border-border bg-bg-elevated transition-all duration-300',
          sidebarExpanded ? 'w-60' : 'w-16'
        )}
      >
        <div className="flex h-14 items-center border-b border-border px-4 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">{sidebarExpanded ? 'GENX' : 'G'}</span>
            {sidebarExpanded && (
              <span className="text-[11px] text-text-muted font-medium bg-bg-subtle px-1.5 py-0.5 rounded truncate max-w-[110px]">
                {currentBusiness.label}
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-4 py-3 mx-2 rounded-lg transition-colors',
                  isActive ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-bg-subtle',
                  !sidebarExpanded && 'justify-center'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarExpanded && <span className="ml-3 text-sm">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Switch Business Type Button */}
        {sidebarExpanded && (
          <div className="px-4 pb-2">
            <button
              type="button"
              onClick={handleSwitchModule}
              className="flex items-center gap-2 text-xs text-text-muted hover:text-primary w-full py-2 px-2 rounded hover:bg-bg-subtle transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Switch business
            </button>
          </div>
        )}

        <div className="border-t border-border p-2 space-y-2">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center w-full h-9 rounded-md hover:bg-bg-subtle"
          >
            {darkMode ? <Sun className="h-5 w-5 text-text-secondary" /> : <Moon className="h-5 w-5 text-text-secondary" />}
          </button>
          <button
            type="button"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex items-center justify-center w-full h-9 rounded-md hover:bg-bg-subtle"
          >
            {sidebarExpanded ? (
              <ChevronLeft className="h-5 w-5 text-text-muted" />
            ) : (
              <ChevronRight className="h-5 w-5 text-text-muted" />
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border bg-bg-elevated px-6">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-text flex items-center gap-2">
              <span>{currentBusiness.icon}</span>
              <span>{currentBusiness.label}</span>
            </div>
            <span className="text-border">|</span>
            <select className="text-xs font-medium text-text-secondary bg-transparent border-none focus:outline-none cursor-pointer">
              <option>📍 Main Branch</option>
              <option>Downtown Store</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              {status === 'online' ? (
                <>
                  <Wifi className="h-4 w-4 text-online" />
                  <span className="text-text-secondary hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-offline" />
                  <span className="text-offline hidden sm:inline">Offline</span>
                </>
              )}
              {syncStatus === 'syncing' && <Cloud className="h-4 w-4 text-syncing animate-pulse" />}
              {pendingCount > 0 && <Badge variant="info">{pendingCount}</Badge>}
            </div>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {pendingCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-error" />}
            </Button>

            <div className="relative flex items-center space-x-3 border-l border-border pl-4">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 text-left cursor-pointer hover:opacity-80 transition"
                title={user?.name || "User menu"}
              >
                <Avatar>
                  <AvatarFallback className="bg-primary text-white text-sm">{user?.name?.charAt(0) ?? 'U'}</AvatarFallback>
                </Avatar>
                {sidebarExpanded && (
                  <div className="hidden md:flex flex-col">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-text-secondary">{user?.role}</span>
                  </div>
                )}
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

        <main className="flex-1 overflow-y-auto bg-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
