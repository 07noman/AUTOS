import { useState, useEffect } from 'react';
import { Search, UserPlus, X, Phone, User, MapPin, FileText, Check } from 'lucide-react';
import { pharmacyDb, type PharmacyCustomer } from './pharmacyData';

export interface SelectedCustomerDetails {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  outstandingBalance?: number;
  prescriptionNotes?: string;
}

interface PharmacyCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomer: SelectedCustomerDetails | null;
  onSelectCustomer: (cust: SelectedCustomerDetails) => void;
}

export function PharmacyCustomerModal({
  isOpen,
  onClose,
  selectedCustomer,
  onSelectCustomer,
}: PharmacyCustomerModalProps) {
  const [customers, setCustomers] = useState<PharmacyCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New customer form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      pharmacyDb
        .getCustomers()
        .then(setCustomers)
        .catch((err) => console.warn('[PharmacyCustomerModal] Error loading customers:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await pharmacyDb.createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        prescriptionNotes: prescriptionNotes.trim() || undefined,
        outstandingBalance: 0,
        totalSpent: 0,
      });
      setCustomers((prev) => [created, ...prev]);
      onSelectCustomer({
        id: created.id,
        name: created.name,
        phone: created.phone,
        address: created.address,
        outstandingBalance: created.outstandingBalance,
      });
      setShowAddForm(false);
      setName('');
      setPhone('');
      setAddress('');
      setPrescriptionNotes('');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-[#00897b]">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Customer & Patient</h3>
              <p className="text-xs text-slate-500">Select patient for prescription & credit balance tracking</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {!showAddForm ? (
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCustomer({ name: 'Walk-in Customer' });
                    onClose();
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    !selectedCustomer || selectedCustomer.name === 'Walk-in Customer'
                      ? 'border-[#00897b] bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Walk-in Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-[#00897b] text-white text-xs font-semibold hover:bg-[#00897b]/90 transition shadow-sm"
                >
                  <UserPlus size={14} />
                  <span>+ New Patient</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search by patient name or phone number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition"
                />
              </div>

              {/* Customer List */}
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No customers found matching &quot;{search}&quot;. Click &quot;+ New Patient&quot; above to register.
                  </div>
                ) : (
                  filtered.map((c) => {
                    const isSelected = selectedCustomer?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCustomer({
                            id: c.id,
                            name: c.name,
                            phone: c.phone,
                            address: c.address,
                            outstandingBalance: c.outstandingBalance,
                            prescriptionNotes: c.prescriptionNotes,
                          });
                          onClose();
                        }}
                        className={`flex w-full items-center justify-between p-3 text-left transition hover:bg-teal-50/50 ${
                          isSelected ? 'bg-teal-50' : 'bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {isSelected && <Check size={14} className="text-[#00897b]" />}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {c.phone}
                              </span>
                            )}
                            {c.address && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                {c.address}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {c.outstandingBalance > 0 ? (
                            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Udhaar: Rs. {c.outstandingBalance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Clear</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Add new customer form */
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient / Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0300-1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Street 4, Sector G-9, Islamabad"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Prescription / Medical Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Diabetic patient, regular insulin"
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Back to List
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="px-5 py-2 rounded-xl bg-[#00897b] text-white text-xs font-semibold hover:bg-[#00897b]/90 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Register Patient'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
