import { useState } from 'react';
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
  pharmacyStorage,
  type Medicine,
  type Supplier,
  type PurchaseOrder,
  type PurchaseItem,
} from './pharmacyData';

export function PharmacyPurchases() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(() =>
    pharmacyStorage.getPurchases()
  );

  const [medicines, setMedicines] = useState<Medicine[]>(() => pharmacyStorage.getMedicines());
  const [suppliers] = useState<Supplier[]>(() => pharmacyStorage.getSuppliers());
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // Row input state
  const [selectedMedId, setSelectedMedId] = useState(medicines[0]?.id || '');
  const [rowBatch, setRowBatch] = useState('BN-2024-NEW');
  const [rowMfg, setRowMfg] = useState(new Date().toISOString().split('T')[0]);
  const [rowExp, setRowExp] = useState('2027-12-31');
  const [rowQty, setRowQty] = useState(50);
  const [rowCost, setRowCost] = useState(medicines[0]?.purchasePrice || 50);

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

  const handleSavePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      alert('Please add at least one medicine item to the purchase order.');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);

    const paymentStatus: 'paid' | 'partial' | 'unpaid' =
      paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-2026-${Math.floor(100 + Math.random() * 900)}`,
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
    };

    // 1. Save PO
    const updatedPOs = [newPO, ...purchases];
    setPurchases(updatedPOs);
    pharmacyStorage.savePurchases(updatedPOs);

    // 2. Auto Inventory Update: Increment stock of purchased medicines & update batch/expiry
    const updatedMeds = medicines.map((m) => {
      const matchItem = orderItems.find((item) => item.medicineId === m.id);
      if (matchItem) {
        return {
          ...m,
          stock: m.stock + matchItem.quantity,
          purchasePrice: matchItem.unitCost,
          batchNumber: matchItem.batchNumber,
          mfgDate: matchItem.mfgDate,
          expiryDate: matchItem.expiryDate,
        };
      }
      return m;
    });

    setMedicines(updatedMeds);
    pharmacyStorage.saveMedicines(updatedMeds);

    // Reset & close
    setOrderItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setNotes('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileCheck2 className="text-orange-400" size={20} />
            <span>Purchase Orders & Stock Receiving</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Receive new medicine batches from suppliers with automated stock and cost updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00897b] hover:bg-[#00897b]/90 text-white text-xs font-semibold shadow-lg shadow-teal-500/10 transition self-start sm:self-auto cursor-pointer"
        >
          <Plus size={16} />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* PO History Table */}
      <div className="bg-[#1b1c24] border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/[0.06]">
                <th className="py-3 px-4 font-semibold">PO #</th>
                <th className="py-3 px-4 font-semibold">Distributor</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Items</th>
                <th className="py-3 px-4 font-semibold">Total Amount</th>
                <th className="py-3 px-4 font-semibold">Paid Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders recorded yet. Click '+ Create Purchase Order' to record incoming medicine stock.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4 font-semibold text-teal-400">{po.poNumber}</td>
                  <td className="py-3 px-4 text-white font-medium">{po.supplierName}</td>
                  <td className="py-3 px-4 text-slate-400">{po.date}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {po.items.length} {po.items.length === 1 ? 'Drug' : 'Drugs'} (
                    {po.items.reduce((s, i) => s + i.quantity, 0)} Units)
                  </td>
                  <td className="py-3 px-4 font-bold text-white">Rs. {po.total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-emerald-400">Rs. {po.paidAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        po.paymentStatus === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : po.paymentStatus === 'partial'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1b1c24] border border-white/[0.1] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PackagePlus className="text-teal-400" size={18} />
                <span>Receive Medicine Purchase Order & Stock</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePO} className="space-y-4 text-xs">
              {/* Supplier Selection */}
              <div>
                <label className="block text-slate-400 mb-1">Select Pharmaceutical Distributor *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white focus:outline-none focus:border-teal-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Item Card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <span className="text-xs font-semibold text-teal-400 block">Add Medicine to Order</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Medicine *</label>
                    <select
                      value={selectedMedId}
                      onChange={(e) => {
                        setSelectedMedId(e.target.value);
                        const m = medicines.find((x) => x.id === e.target.value);
                        if (m) setRowCost(m.purchasePrice);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#25252d] border border-white/[0.08] text-white"
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.genericName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Batch # *</label>
                    <input
                      type="text"
                      value={rowBatch}
                      onChange={(e) => setRowBatch(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#25252d] border border-white/[0.08] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={rowExp}
                      onChange={(e) => setRowExp(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#25252d] border border-white/[0.08] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Quantity (Units) *</label>
                    <input
                      type="number"
                      min="1"
                      value={rowQty}
                      onChange={(e) => setRowQty(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#25252d] border border-white/[0.08] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Unit Cost Price (Rs.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rowCost}
                      onChange={(e) => setRowCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#25252d] border border-white/[0.08] text-white"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium"
                    >
                      + Add to List
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-slate-400">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5">Expiry</th>
                      <th className="p-2.5">Qty</th>
                      <th className="p-2.5">Cost</th>
                      <th className="p-2.5">Total</th>
                      <th className="p-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No medicines added yet.
                        </td>
                      </tr>
                    ) : (
                      orderItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium text-white">{item.medicineName}</td>
                          <td className="p-2.5 font-mono">{item.batchNumber}</td>
                          <td className="p-2.5 text-slate-400">{item.expiryDate}</td>
                          <td className="p-2.5 font-bold">{item.quantity}</td>
                          <td className="p-2.5">Rs. {item.unitCost}</td>
                          <td className="p-2.5 font-semibold text-emerald-400">Rs. {item.total}</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-400 hover:text-rose-300"
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
                  <label className="block text-slate-400 mb-1">Discount (Rs.)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Total Payable (Rs.)</label>
                  <div className="px-3 py-2 rounded-xl bg-white/[0.05] text-white font-bold text-sm">
                    Rs. {grandTotal.toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Amount Paid Today (Rs.)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#25252d] border border-white/[0.08] text-white"
                  />
                </div>
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
