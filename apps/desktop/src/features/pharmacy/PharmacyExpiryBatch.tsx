import { useState, useMemo, useEffect } from 'react';
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowUpDown,
  Filter,
  ShieldAlert,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { pharmacyDb, type Medicine, type DisposalLog } from './pharmacyData';

export function PharmacyExpiryBatch() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'expired' | '30days' | '60days' | '90days'>('all');
  const [disposalLogs, setDisposalLogs] = useState<DisposalLog[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([pharmacyDb.getMedicines(), pharmacyDb.getDisposalLogs()])
      .then(([meds, disposals]) => {
        if (mounted) {
          setMedicines(meds);
          setDisposalLogs(disposals);
        }
      })
      .catch((err) => console.error('[PharmacyExpiryBatch] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  const [disposalModal, setDisposalModal] = useState<Medicine | null>(null);
  const [disposalQty, setDisposalQty] = useState(1);
  const [disposalReason, setDisposalReason] = useState('Expired - Manufacturer Return');

  const now = new Date();

  // FEFO sorting: earlier expiry date comes first
  const sortedBatches = useMemo(() => {
    const list = [...medicines];
    list.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    return list.filter((m) => {
      const exp = new Date(m.expiryDate);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (filterPeriod === 'expired') return diffDays <= 0;
      if (filterPeriod === '30days') return diffDays > 0 && diffDays <= 30;
      if (filterPeriod === '60days') return diffDays > 0 && diffDays <= 60;
      if (filterPeriod === '90days') return diffDays > 0 && diffDays <= 90;
      return true;
    });
  }, [medicines, filterPeriod]);

  const stats = useMemo(() => {
    let expired = 0;
    let within30 = 0;
    let within90 = 0;

    medicines.forEach((m) => {
      const diff = Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 0) expired++;
      else if (diff <= 30) within30++;
      else if (diff <= 90) within90++;
    });

    return { expired, within30, within90 };
  }, [medicines]);

  const handleConfirmDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalModal) return;

    try {
      const nextStock = Math.max(0, disposalModal.stock - disposalQty);
      const updatedMed = await pharmacyDb.updateMedicine(disposalModal.id, {
        stock: nextStock,
      });

      const newLog = await pharmacyDb.createDisposalLog({
        medicineName: disposalModal.name,
        batch: disposalModal.batchNumber,
        qty: disposalQty,
        reason: disposalReason,
        date: new Date().toISOString().split('T')[0],
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === disposalModal.id ? updatedMed : m))
      );
      setDisposalLogs((prev) => [newLog, ...prev]);
      setDisposalModal(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="text-[#00897b]" size={20} />
            <span>Expiry & Batch Management (FEFO)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            First Expiry First Out (FEFO) automated sequencing, batch tracking, and manufacturer returns.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterPeriod('expired')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
            filterPeriod === 'expired'
              ? 'bg-rose-50 border-rose-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700">
            <span>Expired Stock</span>
            <ShieldAlert size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-rose-800">{stats.expired} Batches</h3>
            <p className="text-[11px] text-slate-500">Must be removed & quarantined</p>
          </div>
        </div>

        <div
          onClick={() => setFilterPeriod('30days')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
            filterPeriod === '30days'
              ? 'bg-amber-50 border-amber-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>Critical (Expiring in 30 Days)</span>
            <AlertTriangle size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-amber-800">{stats.within30} Batches</h3>
            <p className="text-[11px] text-slate-500">Priority sales / return to distributor</p>
          </div>
        </div>

        <div
          onClick={() => setFilterPeriod('90days')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm ${
            filterPeriod === '90days'
              ? 'bg-teal-50 border-teal-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-teal-700">
            <span>Near Expiry (90 Days)</span>
            <CalendarClock size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-teal-800">{stats.within90} Batches</h3>
            <p className="text-[11px] text-slate-500">FEFO priority dispatch in POS</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterPeriod('all')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === 'all'
              ? 'bg-[#00897b] border-[#00897b] text-white font-semibold shadow-sm'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Batches (FEFO Order)
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('expired')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === 'expired'
              ? 'bg-rose-600 border-rose-600 text-white font-semibold shadow-sm'
              : 'bg-white border-slate-200 text-rose-600 hover:bg-slate-50'
          }`}
        >
          Expired Only ({stats.expired})
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('30days')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === '30days'
              ? 'bg-amber-600 border-amber-600 text-white font-semibold shadow-sm'
              : 'bg-white border-slate-200 text-amber-700 hover:bg-slate-50'
          }`}
        >
          Expiring in ≤30 Days ({stats.within30})
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('90days')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === '90days'
              ? 'bg-teal-600 border-teal-600 text-white font-semibold shadow-sm'
              : 'bg-white border-slate-200 text-teal-700 hover:bg-slate-50'
          }`}
        >
          Expiring in ≤90 Days ({stats.within90})
        </button>
      </div>

      {/* Batches Table with FEFO Priority Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">FEFO Order</th>
                <th className="py-3 px-4 font-semibold">Medicine</th>
                <th className="py-3 px-4 font-semibold">Batch Number</th>
                <th className="py-3 px-4 font-semibold">Mfg Date</th>
                <th className="py-3 px-4 font-semibold">Expiry Date</th>
                <th className="py-3 px-4 font-semibold">Remaining Days</th>
                <th className="py-3 px-4 font-semibold">Available Units</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No medicine batches found for this filter.
                  </td>
                </tr>
              ) : (
                sortedBatches.map((m, index) => {
                const exp = new Date(m.expiryDate);
                const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpired = diffDays <= 0;
                const isCritical = diffDays > 0 && diffDays <= 30;
                const isNear = diffDays > 30 && diffDays <= 90;

                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 font-bold text-slate-700 text-[11px] border border-slate-200">
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{m.name}</div>
                      <div className="text-[11px] text-slate-500">{m.genericName}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-mono">{m.batchNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{m.mfgDate}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                          isExpired
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isCritical
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : isNear
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.expiryDate}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isExpired ? (
                        <span className="text-rose-600 font-bold">Expired ({Math.abs(diffDays)}d ago)</span>
                      ) : (
                        <span className={isCritical ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                          {diffDays} days left
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.stock} Units</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDisposalModal(m);
                          setDisposalQty(Math.min(m.stock, 5));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 transition text-[11px] font-medium"
                      >
                        Return / Dispose
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expired Stock Disposal Log */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Archive size={16} className="text-[#00897b]" />
          <span>Expired Stock & Quarantine Disposal Log</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 pb-2">
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Medicine</th>
                <th className="py-2.5 px-3 font-semibold">Batch</th>
                <th className="py-2.5 px-3 font-semibold">Quantity</th>
                <th className="py-2.5 px-3 font-semibold">Reason / Action Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disposalLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No disposal or quarantine records logged yet.
                  </td>
                </tr>
              ) : (
                disposalLogs.map((log) => (
                  <tr key={log.id} className="text-slate-700 hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500">{log.date}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{log.medicineName}</td>
                    <td className="py-2.5 px-3 font-mono">{log.batch}</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">{log.qty} Units</td>
                    <td className="py-2.5 px-3 text-slate-600">{log.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return / Disposal Modal */}
      {disposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Process Batch Return / Disposal</h3>
            <p className="text-xs text-slate-500 mb-4">
              {disposalModal.name} (Batch: {disposalModal.batchNumber}) — Current Stock: {disposalModal.stock}
            </p>

            <form onSubmit={handleConfirmDisposal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Quantity to Dispose / Return</label>
                <input
                  type="number"
                  min="1"
                  max={disposalModal.stock}
                  required
                  value={disposalQty}
                  onChange={(e) => setDisposalQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Reason / Action</label>
                <select
                  value={disposalReason}
                  onChange={(e) => setDisposalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Expired - Manufacturer Credit Note Return">Expired - Distributor Return</option>
                  <option value="Expired - Safe Incineration / Disposal">Expired - Safe Incineration</option>
                  <option value="Damaged / Broken Ampoule or Bottle">Damaged / Broken Ampoule or Bottle</option>
                  <option value="Recall by Drug Regulatory Authority">Recall by Drug Authority</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisposalModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm transition"
                >
                  Confirm Disposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyExpiryBatch;
