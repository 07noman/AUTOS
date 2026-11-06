import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Pill,
  Edit2,
  Trash2,
  SlidersHorizontal,
  X,
  AlertCircle,
  Barcode,
  Layers,
} from 'lucide-react';
import { pharmacyStorage, type Medicine } from './pharmacyData';

export function PharmacyMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>(() => pharmacyStorage.getMedicines());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Medicine>>({
    name: '',
    genericName: '',
    category: 'Analgesics / Antipyretic',
    manufacturer: '',
    dosageForm: 'Tablet',
    strength: '500mg',
    purchasePrice: 0,
    sellingPrice: 0,
    barcode: '',
    sku: '',
    batchNumber: '',
    stock: 0,
    minStockLevel: 20,
    mfgDate: new Date().toISOString().split('T')[0],
    expiryDate: '2027-12-31',
    location: '',
  });

  const categories = useMemo(() => {
    const set = new Set(medicines.map((m) => m.category));
    return ['all', ...Array.from(set)];
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.genericName.toLowerCase().includes(search.toLowerCase()) ||
        m.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
        m.barcode.includes(search) ||
        m.batchNumber.toLowerCase().includes(search.toLowerCase());

      const matchCategory = categoryFilter === 'all' || m.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [medicines, search, categoryFilter]);

  const handleOpenAdd = () => {
    setEditingMedicine(null);
    setFormData({
      name: '',
      genericName: '',
      category: 'Analgesics / Antipyretic',
      manufacturer: '',
      dosageForm: 'Tablet',
      strength: '500mg',
      purchasePrice: 0,
      sellingPrice: 0,
      barcode: `896${Math.floor(100000000 + Math.random() * 900000000)}`,
      sku: `MED-${Math.floor(1000 + Math.random() * 9000)}`,
      batchNumber: `BN-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`,
      stock: 100,
      minStockLevel: 20,
      mfgDate: new Date().toISOString().split('T')[0],
      expiryDate: '2027-12-31',
      location: 'Rack A-1',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (med: Medicine) => {
    setEditingMedicine(med);
    setFormData({ ...med });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this medicine?')) {
      const updated = medicines.filter((m) => m.id !== id);
      setMedicines(updated);
      pharmacyStorage.saveMedicines(updated);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.genericName) return;

    if (editingMedicine) {
      const updated = medicines.map((m) =>
        m.id === editingMedicine.id ? ({ ...m, ...formData } as Medicine) : m
      );
      setMedicines(updated);
      pharmacyStorage.saveMedicines(updated);
    } else {
      const newMed: Medicine = {
        ...(formData as Medicine),
        id: `med-${Date.now()}`,
      };
      const updated = [newMed, ...medicines];
      setMedicines(updated);
      pharmacyStorage.saveMedicines(updated);
    }

    setModalOpen(false);
  };

  const handleQuickStockAdjust = (id: string, delta: number) => {
    const updated = medicines.map((m) => {
      if (m.id === id) {
        const nextStock = Math.max(0, m.stock + delta);
        return { ...m, stock: nextStock };
      }
      return m;
    });
    setMedicines(updated);
    pharmacyStorage.saveMedicines(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Pill className="text-teal-400" size={20} />
            <span>Medicines & Drug Inventory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage pharmaceuticals, brand names, generic formulations, batch numbers, and stock levels.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Medicine</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by brand name, generic name, manufacturer, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1b1c24] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-[#1b1c24] border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-teal-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Drug Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
                <th className="py-3 px-4 font-semibold">Medicine / Brand</th>
                <th className="py-3 px-4 font-semibold">Generic & Strength</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Batch / Expiry</th>
                <th className="py-3 px-4 font-semibold">Cost / Sell</th>
                <th className="py-3 px-4 font-semibold">Stock</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No medicines found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((med) => {
                  const isLow = med.stock <= med.minStockLevel;
                  return (
                    <tr key={med.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{med.name}</div>
                        <div className="text-[11px] text-slate-400">{med.manufacturer}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{med.genericName}</div>
                        <div className="text-[11px] text-teal-400">
                          {med.dosageForm} • {med.strength}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] border border-white/[0.06]">
                          {med.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300">{med.batchNumber}</div>
                        <div className="text-[11px] text-slate-400">Exp: {med.expiryDate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-emerald-400">Rs. {med.sellingPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">Cost: Rs. {med.purchasePrice.toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickStockAdjust(med.id, -1)}
                            className="h-5 w-5 rounded bg-white/[0.06] hover:bg-white/10 text-slate-300 flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span
                            className={`font-bold px-2 py-0.5 rounded ${
                              isLow
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {med.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickStockAdjust(med.id, 1)}
                            className="h-5 w-5 rounded bg-white/[0.06] hover:bg-white/10 text-slate-300 flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                        {isLow && (
                          <div className="text-[10px] text-rose-400 mt-0.5 flex items-center gap-1">
                            <AlertCircle size={10} />
                            <span>Min: {med.minStockLevel}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(med)}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-slate-300 transition"
                            title="Edit Medicine"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(med.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Medicine Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill className="text-teal-400" size={18} />
                <span>{editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Panadol Extra"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Generic Formula *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol + Caffeine"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Antibiotics, Analgesic"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. GSK, Getz Pharma, Abbott"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Dosage Form</label>
                  <select
                    value={formData.dosageForm}
                    onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Drops">Drops</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Strength / Volume</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 120ml"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Purchase Cost (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Retail Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Current Stock (Units)</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Min Stock Reorder Level</label>
                  <input
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Barcode / EAN</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack B-2, Fridge 1"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
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
                  {editingMedicine ? 'Update Medicine' : 'Save Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyMedicines;
