import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  ArrowLeft,
  CheckCircle,
  Printer,
  Barcode,
  Wifi,
  User,
  Shield,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Button } from '@genx/ui/Button';
import { Badge } from '@genx/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';

const BUSINESS_DETAILS: Record<
  string,
  { name: string; icon: string; desc: string }
> = {
  restaurant: { name: 'Restaurant', icon: '🍽️', desc: 'Tables, menus, kitchen orders and KOT' },
  bakery: { name: 'Bakery', icon: '🥐', desc: 'Fast counter sales and bakery products' },
  mart: { name: 'Mart & Grocery', icon: '🛒', desc: 'Inventory, barcode sales and stock management' },
  retail: { name: 'Retail Shop', icon: '🛍️', desc: 'Simple and flexible retail point of sale' },
  clothing: { name: 'Clothing', icon: '👕', desc: 'Products with sizes, colors and variants' },
  furniture: { name: 'Furniture', icon: '🛋️', desc: 'Products, stock, quotations and customer orders' },
  bar: { name: 'Cafe & Bar', icon: '☕', desc: 'Counter sales, tables and quick service' },
  'auto-parts': { name: 'Auto Parts', icon: '🔧', desc: 'Parts inventory, sales and vehicle records' },
  auto_care: { name: 'Auto Care / Service', icon: '🔧', desc: 'Jobs, mechanics, vehicle service and parts' },
  general: { name: 'General POS', icon: '📦', desc: 'A flexible POS setup for your business' },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status, pendingCount, refreshPending } = useConnectivity();

  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [barcodeAutoFocus, setBarcodeAutoFocus] = useState(true);
  const [taxRate, setTaxRate] = useState('8.0');
  const [currency, setCurrency] = useState('USD ($)');
  const [savedMessage, setSavedMessage] = useState('');

  const selectedModule = localStorage.getItem('genx:selectedModule') || 'general';
  const currentBusiness = BUSINESS_DETAILS[selectedModule] || {
    name: selectedModule,
    icon: '🏪',
    desc: 'Point of sale configuration',
  };

  const handleSwitchBusinessType = () => {
    localStorage.removeItem('genx:selectedModule');
    navigate('/select-module');
  };

  const handleSaveSettings = () => {
    setSavedMessage('Settings saved successfully');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your store, POS preferences, and active business configuration
          </p>
        </div>
        {savedMessage && (
          <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-lg animate-fade-in">
            <CheckCircle className="h-4 w-4" />
            {savedMessage}
          </div>
        )}
      </div>

      {/* Active Business Type Card */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl p-2 bg-white dark:bg-bg rounded-xl shadow-sm border border-border">
              {currentBusiness.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-primary tracking-wide">
                  Active POS Configuration
                </span>
                <Badge variant="success">Active</Badge>
              </div>
              <h2 className="text-lg font-bold text-text mt-0.5">{currentBusiness.name}</h2>
              <p className="text-xs text-text-secondary mt-0.5">{currentBusiness.desc}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSwitchBusinessType}
            className="flex items-center gap-2 shrink-0 bg-white dark:bg-bg-elevated hover:border-primary"
          >
            <RefreshCw className="h-4 w-4 text-primary" />
            Change Business Type
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Store & Financial Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Store & Tax
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Store Location / Branch
              </label>
              <input
                type="text"
                disabled
                value="Main Branch"
                className="w-full text-sm px-3 py-2 bg-bg-subtle border border-border rounded-lg text-text cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>USD ($)</option>
                <option>EUR (€)</option>
                <option>GBP (£)</option>
                <option>CAD ($)</option>
                <option>PKR (Rs)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Default Sales Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button onClick={handleSaveSettings} size="sm" className="w-full mt-2">
              Save Store Settings
            </Button>
          </CardContent>
        </Card>

        {/* POS Hardware & Workstation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" /> Hardware & Scanning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg">
              <div className="flex items-center gap-3">
                <Barcode className="h-5 w-5 text-text-muted" />
                <div>
                  <div className="text-sm font-medium text-text">Barcode Auto-Focus</div>
                  <div className="text-xs text-text-secondary">Keep search focused for barcode scanner input</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={barcodeAutoFocus}
                onChange={(e) => setBarcodeAutoFocus(e.target.checked)}
                className="h-4 w-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg">
              <div className="flex items-center gap-3">
                <Printer className="h-5 w-5 text-text-muted" />
                <div>
                  <div className="text-sm font-medium text-text">Auto-Print Receipt</div>
                  <div className="text-xs text-text-secondary">Print receipt immediately after payment</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={receiptAutoPrint}
                onChange={(e) => setReceiptAutoPrint(e.target.checked)}
                className="h-4 w-4 accent-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-text-muted" />
                <div>
                  <div className="text-sm font-medium text-text">Database & Sync Mode</div>
                  <div className="text-xs text-text-secondary">
                    {status === 'online' ? 'Online · SQLite outbox sync active' : 'Offline · Local SQLite active'}
                  </div>
                </div>
              </div>
              <Badge variant={status === 'online' ? 'success' : 'warning'}>
                {status === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshPending()}
              className="w-full"
            >
              Verify Sync Status ({pendingCount} pending)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Account & Session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Current User & Session
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text">{user?.name || 'Demo User'}</div>
            <div className="text-xs text-text-secondary">{user?.email || 'demo@genx.com'}</div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-text-muted">Role:</span>
              <span className="text-xs font-mono bg-bg-subtle px-2 py-0.5 rounded text-text">
                {user?.role || 'owner'}
              </span>
              <span className="text-xs text-text-muted">Tenant:</span>
              <span className="text-xs font-mono bg-bg-subtle px-2 py-0.5 rounded text-text">
                {user?.tenantId || 'tenant-1'}
              </span>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={logout}
            className="flex items-center gap-2 shrink-0"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
