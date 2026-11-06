import { useState } from 'react';
import {
  Users,
  Plus,
  Phone,
  Mail,
  MapPin,
  Search,
  FileHeart,
  X,
  CreditCard,
} from 'lucide-react';
import {
  pharmacyStorage,
  type PharmacyCustomer,
} from './pharmacyData';

export function PharmacyCustomers() {
  const [customers, setCustomers] = useState<PharmacyCustomer[]>(() =>
    pharmacyStorage.getCustomers()
  );
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<PharmacyCustomer>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    outstandingBalance: 0,
    prescriptionNotes: '',
  });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.prescriptionNotes && c.prescriptionNotes.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      outstandingBalance: 0,
      prescriptionNotes: '',
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    const newCust: PharmacyCustomer = {
      id: `cust-${Date.now()}`,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      outstandingBalance: formData.outstandingBalance || 0,
      totalSpent: 0,
      prescriptionNotes: formData.prescriptionNotes,
      lastVisit: new Date().toISOString().split('T')[0],
    };

    const updated = [newCust, ...customers];
    setCustomers(updated);
    pharmacyStorage.saveCustomers(updated);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-pink-400" size={20} />
            <span>Customers & Patient Profiles</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain regular patient records, chronic medicine history, and credit customer ledgers.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search patient by name, phone, or chronic condition notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1b1c24] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white text-sm">{c.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{c.phone}</p>
                </div>
                {c.outstandingBalance > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Due: Rs. {c.outstandingBalance}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Paid
                  </span>
                )}
              </div>

              {c.prescriptionNotes && (
                <div className="mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs">
                  <div className="flex items-center gap-1.5 text-pink-400 font-medium mb-1">
                    <FileHeart size={13} />
                    <span>Prescription Notes</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{c.prescriptionNotes}</p>
                </div>
              )}

              <div className="space-y-1 mt-3 text-[11px] text-slate-400">
                {c.address && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="text-teal-400 shrink-0" />
                    <span>{c.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Last Visit:</span>
                  <span className="text-slate-300">{c.lastVisit}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Spent:</span>
              <span className="font-bold text-white">Rs. {c.totalSpent.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Register Patient / Customer</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Patient Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Aslam"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Address / Area</label>
                <input
                  type="text"
                  placeholder="Sector, Street, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Prescription / Chronic Disease Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Diabetic, allergic to Penicillin, regular BP medicines..."
                  value={formData.prescriptionNotes}
                  onChange={(e) => setFormData({ ...formData, prescriptionNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Credit / Ledger Balance (Rs.)</label>
                <input
                  type="number"
                  value={formData.outstandingBalance}
                  onChange={(e) => setFormData({ ...formData, outstandingBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyCustomers;
