import { useState, useEffect } from 'react';
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
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  RotateCcw,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Button } from '@genx/ui/Button';
import { Badge } from '@genx/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { AUTO_CARE_APPS } from '@/features/auto-care/AutoCareHome';
import {
  getAppSettings,
  updateAppSettings,
  hashPasscode,
  lockAllModules,
  lockModule,
  isModuleUnlocked,
} from '@/lib/app-settings';

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
  'auto-parts': { name: 'Business pos & store', icon: '🏪', desc: 'Point of sale, store inventory and customer records' },
  auto_care: { name: 'Business pos & store', icon: '🏪', desc: 'Point of sale, store inventory and customer records' },
  general: { name: 'General POS', icon: '📦', desc: 'A flexible POS setup for your business' },
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { status, pendingCount, refreshPending } = useConnectivity();

  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [barcodeAutoFocus, setBarcodeAutoFocus] = useState(true);
  const [taxRate, setTaxRate] = useState(() => localStorage.getItem('genx:default_tax_rate') ?? '0');
  const [currency, setCurrency] = useState(() => localStorage.getItem('genx:store_currency') ?? 'PKR (Rs)');
  const [savedMessage, setSavedMessage] = useState('');

  // Feature 1: Master Passcode Protection State
  const [passcodeEnabled, setPasscodeEnabled] = useState(false);
  const [hasExistingPasscode, setHasExistingPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState('');
  const [passcodeSuccess, setPasscodeSuccess] = useState('');
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);

  // Feature 2: Module Visibility State
  const [hiddenModules, setHiddenModules] = useState<string[]>([]);
  const [modulesSuccess, setModulesSuccess] = useState('');

  // Feature 3: Per-Module Passcode Lock State
  const [lockedModules, setLockedModules] = useState<Set<string>>(() => {
    const locked = new Set<string>();
    AUTO_CARE_APPS.forEach((app) => {
      if (!isModuleUnlocked(app.name)) locked.add(app.name);
    });
    return locked;
  });
  const [moduleLockSuccess, setModuleLockSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (isMounted) {
          setPasscodeEnabled(settings.is_passcode_enabled);
          setHasExistingPasscode(Boolean(settings.master_passcode));
          setHiddenModules(settings.hidden_modules || []);
        }
      } catch (err) {
        console.warn('[SettingsPage] Error loading app settings:', err);
      }
    })();

    const handleSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail && isMounted) {
        setPasscodeEnabled(Boolean(custom.detail.is_passcode_enabled));
        setHasExistingPasscode(Boolean(custom.detail.master_passcode));
        setHiddenModules(custom.detail.hidden_modules || []);
      }
    };

    window.addEventListener('app_settings_changed', handleSettingsChanged);
    return () => {
      isMounted = false;
      window.removeEventListener('app_settings_changed', handleSettingsChanged);
    };
  }, []);

  const handleTogglePasscodeProtection = async (checked: boolean) => {
    setPasscodeError('');
    setPasscodeSuccess('');
    if (checked && !hasExistingPasscode) {
      setPasscodeError('Please set and save a 4-digit passcode below before enabling protection.');
      return;
    }
    setPasscodeEnabled(checked);
    await updateAppSettings({ is_passcode_enabled: checked });
    setPasscodeSuccess(
      checked
        ? 'Master passcode protection activated!'
        : 'Master passcode protection disabled.'
    );
    setTimeout(() => setPasscodeSuccess(''), 3500);
  };

  const handleSavePasscode = async () => {
    setPasscodeError('');
    setPasscodeSuccess('');

    if (!/^\d{4}$/.test(passcode)) {
      setPasscodeError('Passcode must be exactly 4 digits (numeric only).');
      return;
    }
    if (passcode !== confirmPasscode) {
      setPasscodeError('Passcodes do not match.');
      return;
    }

    setIsSavingPasscode(true);
    try {
      const hashed = await hashPasscode(passcode);
      await updateAppSettings({
        master_passcode: hashed,
        is_passcode_enabled: true,
      });
      setPasscodeEnabled(true);
      setHasExistingPasscode(true);
      setPasscode('');
      setConfirmPasscode('');
      setPasscodeSuccess('Master passcode successfully saved & protection enabled!');
      setTimeout(() => setPasscodeSuccess(''), 3500);
    } catch (err) {
      console.error('[SettingsPage] Save passcode error:', err);
      setPasscodeError('Failed to save passcode. Please try again.');
    } finally {
      setIsSavingPasscode(false);
    }
  };

  const handleRemovePasscode = async () => {
    setPasscodeError('');
    setPasscodeSuccess('');
    setIsSavingPasscode(true);
    try {
      await updateAppSettings({
        master_passcode: null,
        is_passcode_enabled: false,
      });
      setPasscodeEnabled(false);
      setHasExistingPasscode(false);
      setPasscode('');
      setConfirmPasscode('');
      lockAllModules();
      setPasscodeSuccess('Master passcode removed and protection disabled.');
      setTimeout(() => setPasscodeSuccess(''), 3500);
    } catch (err) {
      console.error('[SettingsPage] Remove passcode error:', err);
      setPasscodeError('Failed to remove passcode.');
    } finally {
      setIsSavingPasscode(false);
    }
  };

  const handleToggleModule = async (moduleName: string) => {
    if (moduleName === 'Settings') return; // Settings is always visible
    const nextHidden = hiddenModules.includes(moduleName)
      ? hiddenModules.filter((m) => m !== moduleName)
      : [...hiddenModules, moduleName];

    setHiddenModules(nextHidden);
    await updateAppSettings({ hidden_modules: nextHidden });
  };

  const handleShowAllModules = async () => {
    setHiddenModules([]);
    await updateAppSettings({ hidden_modules: [] });
    setModulesSuccess('All modules are now visible on the launcher dashboard.');
    setTimeout(() => setModulesSuccess(''), 3500);
  };

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
    const parsedTax = Math.max(0, parseFloat(taxRate) || 0);
    localStorage.setItem('genx:default_tax_rate', String(parsedTax));
    localStorage.setItem('genx:store_currency', currency);
    window.dispatchEvent(
      new CustomEvent('genx:tax-rate-changed', {
        detail: { taxRate: parsedTax, currency },
      })
    );
    setSavedMessage(`Settings saved! Default Tax: ${parsedTax}%, Currency: ${currency}`);
    setTimeout(() => setSavedMessage(''), 3500);
  };

  const handleToggleModuleLock = (moduleName: string) => {
    if (lockedModules.has(moduleName)) {
      // Module is currently locked (session-expired). Just keep it locked.
      // User must go through the passcode screen to unlock.
      setModuleLockSuccess(`"${moduleName}" is locked. Enter passcode on the module to unlock.`);
    } else {
      // Module is currently unlocked — lock it now
      lockModule(moduleName);
      setLockedModules((prev) => {
        const next = new Set(prev);
        next.add(moduleName);
        return next;
      });
      setModuleLockSuccess(`"${moduleName}" locked — passcode required to access.`);
    }
    setTimeout(() => setModuleLockSuccess(''), 3500);
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

      {/* ======================================================================
          FEATURE 1: SECURITY SETTINGS (MASTER PASSCODE)
      ======================================================================= */}
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Security Settings
            </CardTitle>
            <Badge variant={passcodeEnabled ? 'success' : 'default'}>
              {passcodeEnabled ? 'Passcode Protection Active' : 'Passcode Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Toggle Passcode Protection */}
          <div className="flex items-center justify-between p-4 bg-bg-subtle rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {passcodeEnabled ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-text">Enable Master Passcode Protection</div>
                <div className="text-xs text-text-secondary">
                  Prompt for 4-digit master passcode when opening modules from the dashboard
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={passcodeEnabled}
                onChange={(e) => void handleTogglePasscodeProtection(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Form to Set / Change Passcode */}
          <div className="p-4 rounded-xl border border-border bg-bg-subtle/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {hasExistingPasscode ? 'Change Master Passcode' : 'Set 4-Digit Master Passcode'}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {hasExistingPasscode
                    ? 'A master passcode is currently configured. Enter a new 4-digit code below to update it.'
                    : 'Set a 4-digit numeric passcode to secure access to all modules.'}
                </p>
              </div>
              {hasExistingPasscode && (
                <Badge variant="success" className="text-xs">
                  Passcode Configured
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Set 4-Digit Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={passcode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPasscode(val);
                      setPasscodeError('');
                    }}
                    className="w-full text-base tracking-widest px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1"
                    aria-label="Toggle show passcode"
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Confirm Passcode
                </label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="••••"
                  value={confirmPasscode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPasscode(val);
                    setPasscodeError('');
                  }}
                  className="w-full text-base tracking-widest px-3 py-2 bg-bg border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Error & Success alerts */}
            {passcodeError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {passcodeError}
              </div>
            )}
            {passcodeSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <Check className="h-4 w-4 shrink-0" />
                {passcodeSuccess}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="sm"
                disabled={isSavingPasscode || passcode.length !== 4 || confirmPasscode.length !== 4}
                onClick={handleSavePasscode}
                className="flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                {isSavingPasscode ? 'Saving Passcode...' : 'Save Passcode'}
              </Button>

              {hasExistingPasscode && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSavingPasscode}
                  onClick={handleRemovePasscode}
                  className="text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
                >
                  Change / Remove Passcode
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================================
          FEATURE 2: MANAGE MODULES VISIBILITY (HIDE ANY MODULE)
      ======================================================================= */}
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> Manage Modules Visibility
              </CardTitle>
              <p className="text-xs text-text-secondary mt-1">
                Control which modules appear on the main launcher dashboard. Hidden modules will not be shown.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-muted">
                {16 - hiddenModules.length} of 16 visible
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowAllModules}
                className="flex items-center gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Show All Modules
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {modulesSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
              <Check className="h-4 w-4 shrink-0" />
              {modulesSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3">
            {AUTO_CARE_APPS.map((app) => {
              const Icon = app.icon;
              const isHidden = hiddenModules.includes(app.name);
              const isSettings = app.name === 'Settings';

              return (
                <div
                  key={app.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    isHidden
                      ? 'border-border/60 bg-bg-subtle/30 opacity-60'
                      : 'border-border bg-bg-subtle/80 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${app.iconBg}`}
                    >
                      <Icon className="h-5 w-5 drop-shadow" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text flex items-center gap-1.5">
                        {app.name}
                        {isSettings && (
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
                            Always Visible
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {isSettings ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Eye className="h-3 w-3" /> Core System (Always Visible)
                          </span>
                        ) : isHidden ? (
                          <span className="text-rose-400 flex items-center gap-1">
                            <EyeOff className="h-3 w-3" /> Hidden from Dashboard
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Eye className="h-3 w-3" /> Visible on Dashboard
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    className={`relative inline-flex items-center ${
                      isSettings ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isSettings}
                      checked={!isHidden}
                      onChange={() => void handleToggleModule(app.name)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ======================================================================
          FEATURE 3: PER-MODULE PASSCODE LOCK
      ======================================================================= */}
      {passcodeEnabled && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" /> Select Module to Set Passcode
                </CardTitle>
                <p className="text-xs text-text-secondary mt-1">
                  Lock individual modules with the master passcode. Locked modules require passcode entry to access.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  lockAllModules();
                  const allLocked = new Set(AUTO_CARE_APPS.map((a) => a.name));
                  setLockedModules(allLocked);
                  setModuleLockSuccess('All modules locked!');
                  setTimeout(() => setModuleLockSuccess(''), 3000);
                }}
                className="flex items-center gap-1.5 text-xs shrink-0"
              >
                <Lock className="h-3.5 w-3.5" /> Lock All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {moduleLockSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                <Check className="h-4 w-4 shrink-0" />
                {moduleLockSuccess}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AUTO_CARE_APPS.map((app) => {
                const Icon = app.icon;
                const isLocked = lockedModules.has(app.name);
                const isSettings = app.name === 'Settings';
                return (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      isLocked
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-emerald-500/30 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm ${app.iconBg}`}
                      >
                        <Icon className="h-4 w-4 drop-shadow" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text">{app.name}</div>
                        <div className="text-xs flex items-center gap-1">
                          {isLocked ? (
                            <span className="text-rose-400 flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Locked — passcode required
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Unlock className="h-3 w-3" /> Unlocked this session
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isSettings && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleModuleLock(app.name)}
                        className={`h-8 px-3 text-xs font-medium ${
                          isLocked
                            ? 'text-rose-400 hover:bg-rose-500/10'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="h-3.5 w-3.5 mr-1" /> Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5 mr-1" /> Lock Now
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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

            {/* Receipt & Printer Branding Card */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 mt-0.5">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-text">Receipt & Printer Settings</div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Customize store logo, 58mm/80mm paper, brand title, return policies, and printed fields.
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(
                    selectedModule === 'auto_care' || selectedModule === 'auto-parts'
                      ? '/auto-care/settings/receipt-branding'
                      : '/settings/receipt-branding'
                  )
                }
                className="w-full flex items-center justify-center gap-2 mt-1 shadow-sm"
              >
                <Sparkles className="h-4 w-4" /> Open Receipt Branding
              </Button>
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
                {user?.tenantId || 'N/A'}
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
