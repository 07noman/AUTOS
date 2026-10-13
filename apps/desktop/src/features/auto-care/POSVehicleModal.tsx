import React, { useState, useEffect } from 'react';
import {
  Car,
  User,
  Phone,
  Gauge,
  Tag,
  Search,
  X,
  Check,
  RotateCcw,
  History,
  Sparkles,
} from 'lucide-react';
import { vehicleRepo } from '@/lib/auto-care-db';
import { getCurrentTenantId } from '@/lib/db';
import type { Vehicle } from '@genx/types/domain/auto-care';

export interface POSVehicleDetails {
  customerName: string;
  regNo: string;
  make: string;
  model: string;
  mileage: string;
  phone?: string;
  year?: string;
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: POSVehicleDetails | null) => void;
  currentDetails: POSVehicleDetails | null;
}

const COMMON_MAKES = ['Toyota', 'Honda', 'Suzuki', 'KIA', 'Hyundai', 'Changan', 'MG', 'Nissan'];

const POPULAR_MODELS: Record<string, string[]> = {
  Toyota: ['Corolla', 'Yaris', 'Hilux / Revo', 'Fortuner', 'Prius', 'Vitz'],
  Honda: ['Civic', 'City', 'BR-V', 'Vezel', 'Accord'],
  Suzuki: ['Alto', 'Cultus', 'Wagon R', 'Swift', 'Mehran', 'Bolan', 'Every'],
  KIA: ['Sportage', 'Picanto', 'Stonic', 'Sorento', 'Carnival'],
  Hyundai: ['Tucson', 'Elantra', 'Sonata', 'Santa Fe', 'Porter'],
  Changan: ['Alsvin', 'Karvaan', 'Oshan X7'],
  MG: ['HS', 'ZS', 'GT'],
  Nissan: ['Dayz', 'Note', 'Sunny', 'Juke', 'Clippper'],
};

export default function POSVehicleModal({
  isOpen,
  onClose,
  onSave,
  currentDetails,
}: Props) {
  const [regNo, setRegNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('');
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [previousMileage, setPreviousMileage] = useState<number | null>(null);

  // Suggestions & vehicles cache
  const [savedVehicles, setSavedVehicles] = useState<Vehicle[]>([]);
  const [plateSuggestions, setPlateSuggestions] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (currentDetails) {
        setRegNo(currentDetails.regNo || '');
        setCustomerName(currentDetails.customerName || '');
        setPhone(currentDetails.phone || '');
        setMake(currentDetails.make || 'Toyota');
        setModel(currentDetails.model || '');
        setMileage(currentDetails.mileage || '');
        setNotes(currentDetails.notes || '');
      } else {
        setRegNo('');
        setCustomerName('');
        setPhone('');
        setMake('Toyota');
        setModel('');
        setMileage('');
        setNotes('');
        setPreviousMileage(null);
      }

      // Load existing vehicles for auto-suggestions
      const tenantId = getCurrentTenantId();
      void vehicleRepo.findAll(tenantId).then((vList) => {
        setSavedVehicles(vList || []);
      });
    }
  }, [isOpen, currentDetails]);

  // When regNo changes, check suggestions and existing vehicle auto-fill
  const handleRegNoChange = (value: string) => {
    setRegNo(value);
    const clean = value.trim().toUpperCase();
    if (clean.length >= 2) {
      const matches = savedVehicles.filter(
        (v) =>
          v.licensePlate?.toUpperCase().includes(clean) ||
          v.customerName?.toLowerCase().includes(clean.toLowerCase())
      );
      setPlateSuggestions(matches.slice(0, 5));
    } else {
      setPlateSuggestions([]);
    }
  };

  const handleSelectVehicle = (v: Vehicle) => {
    setRegNo(v.licensePlate);
    if (v.customerName) setCustomerName(v.customerName);
    if (v.make) setMake(v.make);
    if (v.model) setModel(v.model);
    if (v.mileage) {
      setPreviousMileage(v.mileage);
      setMileage(String(v.mileage));
    }
    setPlateSuggestions([]);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPlate = regNo.trim().toUpperCase();

    if (!cleanPlate && !customerName.trim()) {
      // Clear details (walk-in)
      onSave(null);
      onClose();
      return;
    }

    onSave({
      regNo: cleanPlate,
      customerName: customerName.trim() || 'Walk-in Customer',
      phone: phone.trim() || undefined,
      make: make.trim() || 'General',
      model: model.trim() || 'Vehicle',
      mileage: mileage.trim() || '0',
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleClear = () => {
    onSave(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                Vehicle & Customer Details
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/20">
                  POS
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Saved to vehicle history & printed on receipt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {/* Registration Number with Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-blue-600" />
                Vehicle Registration No. / Plate
              </span>
              <span className="text-[11px] text-blue-600 font-semibold normal-case">
                Required for history
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="e.g. LEE 20-5412, ABC-123, LEA-9988"
                value={regNo}
                onChange={(e) => handleRegNoChange(e.target.value)}
                className="w-full h-11 pl-3 pr-9 rounded-xl border-2 border-slate-300 bg-slate-50/50 text-sm font-bold tracking-wider uppercase text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              />
              {regNo && (
                <button
                  type="button"
                  onClick={() => handleRegNoChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {plateSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                  <span>Found in database:</span>
                  <span className="text-blue-600">Click to autofill</span>
                </div>
                {plateSuggestions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVehicle(v)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-blue-900 tracking-wide uppercase">
                        {v.licensePlate}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {v.make} {v.model} &bull; {v.customerName || 'No Name'}
                      </div>
                    </div>
                    {v.mileage && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {v.mileage.toLocaleString()} km
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Customer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Zeeshan Ahmed"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                Phone (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 0300-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Make & Quick Make selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5 text-slate-500" />
              Make (Brand)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_MAKES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMake(m)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    make === m
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type custom make..."
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none transition-all"
            />
          </div>

          {/* Model & Popular Model selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-slate-500" />
              Model / Variant
            </label>
            {POPULAR_MODELS[make] && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {POPULAR_MODELS[make].map((md) => (
                  <button
                    key={md}
                    type="button"
                    onClick={() => setModel(md)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      model === md
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {md}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="e.g. Corolla Altis, Civic, Alto VXR, Sportage"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Mileage (Current vs Previous) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-blue-600" />
                Current Mileage (KM)
              </label>
              {previousMileage != null && (
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  <History className="h-3 w-3" /> Last Visit: {previousMileage.toLocaleString()} km
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 45000"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="w-full h-10 pl-3 pr-12 rounded-xl border border-slate-300 text-sm font-semibold focus:border-blue-600 focus:outline-none transition-all placeholder:text-slate-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                KM
              </span>
            </div>
            {/* Quick Mileage adjustment pills if previous mileage exists */}
            {previousMileage != null && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">Quick add:</span>
                {[3000, 5000, 10000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => setMileage(String((previousMileage || 0) + inc))}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
                  >
                    +{(inc / 1000).toFixed(0)}k km
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="h-10 px-3.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200/70 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Walk-in (Clear)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Check className="h-4 w-4" />
              Apply to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
