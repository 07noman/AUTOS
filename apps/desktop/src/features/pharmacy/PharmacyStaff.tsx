import { useState, useEffect } from 'react';
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
  pharmacyDb,
  type StaffUser,
} from './pharmacyData';

export function PharmacyStaff() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    pharmacyDb
      .getStaff()
      .then((data) => {
        if (mounted) setStaff(data);
      })
      .catch((err) => console.error('[PharmacyStaff] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  const [formData, setFormData] = useState<Partial<StaffUser>>({
    name: '',
    email: '',
    phone: '',
    role: 'Pharmacist',
    status: 'Active',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      const created = await pharmacyDb.createStaff({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        role: formData.role as any,
        status: formData.status as any,
        lastLogin: 'Never logged in',
      });

      setStaff((prev) => [created, ...prev]);
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove this staff account?')) {
      try {
        await pharmacyDb.deleteStaff(id);
        setStaff((prev) => prev.filter((s) => s.id !== id));
      } catch (err: any) {
        alert(err.message || 'Failed to save, check internet');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-[#00897b]" size={20} />
            <span>Staff & Pharmacist Role Permissions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage licensed pharmacists, counter cashiers, and store administrative privileges.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-purple-700 font-semibold text-xs">
            <ShieldCheck size={16} />
            <span>Administrator</span>
          </div>
          <p className="text-xs text-slate-900 font-semibold mt-2">Full control</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Drug pricing, purchasing, user management, and P&L financial reports.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700 font-semibold text-xs">
            <UserCheck size={16} />
            <span>Registered Pharmacist</span>
          </div>
          <p className="text-xs text-slate-900 font-semibold mt-2">Clinical & Stock</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Prescription verification, batch expiry disposal, stock adjustments, and sales.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs">
            <Lock size={16} />
            <span>Cashier / Sales Counter</span>
          </div>
          <p className="text-xs text-slate-900 font-semibold mt-2">POS Billing</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Process counter billing, scan barcodes, print receipts, and cash drawer management.
          </p>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Contact</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Active</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No staff members added yet. Click '+ Add Staff Member' to configure staff roles.
                  </td>
                </tr>
              ) : (
                staff.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.role === 'Admin'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : u.role === 'Pharmacist'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{u.lastLogin}</td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'Admin' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Pharmacy Staff Member</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Hamza Khan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="pharmacist@store.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Assign Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                >
                  <option value="Pharmacist">Registered Pharmacist (Clinical & Inventory)</option>
                  <option value="Cashier">Cashier (Point of Sale Counter)</option>
                  <option value="Admin">Administrator (Full Store Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white font-semibold shadow-sm transition"
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
