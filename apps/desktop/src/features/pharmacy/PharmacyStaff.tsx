import { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  UserCheck,
  Lock,
  Mail,
  Phone,
  Clock,
  X,
  Trash2,
} from 'lucide-react';
import {
  pharmacyStorage,
  type StaffUser,
} from './pharmacyData';

export function PharmacyStaff() {
  const [staff, setStaff] = useState<StaffUser[]>(() => pharmacyStorage.getStaff());
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<StaffUser>>({
    name: '',
    email: '',
    phone: '',
    role: 'Pharmacist',
    status: 'Active',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const newUser: StaffUser = {
      id: `staff-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      phone: formData.phone || '',
      role: formData.role as any,
      status: formData.status as any,
      lastLogin: 'Never logged in',
    };

    const updated = [...staff, newUser];
    setStaff(updated);
    pharmacyStorage.saveStaff(updated);
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Remove this staff account?')) {
      const updated = staff.filter((s) => s.id !== id);
      setStaff(updated);
      pharmacyStorage.saveStaff(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-purple-400" size={20} />
            <span>Staff & Pharmacist Role Permissions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage licensed pharmacists, counter cashiers, and store administrative privileges.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
            <ShieldCheck size={16} />
            <span>Administrator</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">Full control</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Drug pricing, purchasing, user management, and P&L financial reports.
          </p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
            <UserCheck size={16} />
            <span>Registered Pharmacist</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">Clinical & Stock</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Prescription verification, batch expiry disposal, stock adjustments, and sales.
          </p>
        </div>

        <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
            <Lock size={16} />
            <span>Cashier / Sales Counter</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">POS Billing</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Process counter billing, scan barcodes, print receipts, and cash drawer management.
          </p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Contact</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Active</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.role === 'Admin'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : u.role === 'Pharmacist'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{u.lastLogin}</td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'Admin' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Add Pharmacy Staff Member</h3>
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
                <label className="block text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Hamza Khan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="pharmacist@store.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assign Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="Pharmacist">Registered Pharmacist (Clinical & Inventory)</option>
                  <option value="Cashier">Cashier (Point of Sale Counter)</option>
                  <option value="Admin">Administrator (Full Store Access)</option>
                </select>
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
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyStaff;
