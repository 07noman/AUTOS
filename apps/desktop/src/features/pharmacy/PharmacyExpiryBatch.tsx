import { useState, useMemo } from 'react';
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
import { pharmacyStorage, type Medicine } from './pharmacyData';

export function PharmacyExpiryBatch() {
  const [medicines, setMedicines] = useState<Medicine[]>(() => pharmacyStorage.getMedicines());
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'expired' | '30days' | '60days' | '90days'>('all');
  const [disposalLogs, setDisposalLogs] = useState<
    { id: string; medicineName: string; batch: string; qty: number; reason: string; date: string }[]
  >(() => pharmacyStorage.getDisposalLogs());

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

  const handleConfirmDisposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalModal) return;

    // Deduct stock
    const updated = medicines.map((m) => {
      if (m.id === disposalModal.id) {
        return { ...m, stock: Math.max(0, m.stock - disposalQty) };
      }
      return m;
    });
    setMedicines(updated);
    pharmacyStorage.saveMedicines(updated);

    // Add log
    const updatedLogs = [
      {
        id: `disp-${Date.now()}`,
        medicineName: disposalModal.name,
        batch: disposalModal.batchNumber,
        qty: disposalQty,
        reason: disposalReason,
        date: new Date().toISOString().split('T')[0],
      },
      ...disposalLogs,
    ];
    setDisposalLogs(updatedLogs);
    pharmacyStorage.saveDisposalLogs(updatedLogs);

    setDisposalModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarClock className="text-rose-400" size={20} />
            <span>Expiry & Batch Management (FEFO)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            First Expiry First Out (FEFO) automated sequencing, batch tracking, and manufacturer returns.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterPeriod('expired')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filterPeriod === 'expired'
              ? 'bg-rose-500/10 border-rose-500/50'
              : 'bg-[#1b1c24] border-white/[0.07] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span>Expired Stock</span>
            <ShieldAlert size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-rose-400">{stats.expired} Batches</h3>
            <p className="text-[11px] text-slate-400">Must be removed & quarantined</p>
          </div>
        </div>

        <div
          onClick={() => setFilterPeriod('30days')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filterPeriod === '30days'
              ? 'bg-amber-500/10 border-amber-500/50'
              : 'bg-[#1b1c24] border-white/[0.07] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400">
            <span>Critical (Expiring in 30 Days)</span>
            <AlertTriangle size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-amber-300">{stats.within30} Batches</h3>
            <p className="text-[11px] text-slate-400">Priority sales / return to distributor</p>
          </div>
        </div>

        <div
          onClick={() => setFilterPeriod('90days')}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            filterPeriod === '90days'
              ? 'bg-teal-500/10 border-teal-500/50'
              : 'bg-[#1b1c24] border-white/[0.07] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-teal-400">
            <span>Near Expiry (90 Days)</span>
            <CalendarClock size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-teal-300">{stats.within90} Batches</h3>
            <p className="text-[11px] text-slate-400">FEFO priority dispatch in POS</p>
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
              ? 'bg-[#00897b] border-[#00897b] text-white font-medium'
              : 'bg-[#1b1c24] border-white/[0.08] text-slate-400 hover:text-white'
          }`}
        >
          All Batches (FEFO Order)
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('expired')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === 'expired'
              ? 'bg-rose-600 border-rose-600 text-white font-medium'
              : 'bg-[#1b1c24] border-white/[0.08] text-rose-400 hover:text-rose-300'
          }`}
        >
          Expired Only ({stats.expired})
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('30days')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === '30days'
              ? 'bg-amber-600 border-amber-600 text-white font-medium'
              : 'bg-[#1b1c24] border-white/[0.08] text-amber-400 hover:text-amber-300'
          }`}
        >
          Expiring in ≤30 Days ({stats.within30})
        </button>
        <button
          type="button"
          onClick={() => setFilterPeriod('90days')}
          className={`px-3 py-1.5 rounded-xl border transition ${
            filterPeriod === '90days'
              ? 'bg-teal-600 border-teal-600 text-white font-medium'
              : 'bg-[#1b1c24] border-white/[0.08] text-teal-400 hover:text-teal-300'
          }`}
        >
          Expiring in ≤90 Days ({stats.within90})
        </button>
      </div>

      {/* Batches Table with FEFO Priority Indicator */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
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
            <tbody className="divide-y divide-white/[0.04]">
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
                  <tr key={m.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-white/[0.06] font-bold text-slate-300 text-[11px]">
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{m.name}</div>
                      <div className="text-[11px] text-slate-400">{m.genericName}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">{m.batchNumber}</td>
                    <td className="py-3 px-4 text-slate-400">{m.mfgDate}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                          isExpired
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : isCritical
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isNear
                            ? 'bg-teal-500/10 text-teal-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {m.expiryDate}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isExpired ? (
                        <span className="text-rose-400 font-bold">Expired ({Math.abs(diffDays)}d ago)</span>
                      ) : (
                        <span className={isCritical ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {diffDays} days left
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{m.stock} Units</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDisposalModal(m);
                          setDisposalQty(Math.min(m.stock, 5));
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 transition text-[11px]"
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
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 shadow-xl">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Archive size={16} className="text-teal-400" />
          <span>Expired Stock & Quarantine Disposal Log</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-white/[0.06] pb-2">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Medicine</th>
                <th className="pb-2 font-medium">Batch</th>
                <th className="pb-2 font-medium">Quantity</th>
                <th className="pb-2 font-medium">Reason / Action Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {disposalLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No disposal or quarantine records logged yet.
                  </td>
                </tr>
              ) : (
                disposalLogs.map((log) => (
                  <tr key={log.id} className="text-slate-300">
                    <td className="py-2.5 text-slate-400">{log.date}</td>
                    <td className="py-2.5 font-medium text-white">{log.medicineName}</td>
                    <td className="py-2.5 font-mono">{log.batch}</td>
                    <td className="py-2.5 text-rose-400 font-bold">{log.qty} Units</td>
                    <td className="py-2.5 text-slate-300">{log.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return / Disposal Modal */}
      {disposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Process Batch Return / Disposal</h3>
            <p className="text-xs text-slate-400 mb-4">
              {disposalModal.name} (Batch: {disposalModal.batchNumber}) — Current Stock: {disposalModal.stock}
            </p>

            <form onSubmit={handleConfirmDisposal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Quantity to Dispose / Return</label>
                <input
                  type="number"
                  min="1"
                  max={disposalModal.stock}
                  required
                  value={disposalQty}
                  onChange={(e) => setDisposalQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason / Action</label>
                <select
                  value={disposalReason}
                  onChange={(e) => setDisposalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Expired - Manufacturer Credit Note Return">Expired - Distributor Return</option>
                  <option value="Expired - Safe Incineration / Disposal">Expired - Safe Incineration</option>
                  <option value="Damaged / Broken Ampoule or Bottle">Damaged / Broken Ampoule or Bottle</option>
                  <option value="Recall by Drug Regulatory Authority">Recall by Drug Authority</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setDisposalModal(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
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
