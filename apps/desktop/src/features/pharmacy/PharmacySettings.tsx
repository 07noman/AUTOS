import { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Printer,
  FileText,
  Save,
  CheckCircle,
  Database,
  Download,
} from 'lucide-react';
import {
  pharmacyDb,
  DEFAULT_SETTINGS,
  type PharmacySettingsConfig,
} from './pharmacyData';

export function PharmacySettings() {
  const [config, setConfig] = useState<PharmacySettingsConfig>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    pharmacyDb
      .getSettings()
      .then((data) => {
        if (mounted) setConfig(data);
      })
      .catch((err) => console.error('[PharmacySettings] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await pharmacyDb.saveSettings(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  const handleBackup = async () => {
    try {
      const [medicines, suppliers, customers, expenses, staff, settings, purchases] =
        await Promise.all([
          pharmacyDb.getMedicines(),
          pharmacyDb.getSuppliers(),
          pharmacyDb.getCustomers(),
          pharmacyDb.getExpenses(),
          pharmacyDb.getStaff(),
          pharmacyDb.getSettings(),
          pharmacyDb.getPurchases(),
        ]);

      const data = {
        medicines,
        suppliers,
        customers,
        expenses,
        staff,
        settings,
        purchases,
        backupDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to generate backup, check internet');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="text-[#00897b]" size={20} />
            <span>Pharmacy System & Hardware Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Store profile, drug regulatory license, thermal receipt layout, and database backup.
          </p>
        </div>

        <button
          type="button"
          onClick={handleBackup}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition self-start sm:self-auto cursor-pointer shadow-sm"
        >
          <Database size={15} />
          <span>Download Store Backup</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Pharmacy Profile Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store size={16} className="text-[#00897b]" />
            <span>Pharmacy & Regulatory License Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Pharmacy / Medical Store Name *</label>
              <input
                type="text"
                required
                value={config.pharmacyName}
                onChange={(e) => setConfig({ ...config, pharmacyName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Store Slogan / Tagline</label>
              <input
                type="text"
                value={config.tagline}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Drug License Number (DL #)</label>
              <input
                type="text"
                value={config.drugLicenseNumber}
                onChange={(e) => setConfig({ ...config, drugLicenseNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-teal-700 font-mono focus:bg-white focus:outline-none focus:border-teal-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Tax / STRN Registration Number</label>
              <input
                type="text"
                value={config.taxRegistrationNumber}
                onChange={(e) => setConfig({ ...config, taxRegistrationNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Store Phone / Contact</label>
              <input
                type="text"
                value={config.phone}
                onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Store Email</label>
              <input
                type="email"
                value={config.email}
                onChange={(e) => setConfig({ ...config, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Pharmacy Address</label>
              <input
                type="text"
                value={config.address}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Thermal Receipt Configuration */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Printer size={16} className="text-[#00897b]" />
            <span>Thermal Receipt & Printing Settings</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Thermal Printer Paper Width</label>
              <select
                value={config.printerType}
                onChange={(e) => setConfig({ ...config, printerType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="thermal_80mm">Standard 80mm POS Thermal Printer</option>
                <option value="thermal_58mm">Compact 58mm Thermal Printer</option>
                <option value="a4">Standard A4 / Laser Invoice</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="autoPrint"
                checked={config.autoPrintReceipt}
                onChange={(e) => setConfig({ ...config, autoPrintReceipt: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-0"
              />
              <label htmlFor="autoPrint" className="text-slate-700 font-medium">
                Auto-trigger print dialog after payment completion
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Receipt Header Text</label>
              <textarea
                rows={2}
                value={config.receiptHeader}
                onChange={(e) => setConfig({ ...config, receiptHeader: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500 font-mono text-[11px]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Receipt Footer Disclaimer (Drug Policies)</label>
              <textarea
                rows={2}
                value={config.receiptFooter}
                onChange={(e) => setConfig({ ...config, receiptFooter: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle size={14} />
              <span>Settings Saved Successfully!</span>
            </span>
          )}
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold shadow-sm transition cursor-pointer"
          >
            <Save size={15} />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default PharmacySettings;
