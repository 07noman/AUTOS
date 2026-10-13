import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Search,
  Calendar,
  Clock,
  Gauge,
  User,
  Phone,
  Wrench,
  Droplets,
  CreditCard,
  FileText,
  Printer,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { vehicleRepo, posOrderRepo, type POSOrder } from '@/lib/auto-care-db';
import { getCurrentTenantId } from '@/lib/db';
import type { Vehicle } from '@genx/types/domain/auto-care';

export default function VehicleHistoryView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allOrders, setAllOrders] = useState<POSOrder[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = getCurrentTenantId();

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, oList] = await Promise.all([
        vehicleRepo.findAll(tenantId),
        posOrderRepo.findAll(tenantId),
      ]);
      setVehicles(vList || []);
      setAllOrders(oList || []);

      // If no vehicle selected yet, select the first vehicle with orders or first vehicle
      if (!selectedPlate && vList && vList.length > 0) {
        setSelectedPlate(vList[0].licensePlate);
      }
    } catch (err) {
      console.error('Failed to load vehicle history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [tenantId]);

  // Normalize registration plate
  const cleanSearch = search.trim().toUpperCase();

  // Filtered vehicles list for search/sidebar
  const filteredVehicles = useMemo(() => {
    if (!cleanSearch) return vehicles;
    return vehicles.filter(
      (v) =>
        v.licensePlate.toUpperCase().includes(cleanSearch) ||
        (v.customerName && v.customerName.toUpperCase().includes(cleanSearch)) ||
        v.make.toUpperCase().includes(cleanSearch) ||
        v.model.toUpperCase().includes(cleanSearch)
    );
  }, [vehicles, cleanSearch]);

  // Selected vehicle object
  const selectedVehicle = useMemo(() => {
    if (!selectedPlate) return null;
    const clean = selectedPlate.trim().toUpperCase();
    return vehicles.find((v) => v.licensePlate.trim().toUpperCase() === clean) || null;
  }, [vehicles, selectedPlate]);

  // History orders for selected vehicle
  const vehicleOrders = useMemo(() => {
    if (!selectedPlate) return [];
    const clean = selectedPlate.trim().toUpperCase();

    return allOrders
      .filter((o) => {
        if (o.vehiclePlateNumber && o.vehiclePlateNumber.trim().toUpperCase() === clean) return true;
        if (o.notes) {
          try {
            const parsed = JSON.parse(o.notes);
            if (parsed?.vehicle?.plateNumber && String(parsed.vehicle.plateNumber).trim().toUpperCase() === clean) return true;
            if (parsed?.vehicle?.regNo && String(parsed.vehicle.regNo).trim().toUpperCase() === clean) return true;
          } catch {}
        }
        return false;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allOrders, selectedPlate]);

  // Aggregated stats for selected vehicle
  const stats = useMemo(() => {
    const totalSpent = vehicleOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const visitCount = vehicleOrders.length;
    const lastVisit = vehicleOrders[0]?.createdAt || selectedVehicle?.updatedAt || null;

    // Latest recorded mileage
    let latestMileage: number | string = selectedVehicle?.mileage || '—';
    for (const o of vehicleOrders) {
      if (o.vehicleMileage) {
        latestMileage = o.vehicleMileage;
        break;
      }
    }

    return { totalSpent, visitCount, lastVisit, latestMileage };
  }, [vehicleOrders, selectedVehicle]);

  // Helper to detect if an order included an oil change
  const isOilChange = (order: POSOrder) => {
    const keywords = ['OIL', 'MOBIL', 'LUBE', 'FILTER', 'SYNTHETIC', '20W50', '5W30', '10W40', '0W20'];
    return (order.items || []).some((it) =>
      keywords.some((k) => (it.name || '').toUpperCase().includes(k))
    );
  };

  const handlePrintHistory = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                Vehicle History Module
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Auto Care
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Complete service logs, oil change records, replaced parts & mileage tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedPlate && (
            <button
              onClick={handlePrintHistory}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print History
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Search/Vehicle List + Right Service History Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Vehicle Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Reg No (e.g. LEE 20-5412) or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:border-blue-600 focus:outline-none shadow-sm transition-all placeholder:text-slate-400 uppercase"
            />
          </div>

          {/* Vehicle List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[700px]">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-blue-600" />
                Vehicles ({filteredVehicles.length})
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Select to inspect</span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filteredVehicles.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Car className="h-8 w-8 mx-auto stroke-1" />
                  <p className="text-xs font-medium">No vehicles found matching search</p>
                </div>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected =
                    selectedPlate?.trim().toUpperCase() === v.licensePlate.trim().toUpperCase();
                  const ordersCount = allOrders.filter(
                    (o) =>
                      o.vehiclePlateNumber?.trim().toUpperCase() ===
                      v.licensePlate.trim().toUpperCase()
                  ).length;

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedPlate(v.licensePlate)}
                      className={`w-full p-3.5 text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border-l-4 border-blue-600 text-blue-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs tracking-wider uppercase px-2 py-0.5 rounded bg-slate-900 text-white">
                            {v.licensePlate}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {v.make} {v.model}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                          <span className="truncate">{v.customerName || 'Walk-in'}</span>
                          {v.mileage && (
                            <span className="font-medium text-emerald-700 shrink-0">
                              &bull; {v.mileage.toLocaleString()} km
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-slate-400">
                        {ordersCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {ordersCount}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Vehicle Profile & Complete Service History (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedPlate ? (
            <>
              {/* Vehicle Profile Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                  <div className="flex items-start sm:items-center gap-4">
                    {/* License Plate Graphic */}
                    <div className="px-4 py-2 bg-white text-slate-950 rounded-xl font-black text-lg tracking-wider border-2 border-slate-300 shadow-inner flex flex-col items-center justify-center min-w-[130px]">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        REG NO.
                      </span>
                      <span>{selectedPlate}</span>
                    </div>

                    <div>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        {selectedVehicle?.make || 'General'} {selectedVehicle?.model || 'Vehicle'}
                        {selectedVehicle?.year && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({selectedVehicle.year})
                          </span>
                        )}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-blue-400" />
                          {selectedVehicle?.customerName || 'Walk-in Customer'}
                        </span>
                        {selectedVehicle?.color && (
                          <span className="text-slate-400">&bull; {selectedVehicle.color}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active Vehicle
                    </span>
                  </div>
                </div>

                {/* 4 Stats Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Last Mileage
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 flex items-center gap-1 mt-0.5">
                      <Gauge className="h-4 w-4" />
                      {typeof stats.latestMileage === 'number'
                        ? `${stats.latestMileage.toLocaleString()} km`
                        : stats.latestMileage}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Total Visits
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-400 flex items-center gap-1 mt-0.5">
                      <History className="h-4 w-4" />
                      {stats.visitCount} Visits
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Total Spent
                    </span>
                    <span className="text-base sm:text-lg font-black text-amber-400 flex items-center gap-1 mt-0.5">
                      Rs. {stats.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Last Service
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 mt-1 block truncate">
                      {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString() : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Logs Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-600" />
                    Service & Maintenance Timeline ({vehicleOrders.length})
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    Newest visits listed first
                  </span>
                </div>

                {vehicleOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 space-y-3">
                    <History className="h-10 w-10 text-slate-300 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">No Service Records Yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Sales and services made in POS with plate number{' '}
                        <strong className="text-slate-800">{selectedPlate}</strong> will appear here
                        with date, parts changed, and mileage.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicleOrders.map((order, idx) => {
                      const hasOil = isOilChange(order);
                      const orderDate = new Date(order.createdAt);

                      return (
                        <div
                          key={order.id}
                          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-blue-300 transition-all"
                        >
                          {/* Visit Card Header */}
                          <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-xs">
                                #{String(order.orderNumber).padStart(4, '0')}
                              </span>

                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                  {orderDate.toLocaleDateString('en-PK', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                  <span className="text-slate-400">&bull;</span>
                                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                                  {orderDate.toLocaleTimeString('en-PK', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Oil Change Badge */}
                              {hasOil && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                  <Droplets className="h-3 w-3 text-amber-600" /> Oil Service
                                </span>
                              )}

                              {/* Recorded Mileage */}
                              {order.vehicleMileage ? (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                  <Gauge className="h-3 w-3 text-emerald-600" />
                                  {Number(order.vehicleMileage).toLocaleString()} km
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  Mileage: —
                                </span>
                              )}

                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {order.status}
                              </span>
                            </div>
                          </div>

                          {/* Items / Parts Changed Table */}
                          <div className="p-4 sm:p-5 space-y-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                    <th className="pb-2">#</th>
                                    <th className="pb-2">Item / Part Changed</th>
                                    <th className="pb-2 text-center">Type</th>
                                    <th className="pb-2 text-center">Qty</th>
                                    <th className="pb-2 text-right">Price</th>
                                    <th className="pb-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(order.items || []).map((it, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 text-slate-400 font-mono">{i + 1}</td>
                                      <td className="py-2.5 font-bold text-slate-800">
                                        {it.name}
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <span
                                          className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                                            it.type === 'service'
                                              ? 'bg-purple-100 text-purple-700'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          {it.type || 'Part'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 text-center font-semibold text-slate-700">
                                        {it.quantity}
                                      </td>
                                      <td className="py-2.5 text-right text-slate-600">
                                        Rs. {Number(it.price || 0).toLocaleString()}
                                      </td>
                                      <td className="py-2.5 text-right font-bold text-slate-900">
                                        Rs.{' '}
                                        {(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Total and Payment Footer */}
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600">
                              <div className="flex items-center gap-3">
                                <span>
                                  Payment Method:{' '}
                                  <strong className="text-slate-900 uppercase">
                                    {order.paymentMethod || 'Cash'}
                                  </strong>
                                </span>
                                {order.notes && (
                                  <span className="text-slate-500 italic">
                                    Note: {order.notes}
                                  </span>
                                )}
                              </div>

                              <div className="text-right">
                                <span className="text-xs text-slate-500 mr-2">Grand Total:</span>
                                <span className="text-base font-black text-slate-900">
                                  Rs. {Number(order.total || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Car className="h-12 w-12 mx-auto stroke-1 text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">Select a Vehicle</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Search or click any vehicle on the left to see its entire maintenance history,
                oil change dates, replaced parts, and recorded mileage.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
