import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Upload,
  Trash2,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Store,
  FileText,
  Sliders,
  Car,
  Layers,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { Button } from '@genx/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Badge } from '@genx/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { receiptSettingsRepo } from '@/lib/receipt-settings-repo';
import {
  ReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  ReceiptData,
  PaperWidth,
  BusinessType,
} from '../receipt/types';
import { ThermalReceipt } from '../receipt/ThermalReceipt';
import { printThermalReceipt } from '../receipt/print-service';
import { processLogoFile } from '../receipt/utils/logo-processor';

// Sample preview dataset matching professional automotive store thermal receipt
const SAMPLE_PREVIEW_DATA: ReceiptData = {
  orderNumber: 'AC-20261011-0008',
  date: new Date('2026-10-11T15:24:00'),
  cashierName: 'Ali Raza',
  terminalName: 'POS-01',
  branchName: 'Main Branch',
  customer: {
    name: 'Walk-in',
    phone: '0300-9876543',
    address: 'DHA Phase 6, Karachi',
    taxId: 'NTN-882194',
    previousBalance: 5000,
    remainingBalance: 22641,
  },
  vehicle: {
    makeModel: 'Corolla GLi (2020)',
    plateNumber: 'LEA-4921',
    mileage: '45,200 km',
    advisor: 'Hamza Khan',
    jobNumber: 'JOB-1042',
  },
  items: [
    {
      name: 'Engine Oil 5W-30 (4L)',
      brand: 'Castrol Magnatec',
      sku: 'OIL-001',
      compatibility: 'Universal Petrol Engines',
      warranty: 'Standard',
      quantity: 1,
      price: 6450,
      discount: 0,
      total: 6450,
    },
    {
      name: 'Oil Filter',
      brand: 'Toyota Genuine',
      sku: '90915-10004',
      compatibility: 'Toyota Corolla 2014-2024',
      warranty: '6 Months',
      quantity: 1,
      price: 850,
      discount: 0,
      total: 850,
    },
    {
      name: 'Air Filter',
      brand: 'Toyota Genuine',
      sku: '17801-0D060',
      compatibility: 'Toyota Corolla 1.3/1.6/1.8',
      warranty: '6 Months',
      quantity: 1,
      price: 1250,
      discount: 0,
      total: 1250,
    },
    {
      name: 'Spark Plug',
      brand: 'NGK',
      sku: 'BKR6E-11',
      compatibility: 'Laser Platinum',
      warranty: '10,000 KM',
      quantity: 4,
      price: 650,
      discount: 0,
      total: 2600,
    },
    {
      name: 'Brake Pad Set',
      brand: 'Akebono',
      sku: 'BP-TY-FRONT',
      compatibility: 'Toyota Corolla (Front)',
      warranty: '6 Months',
      quantity: 1,
      price: 3800,
      discount: 0,
      total: 3800,
    },
  ],
  subtotal: 14950,
  discount: 0,
  tax: 2691,
  taxRatePercent: 18,
  total: 17641,
  paymentMethod: 'cash',
  amountPaid: 17641,
  change: 0,
  notes: 'Customer requested 5,000 KM service reminder SMS',
  currency: 'PKR',
};

export function ReceiptBrandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'identity' | 'content' | 'toggles' | 'printer'>('identity');
  const [previewWidth, setPreviewWidth] = useState<PaperWidth>('80mm');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDitheredLogo, setIsDitheredLogo] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Load tenant settings
  useEffect(() => {
    const tenantId = user?.tenantId || 'default';
    void receiptSettingsRepo.getSettings(tenantId).then((res) => {
      setSettings(res);
      setInitialSettings(res);
      setPreviewWidth(res.paperWidth || '80mm');
    });
  }, [user?.tenantId]);

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const updateSetting = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    startTransition(() => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    });
  };

  // Logo upload & thermal preprocessing
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const result = await processLogoFile(file, {
      monochrome: isDitheredLogo,
      maxWidth: 420,
    });

    if (!result.valid || !result.dataUrl) {
      setUploadError(result.error || 'Failed to process logo image.');
      return;
    }

    updateSetting('logoUrl', result.dataUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop handler
  const handleLogoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploadError(null);

    const result = await processLogoFile(file, {
      monochrome: isDitheredLogo,
      maxWidth: 420,
    });

    if (!result.valid || !result.dataUrl) {
      setUploadError(result.error || 'Failed to process logo image.');
      return;
    }

    updateSetting('logoUrl', result.dataUrl);
  };

  const handleRemoveLogo = () => {
    updateSetting('logoUrl', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await receiptSettingsRepo.saveSettings({
        ...settings,
        paperWidth: previewWidth,
      });
      setSettings(saved);
      setInitialSettings(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save receipt settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all receipt customization to factory defaults?')) return;
    setIsSaving(true);
    try {
      const tenantId = user?.tenantId || 'default';
      const defaults = await receiptSettingsRepo.resetToDefaults(tenantId);
      setSettings(defaults);
      setInitialSettings(defaults);
      setPreviewWidth(defaults.paperWidth || '80mm');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError('Failed to reset settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintTest = async () => {
    await printThermalReceipt(SAMPLE_PREVIEW_DATA, {
      ...settings,
      paperWidth: previewWidth,
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2">
              <Printer className="h-6 w-6 text-primary" /> Receipt Branding & Customization
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              Customize your store identity, thermal typography, logo, and printed transaction fields.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="warning" className="animate-pulse">
              Unsaved Changes
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 shadow-md"
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Receipt settings saved successfully to Cloud and Local Database!
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          {saveError}
        </div>
      )}

      {/* ── 2-Column Responsive Workspace: Editor (Left) & Live Preview (Right) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Settings Tabs & Accordions (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-bg-subtle rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'identity'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-bg'
              }`}
            >
              <Store className="h-4 w-4" /> Business & Logo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'content'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-bg'
              }`}
            >
              <FileText className="h-4 w-4" /> Receipt Content
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('toggles')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'toggles'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-bg'
              }`}
            >
              <Car className="h-4 w-4" /> Fields & Auto Care
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('printer')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'printer'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-bg'
              }`}
            >
              <Sliders className="h-4 w-4" /> Printer & Paper
            </button>
          </div>

          {/* TAB 1: Business Identity & Logo */}
          {activeTab === 'identity' && (
            <div className="space-y-5 animate-fade-in">
              {/* Logo Upload Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" /> Store Logo (Thermal Print Optimized)
                    </span>
                    {settings.logoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="text-error hover:text-error text-xs h-7"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Logo
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleLogoDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-primary/60 transition-all rounded-xl p-5 text-center cursor-pointer bg-bg-subtle/40 hover:bg-bg-subtle"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp,image/tiff,image/x-icon"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    {settings.logoUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={settings.logoUrl}
                          alt="Store Logo"
                          className="max-h-24 object-contain bg-white p-2 rounded-lg border border-border shadow-sm"
                          style={{ width: `${settings.logoWidth}px` }}
                        />
                        <span className="text-xs text-primary font-medium">Click or drag new image to replace</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-text-secondary">
                        <Upload className="h-8 w-8 text-primary/70 mb-1" />
                        <span className="text-xs font-semibold text-text">Drag & drop logo here or browse</span>
                        <span className="text-[11px] text-text-muted">
                          Supports PNG, JPG, WebP, SVG, GIF, BMP, TIFF, ICO (Max 5MB)
                        </span>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="text-xs text-error flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {uploadError}
                    </div>
                  )}

                  {/* Logo Sizing & Alignment Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Logo Print Width ({settings.logoWidth}px)
                      </label>
                      <input
                        type="range"
                        min="80"
                        max="280"
                        step="5"
                        value={settings.logoWidth}
                        onChange={(e) => updateSetting('logoWidth', Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Alignment</label>
                      <select
                        value={settings.logoAlignment}
                        onChange={(e) => updateSetting('logoAlignment', e.target.value as any)}
                        className="w-full text-xs px-2.5 py-1.5 bg-bg border border-border rounded-lg"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="dither-opt"
                        checked={isDitheredLogo}
                        onChange={(e) => setIsDitheredLogo(e.target.checked)}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <label htmlFor="dither-opt" className="text-xs font-medium text-text cursor-pointer">
                        Monochrome dithering
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Identity Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" /> Store Information & Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Store / Business Name *</label>
                      <input
                        type="text"
                        value={settings.businessName}
                        onChange={(e) => updateSetting('businessName', e.target.value)}
                        placeholder="e.g. Auto Care Store"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Business Type</label>
                      <select
                        value={settings.businessType}
                        onChange={(e) => updateSetting('businessType', e.target.value as BusinessType)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="auto_care">Auto Care / Workshop</option>
                        <option value="auto_parts">Auto Parts & Accessories</option>
                        <option value="retail">Retail Shop</option>
                        <option value="supermarket">Supermarket / Mart</option>
                        <option value="restaurant">Restaurant / Cafe</option>
                        <option value="workshop">General Workshop</option>
                        <option value="other">Other Business</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Brand Heading / Subtitle</label>
                      <input
                        type="text"
                        value={settings.brandTitle || ''}
                        onChange={(e) => updateSetting('brandTitle', e.target.value)}
                        placeholder="e.g. PARTS & ACCESSORIES"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Slogan / Tagline</label>
                      <input
                        type="text"
                        value={settings.tagline || ''}
                        onChange={(e) => updateSetting('tagline', e.target.value)}
                        placeholder="e.g. BETTER PARTS . SMOOTHER DRIVES"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Store Address</label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => updateSetting('address', e.target.value)}
                      placeholder="e.g. Shop # 12, Main Auto Market"
                      className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={settings.city}
                        onChange={(e) => updateSetting('city', e.target.value)}
                        placeholder="Karachi"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Country / Region</label>
                      <input
                        type="text"
                        value={settings.country}
                        onChange={(e) => updateSetting('country', e.target.value)}
                        placeholder="Sindh, Pakistan"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={settings.phone}
                        onChange={(e) => updateSetting('phone', e.target.value)}
                        placeholder="021-34567890"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">WhatsApp Number</label>
                      <input
                        type="text"
                        value={settings.whatsapp || ''}
                        onChange={(e) => updateSetting('whatsapp', e.target.value)}
                        placeholder="0300-1234567"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Tax ID / NTN / GST (Optional)</label>
                      <input
                        type="text"
                        value={settings.taxId || ''}
                        onChange={(e) => updateSetting('taxId', e.target.value)}
                        placeholder="NTN-1234567-8"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Registration / Trade License</label>
                      <input
                        type="text"
                        value={settings.businessRegNo || ''}
                        onChange={(e) => updateSetting('businessRegNo', e.target.value)}
                        placeholder="REG-2026-991"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: Receipt Content & Policies */}
          {activeTab === 'content' && (
            <div className="space-y-5 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Title, Footer & Policies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Receipt Document Title</label>
                      <select
                        value={settings.receiptTitle}
                        onChange={(e) => updateSetting('receiptTitle', e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      >
                        <option value="SALES RECEIPT">SALES RECEIPT</option>
                        <option value="TAX INVOICE">TAX INVOICE</option>
                        <option value="CASH MEMO">CASH MEMO</option>
                        <option value="SERVICE INVOICE">SERVICE INVOICE</option>
                        <option value="ESTIMATE / QUOTATION">ESTIMATE / QUOTATION</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Social Media Handle</label>
                      <input
                        type="text"
                        value={settings.socialMedia || ''}
                        onChange={(e) => updateSetting('socialMedia', e.target.value)}
                        placeholder="@autocarepk"
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Primary Thank You Message</label>
                    <input
                      type="text"
                      value={settings.footerThankYou}
                      onChange={(e) => updateSetting('footerThankYou', e.target.value)}
                      placeholder="Thank You For Choosing Auto Care!"
                      className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Secondary Footer Message / Slogan</label>
                    <input
                      type="text"
                      value={settings.footerMessage || ''}
                      onChange={(e) => updateSetting('footerMessage', e.target.value)}
                      placeholder="Keep Your Engine Happy"
                      className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Return / Exchange Policy</label>
                    <textarea
                      rows={2}
                      value={settings.returnPolicy || ''}
                      onChange={(e) => updateSetting('returnPolicy', e.target.value)}
                      placeholder="7 Days Return with Original Receipt. Electrical parts are non-refundable."
                      className="w-full text-xs p-2.5 bg-bg border border-border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Warranty Disclaimer</label>
                    <textarea
                      rows={2}
                      value={settings.warrantyDisclaimer || ''}
                      onChange={(e) => updateSetting('warrantyDisclaimer', e.target.value)}
                      placeholder="Warranty claims must be accompanied by this receipt."
                      className="w-full text-xs p-2.5 bg-bg border border-border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2 p-3 bg-bg-subtle rounded-lg">
                      <input
                        type="checkbox"
                        id="show-barcode"
                        checked={settings.showBarcode}
                        onChange={(e) => updateSetting('showBarcode', e.target.checked)}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <label htmlFor="show-barcode" className="text-xs font-medium text-text cursor-pointer">
                        Print 1D Barcode (Code 128)
                      </label>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-bg-subtle rounded-lg">
                      <input
                        type="checkbox"
                        id="show-qrcode"
                        checked={settings.showQrCode}
                        onChange={(e) => updateSetting('showQrCode', e.target.checked)}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <label htmlFor="show-qrcode" className="text-xs font-medium text-text cursor-pointer">
                        Print QR Code (Verification)
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: Fields & Auto Care Toggles */}
          {activeTab === 'toggles' && (
            <div className="space-y-5 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> Printed Transaction Fields
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { key: 'showInvoiceNumber', label: 'Receipt / Invoice Number' },
                      { key: 'showDateTime', label: 'Sale Date & Time' },
                      { key: 'showCashier', label: 'Cashier / Served By' },
                      { key: 'showTerminal', label: 'Terminal / Register #' },
                      { key: 'showBranch', label: 'Branch Name' },
                      { key: 'showCustomerName', label: 'Customer Name' },
                      { key: 'showCustomerPhone', label: 'Customer Phone' },
                      { key: 'showCustomerAddress', label: 'Customer Address' },
                      { key: 'showPaymentMethod', label: 'Payment Method' },
                      { key: 'showChange', label: 'Change Returned (Cash)' },
                      { key: 'showCreditBalance', label: 'Customer Credit Balance' },
                      { key: 'showOrderNotes', label: 'Order / Customer Notes' },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 p-2.5 bg-bg-subtle/70 hover:bg-bg-subtle rounded-lg cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(settings[key as keyof ReceiptSettings])}
                          onChange={(e) => updateSetting(key as keyof ReceiptSettings, e.target.checked as any)}
                          className="accent-primary h-4 w-4 rounded"
                        />
                        <span className="text-xs font-medium text-text">{label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Auto Care Technical Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" /> Auto Care & Parts Technical Fields
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-text-muted">
                    These fields only print when vehicle data actually exists in the completed sale.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { key: 'showVehicleInfo', label: 'Vehicle Section' },
                      { key: 'showVehicleMakeModel', label: 'Vehicle Make & Model' },
                      { key: 'showVehiclePlate', label: 'License Plate Number' },
                      { key: 'showVehicleMileage', label: 'Odometer / Mileage' },
                      { key: 'showMechanic', label: 'Service Advisor / Mechanic' },
                      { key: 'showJobNumber', label: 'Job Card / Job Number' },
                      { key: 'showPartNumber', label: 'Part Number / SKU' },
                      { key: 'showProductBrand', label: 'Product Brand (e.g. Castrol)' },
                      { key: 'showVehicleCompatibility', label: 'Vehicle Compatibility Subtext' },
                      { key: 'showWarrantyDetails', label: 'Warranty Duration' },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 p-2.5 bg-bg-subtle/70 hover:bg-bg-subtle rounded-lg cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(settings[key as keyof ReceiptSettings])}
                          onChange={(e) => updateSetting(key as keyof ReceiptSettings, e.target.checked as any)}
                          className="accent-primary h-4 w-4 rounded"
                        />
                        <span className="text-xs font-medium text-text">{label}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: Printer & Paper Formatting */}
          {activeTab === 'printer' && (
            <div className="space-y-5 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Thermal Hardware & Paper Sizing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Paper Width</label>
                      <select
                        value={previewWidth}
                        onChange={(e) => {
                          const val = e.target.value as PaperWidth;
                          setPreviewWidth(val);
                          updateSetting('paperWidth', val);
                        }}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      >
                        <option value="80mm">80mm Thermal (Standard POS)</option>
                        <option value="58mm">58mm Thermal (Compact Mobile POS)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Receipt Font Size</label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSetting('fontSize', e.target.value as any)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      >
                        <option value="compact">Compact (Saves Paper)</option>
                        <option value="standard">Standard (Recommended)</option>
                        <option value="large">Large / High Visibility</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Font Family</label>
                      <select
                        value={settings.fontFamily}
                        onChange={(e) => updateSetting('fontFamily', e.target.value as any)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      >
                        <option value="monospace">Thermal Monospace (Clean & Crisp)</option>
                        <option value="sans-serif">Sans-Serif (Modern Clean)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Line Spacing</label>
                      <select
                        value={settings.lineSpacing}
                        onChange={(e) => updateSetting('lineSpacing', e.target.value as any)}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      >
                        <option value="compact">Compact</option>
                        <option value="normal">Normal</option>
                        <option value="relaxed">Relaxed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Feed Blank Lines ({settings.feedLines})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="8"
                        value={settings.feedLines}
                        onChange={(e) => updateSetting('feedLines', Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">ℹ️ Browser Printing Note</p>
                    <p className="text-[11px] leading-relaxed">
                      Standard web browsers invoke the operating system print dialog. Silent auto-cutting and cash drawer kick
                      require the Tauri desktop native bridge or an ESC/POS hardware print agent.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Real-time Thermal Receipt Preview (5 Cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-3">
          <div className="flex items-center justify-between bg-bg-subtle px-3 py-2 rounded-xl border border-border">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-primary" /> Live Thermal Preview
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewWidth('80mm')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  previewWidth === '80mm'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-bg text-text-secondary hover:text-text'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPreviewWidth('58mm')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  previewWidth === '58mm'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-bg text-text-secondary hover:text-text'
                }`}
              >
                58mm
              </button>
            </div>
          </div>

          {/* Thermal Receipt Visual Card */}
          <div className="p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-border flex justify-center overflow-x-auto min-h-[500px]">
            <ThermalReceipt
              data={SAMPLE_PREVIEW_DATA}
              settings={settings}
              paperWidthOverride={previewWidth}
              preview={true}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <span>Sample data preview</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintTest}
              className="flex items-center gap-1.5 text-xs shadow-sm bg-bg hover:bg-bg-subtle"
            >
              <Printer className="h-3.5 w-3.5 text-primary" /> Print Test Receipt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReceiptBrandingPage;
