import { useState } from 'react';
import {
  Truck,
  Plus,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  FileText,
  Search,
  X,
  CreditCard,
} from 'lucide-react';
import { pharmacyStorage, type Supplier } from './pharmacyData';

export function PharmacySuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => pharmacyStorage.getSuppliers());
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    outstandingBalance: 0,
    totalPurchases: 0,
  });

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search)
  );

  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.outstandingBalance, 0);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      outstandingBalance: 0,
      totalPurchases: 0,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const newSupplier: Supplier = {
      ...(formData as Supplier),
      id: `sup-${Date.now()}`,
    };

    const updated = [newSupplier, ...suppliers];
    setSuppliers(updated);
    pharmacyStorage.saveSuppliers(updated);
    setModalOpen(false);
  };

  const handleMakePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal || paymentAmount <= 0) return;

    const updated = suppliers.map((s) => {
      if (s.id === paymentModal.id) {
        return {
          ...s,
          outstandingBalance: Math.max(0, s.outstandingBalance - paymentAmount),
        };
      }
      return s;
    });

    setSuppliers(updated);
    pharmacyStorage.saveSuppliers(updated);
    setPaymentModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="text-indigo-400" size={20} />
            <span>Vendors & Pharmaceutical Distributors</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain authorized medicine distributors, pharmaceutical company reps, and vendor payables.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Distributor</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Distributors</span>
          <h3 className="text-2xl font-bold text-white mt-1">{suppliers.length} Companies</h3>
        </div>
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Outstanding Balance</span>
          <h3 className="text-2xl font-bold text-rose-400 mt-1">Rs. {totalOutstanding.toLocaleString()}</h3>
        </div>
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <span className="text-xs text-slate-400">Total Purchases Logged</span>
          <h3 className="text-2xl font-bold text-teal-400 mt-1">
            Rs. {suppliers.reduce((sum, s) => sum + s.totalPurchases, 0).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search distributor by company name, contact person, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1b1c24] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((sup) => (
          <div
            key={sup.id}
            className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-white text-sm">{sup.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Distributor
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Contact: {sup.contactPerson}</p>

              <div className="space-y-1.5 mt-4 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone size={13} className="text-teal-400 shrink-0" />
                  <span>{sup.phone}</span>
                </div>
                {sup.email && (
                  <div className="flex items-center gap-2 text-slate-400 truncate">
                    <Mail size={13} className="text-teal-400 shrink-0" />
                    <span>{sup.email}</span>
                  </div>
                )}
                {sup.address && (
                  <div className="flex items-start gap-2 text-slate-400 line-clamp-1">
                    <MapPin size={13} className="text-teal-400 shrink-0 mt-0.5" />
                    <span>{sup.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Payable Balance</span>
                <span className="text-sm font-bold text-rose-400">
                  Rs. {sup.outstandingBalance.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPaymentModal(sup);
                  setPaymentAmount(sup.outstandingBalance);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#00897b] hover:text-white text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                <CreditCard size={13} />
                <span>Pay Vendor</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Add New Pharmaceutical Distributor</h3>
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
                <label className="block text-slate-400 mb-1">Company / Distributor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premier Pharmaceuticals Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Contact Person / Area Rep</label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
                    placeholder="orders@pharma.pk"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Warehouse / Depot Address</label>
                <textarea
                  rows={2}
                  placeholder="Plot 12, Industrial Area..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Initial Payable Balance (Rs.)</label>
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
                  Save Distributor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Vendor Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Record Payment to {paymentModal.name}</h3>
            <p className="text-xs text-slate-400 mb-4">
              Current Outstanding Balance: <span className="text-rose-400 font-bold">Rs. {paymentModal.outstandingBalance.toLocaleString()}</span>
            </p>

            <form onSubmit={handleMakePayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Payment Amount (Rs.)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={paymentModal.outstandingBalance || undefined}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Mode</label>
                <select className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500">
                  <option>Cash Drawer</option>
                  <option>Bank Online Transfer</option>
                  <option>Cheque / Pay Order</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacySuppliers;
