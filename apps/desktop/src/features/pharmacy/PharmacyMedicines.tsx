import { useState, useMemo, useEffect } from 'react';
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
  Loader2,
  Package,
} from 'lucide-react';
import { pharmacyDb, type Medicine } from './pharmacyData';
import { getDefaultBaseUnit, formatStockWithPacking } from './packingUtils';

export function PharmacyMedicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  useEffect(() => {
    let mounted = true;
    pharmacyDb
      .getMedicines()
      .then((data) => {
        if (mounted) setMedicines(data);
      })
      .catch((err) => {
        console.error('[PharmacyMedicines] Load error:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    baseUnit: 'Tablet',
    stripSize: 10,
    boxSize: 10,
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
      baseUnit: 'Tablet',
      stripSize: 10,
      boxSize: 10,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (med: Medicine) => {
    setEditingMedicine(med);
    setFormData({
      ...med,
      baseUnit: med.baseUnit || getDefaultBaseUnit(med.dosageForm),
      stripSize: med.stripSize,
      boxSize: med.boxSize,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this medicine?')) {
      try {
        await pharmacyDb.deleteMedicine(id);
        setMedicines((prev) => prev.filter((m) => m.id !== id));
      } catch (err: any) {
        alert(err.message || 'Failed to save, check internet');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.genericName) return;

    try {
      if (editingMedicine) {
        const updated = await pharmacyDb.updateMedicine(editingMedicine.id, formData);
        setMedicines((prev) =>
          prev.map((m) => (m.id === editingMedicine.id ? updated : m))
        );
      } else {
        const created = await pharmacyDb.createMedicine(formData);
        setMedicines((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  const handleQuickStockAdjust = async (id: string, delta: number) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return;
    const nextStock = Math.max(0, med.stock + delta);
    try {
      const updated = await pharmacyDb.updateMedicine(id, { stock: nextStock });
      setMedicines((prev) => prev.map((m) => (m.id === id ? updated : m)));
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
            <Pill className="text-[#00897b]" size={20} />
            <span>Medicines & Drug Inventory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage pharmaceuticals, brand names, generic formulations, batch numbers, and stock levels.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-sm transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-teal-500 shadow-sm"
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
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">Medicine / Brand</th>
                <th className="py-3 px-4 font-semibold">Generic & Strength</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Batch / Expiry</th>
                <th className="py-3 px-4 font-semibold">Cost / Sell</th>
                <th className="py-3 px-4 font-semibold">Stock</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                    <tr key={med.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{med.name}</div>
                        <div className="text-[11px] text-slate-500">{med.manufacturer}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{med.genericName}</div>
                        <div className="text-[11px] text-[#00897b]">
                          {med.dosageForm} • {med.strength}
                          {Boolean(med.stripSize || med.boxSize) && (
                            <span className="ml-1 text-[10px] text-slate-500 font-normal">
                              ({med.stripSize ? `${med.stripSize}/${med.baseUnit || 'Strip'}` : ''}
                              {med.boxSize ? ` • ${med.boxSize}s/Box` : ''})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] border border-slate-200 text-slate-700">
                          {med.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-mono">{med.batchNumber}</div>
                        <div className="text-[11px] text-slate-500">Exp: {med.expiryDate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#00897b]">Rs. {med.sellingPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">Cost: Rs. {med.purchasePrice.toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickStockAdjust(med.id, -1)}
                            className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-200 transition"
                          >
                            -
                          </button>
                          <span
                            className={`font-bold px-2 py-0.5 rounded ${
                              isLow
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                            title={formatStockWithPacking(med.stock, med)}
                          >
                            {med.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickStockAdjust(med.id, 1)}
                            className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-200 transition"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-medium">
                          {formatStockWithPacking(med.stock, med)}
                        </div>
                        {isLow && (
                          <div className="text-[10px] text-rose-600 mt-0.5 flex items-center gap-1">
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
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                            title="Edit Medicine"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(med.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pill className="text-[#00897b]" size={18} />
                <span>{editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Panadol Extra"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Generic Formula *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol + Caffeine"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Antibiotics, Analgesic"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. GSK, Getz Pharma, Abbott"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Dosage Form</label>
                  <select
                    value={formData.dosageForm}
                    onChange={(e) => {
                      const newDf = e.target.value as any;
                      const currentBase = formData.baseUnit;
                      const oldDefault = getDefaultBaseUnit(formData.dosageForm);
                      const newDefault = getDefaultBaseUnit(newDf);
                      const isTabletLike = newDf === 'Tablet' || newDf === 'Capsule';
                      setFormData({
                        ...formData,
                        dosageForm: newDf,
                        baseUnit: (!currentBase || currentBase === oldDefault) ? newDefault : currentBase,
                        stripSize: formData.stripSize !== undefined ? formData.stripSize : (isTabletLike ? 10 : undefined),
                        boxSize: formData.boxSize !== undefined ? formData.boxSize : 10,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
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
                  <label className="block text-slate-700 font-medium mb-1">Strength / Volume</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 120ml"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Purchase Cost (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Retail Selling Price (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Current Stock (Units)</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Min Stock Reorder Level</label>
                  <input
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Barcode / EAN</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack B-2, Fridge 1"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Task 2: Packing / Units Optional Section */}
              <div className="pt-4 border-t border-slate-100">
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="text-[#00897b]" size={14} />
                    <span>Packing / Units (Optional)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Configure Strip and Box packaging multipliers. Leave empty if medicine is sold as single unit only.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-teal-50/40 p-3.5 rounded-xl border border-teal-100">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Base Unit</label>
                    <select
                      value={formData.baseUnit || getDefaultBaseUnit(formData.dosageForm)}
                      onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500"
                    >
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Bottle">Bottle</option>
                      <option value="Tube">Tube</option>
                      <option value="Ampoule">Ampoule</option>
                      <option value="Vial">Vial</option>
                      <option value="Sachet">Sachet</option>
                      <option value="Piece">Piece</option>
                      <option value="Pack">Pack</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Strip Size (Base Units)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 10 (1 Strip = 10 Tablets)"
                      value={formData.stripSize ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stripSize: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      1 Strip = {formData.stripSize || 10} {formData.baseUnit || 'Tablets'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Box Size (Strips)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 10 (1 Box = 10 Strips)"
                      value={formData.boxSize ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          boxSize: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      1 Box = {formData.boxSize || 10} {formData.stripSize ? 'Strips' : (formData.baseUnit || 'Tablets')}
                    </span>
                  </div>
                </div>

                {/* Live preview hint */}
                {Boolean(formData.stripSize || formData.boxSize) && (
                  <div className="mt-2.5 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong>Multipliers:</strong> 1 Strip = {formData.stripSize || 1} {formData.baseUnit || 'Unit'}s | 1 Box = {formData.stripSize ? `${formData.boxSize || 1} Strips (${(formData.boxSize || 1) * (formData.stripSize || 1)} ${formData.baseUnit || 'Unit'}s)` : `${formData.boxSize || 1} ${formData.baseUnit || 'Unit'}s`}
                    </span>
                    {Number(formData.sellingPrice || 0) > 0 && (
                      <span className="text-teal-700 font-medium">
                        <strong>Prices:</strong> Base: Rs. {Number(formData.sellingPrice || 0)}
                        {formData.stripSize && ` | Strip: Rs. ${Number(formData.sellingPrice || 0) * formData.stripSize}`}
                        {formData.boxSize && ` | Box: Rs. ${Number(formData.sellingPrice || 0) * (formData.stripSize ? formData.stripSize * formData.boxSize : formData.boxSize)}`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
