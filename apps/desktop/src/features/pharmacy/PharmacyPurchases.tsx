import { useState, useEffect } from 'react';
import {
  FileCheck2,
  Plus,
  Trash2,
  Search,
  Truck,
  CheckCircle,
  X,
  PackagePlus,
} from 'lucide-react';
import {
  pharmacyDb,
  type Medicine,
  type Supplier,
  type PurchaseOrder,
  type PurchaseItem,
} from './pharmacyData';

export function PharmacyPurchases() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      pharmacyDb.getPurchases(),
      pharmacyDb.getMedicines(),
      pharmacyDb.getSuppliers(),
    ])
      .then(([pos, meds, sups]) => {
        if (mounted) {
          setPurchases(pos);
          setMedicines(meds);
          setSuppliers(sups);
          if (sups.length > 0 && !selectedSupplierId) {
            setSelectedSupplierId(sups[0].id);
          }
          if (meds.length > 0 && !selectedMedId) {
            setSelectedMedId(meds[0].id);
            setRowCost(meds[0].purchasePrice || 50);
          }
        }
      })
      .catch((err) => console.error('[PharmacyPurchases] Load error:', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Row input state
  const [selectedMedId, setSelectedMedId] = useState('');
  const [rowBatch, setRowBatch] = useState('BN-2024-NEW');
  const [rowMfg, setRowMfg] = useState(new Date().toISOString().split('T')[0]);
  const [rowExp, setRowExp] = useState('2027-12-31');
  const [rowQty, setRowQty] = useState(50);
  const [rowCost, setRowCost] = useState(50);

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleAddItem = () => {
    const med = medicines.find((m) => m.id === selectedMedId);
    if (!med || rowQty <= 0) return;

    const newItem: PurchaseItem = {
      medicineId: med.id,
      medicineName: med.name,
      batchNumber: rowBatch,
      mfgDate: rowMfg,
      expiryDate: rowExp,
      quantity: rowQty,
      unitCost: rowCost,
      total: rowQty * rowCost,
    };

    setOrderItems([...orderItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      alert('Please add at least one medicine item to the purchase order.');
      return;
    }

    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);

      const paymentStatus: 'paid' | 'partial' | 'unpaid' =
        paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      const createdPO = await pharmacyDb.createPurchase({
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'Authorized Distributor',
        date: new Date().toISOString().split('T')[0],
        items: orderItems,
        subtotal,
        discount,
        total: grandTotal,
        paidAmount,
        paymentStatus,
        notes,
      });

      // 2. Auto Inventory Update: Increment stock of purchased medicines & update batch/expiry
      const updatedMeds = [...medicines];
      for (const item of orderItems) {
        const m = updatedMeds.find((x) => x.id === item.medicineId);
        if (m) {
          const nextStock = m.stock + item.quantity;
          await pharmacyDb.updateMedicine(m.id, {
            stock: nextStock,
            purchasePrice: item.unitCost,
            batchNumber: item.batchNumber,
            mfgDate: item.mfgDate,
            expiryDate: item.expiryDate,
          });
          m.stock = nextStock;
          m.purchasePrice = item.unitCost;
          m.batchNumber = item.batchNumber;
          m.mfgDate = item.mfgDate;
          m.expiryDate = item.expiryDate;
        }
      }

      setPurchases((prev) => [createdPO, ...prev]);
      setMedicines(updatedMeds);
      setOrderItems([]);
      setDiscount(0);
      setPaidAmount(0);
      setNotes('');
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save, check internet');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="text-[#00897b]" size={20} />
            <span>Purchase Orders & Stock Receiving</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Receive new medicine batches from suppliers with automated stock and cost updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* PO History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 font-semibold">PO #</th>
                <th className="py-3 px-4 font-semibold">Distributor</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Items</th>
                <th className="py-3 px-4 font-semibold">Total Amount</th>
                <th className="py-3 px-4 font-semibold">Paid Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders recorded yet. Click '+ Create Purchase Order' to record incoming medicine stock.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-semibold text-teal-700 font-mono">{po.poNumber}</td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{po.supplierName}</td>
                  <td className="py-3 px-4 text-slate-500">{po.date}</td>
                  <td className="py-3 px-4 text-slate-700">
                    {po.items.length} {po.items.length === 1 ? 'Drug' : 'Drugs'} (
                    {po.items.reduce((s, i) => s + i.quantity, 0)} Units)
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">Rs. {po.total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-emerald-700 font-semibold">Rs. {po.paidAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        po.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : po.paymentStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {po.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Order Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PackagePlus className="text-[#00897b]" size={18} />
                <span>Receive Medicine Purchase Order & Stock</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePO} className="space-y-4 text-xs">
              {/* Supplier Selection */}
              <div>
                <label className="block text-slate-700 font-medium mb-1">Select Pharmaceutical Distributor *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Item Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-semibold text-teal-800 block">Add Medicine to Order</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Medicine *</label>
                    <select
                      value={selectedMedId}
                      onChange={(e) => {
                        setSelectedMedId(e.target.value);
                        const m = medicines.find((x) => x.id === e.target.value);
                        if (m) setRowCost(m.purchasePrice);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.genericName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Batch # *</label>
                    <input
                      type="text"
                      value={rowBatch}
                      onChange={(e) => setRowBatch(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={rowExp}
                      onChange={(e) => setRowExp(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Quantity (Units) *</label>
                    <input
                      type="number"
                      min="1"
                      value={rowQty}
                      onChange={(e) => setRowQty(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Unit Cost Price (Rs.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rowCost}
                      onChange={(e) => setRowCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 rounded-lg bg-[#00897b] hover:bg-[#00897b]/90 text-white font-medium shadow-sm transition"
                    >
                      + Add to List
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 font-semibold">Medicine</th>
                      <th className="p-2.5 font-semibold">Batch</th>
                      <th className="p-2.5 font-semibold">Expiry</th>
                      <th className="p-2.5 font-semibold">Qty</th>
                      <th className="p-2.5 font-semibold">Cost</th>
                      <th className="p-2.5 font-semibold">Total</th>
                      <th className="p-2.5 text-right font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No medicines added yet.
                        </td>
                      </tr>
                    ) : (
                      orderItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-900">{item.medicineName}</td>
                          <td className="p-2.5 font-mono text-slate-700">{item.batchNumber}</td>
                          <td className="p-2.5 text-slate-500">{item.expiryDate}</td>
                          <td className="p-2.5 font-bold text-slate-900">{item.quantity}</td>
                          <td className="p-2.5 text-slate-700">Rs. {item.unitCost}</td>
                          <td className="p-2.5 font-semibold text-emerald-700">Rs. {item.total}</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-600 hover:text-rose-700 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary and Payment fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Discount (Rs.)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Total Payable (Rs.)</label>
                  <div className="px-3 py-2 rounded-xl bg-slate-100 text-slate-900 font-bold text-sm border border-slate-200">
                    Rs. {grandTotal.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Amount Paid Today (Rs.)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                  />
                </div>
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
                  Receive Stock & Save PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyPurchases;
