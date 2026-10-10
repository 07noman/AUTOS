"use client";

import { useMemo, useState } from "react";
import {
  Package,
  Boxes,
  AlertTriangle,
  Search,
  Plus,
  ArrowUpDown,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@genx/ui/Card";
import { Button } from "@genx/ui/Button";
import { Badge } from "@genx/ui/Badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
} from "@genx/ui/Table";
import {
  useProducts,
  useCategories,
  useDeleteProduct,
  useAdjustStock,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { ProductForm } from "@/features/products/ProductForm";

export function InventoryView() {
  const { data: rawProducts = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const deleteProduct = useDeleteProduct();
  const adjustStock = useAdjustStock();
  const updateProduct = useUpdateProduct();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Form & Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [adjustModalProduct, setAdjustModalProduct] = useState<any | null>(null);
  const [adjustQtyDelta, setAdjustQtyDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustError, setAdjustError] = useState<string>("");

  // Quick edit modal
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editCost, setEditCost] = useState(0);
  const [editMinStock, setEditMinStock] = useState(0);

  // Category mapping
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
      map.set(c.name, c.name);
    }
    return map;
  }, [categories]);

  // Unified items
  const inventoryItems = useMemo(() => {
    return rawProducts.map((p) => {
      const resolvedCat = p.categoryId ? categoryMap.get(p.categoryId) || p.categoryId : "Uncategorized";
      const isLow = p.stock > 0 && p.stock <= p.minimumStock;
      const isOut = p.stock <= 0;
      const status: "in_stock" | "low_stock" | "out_of_stock" = isOut
        ? "out_of_stock"
        : isLow
        ? "low_stock"
        : "in_stock";

      return {
        ...p,
        categoryName: resolvedCat,
        stockStatus: status,
      };
    });
  }, [rawProducts, categoryMap]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventoryItems.filter((item) => {
      // Category filter
      const matchesCat =
        selectedCategory === "all" ||
        item.categoryId === selectedCategory ||
        item.categoryName.toLowerCase() === selectedCategory.toLowerCase();

      // Stock status filter
      const matchesStock =
        stockStatusFilter === "all" || item.stockStatus === stockStatusFilter;

      // Search filter
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        item.categoryName.toLowerCase().includes(q);

      return matchesCat && matchesStock && matchesSearch;
    });
  }, [inventoryItems, search, selectedCategory, stockStatusFilter]);

  // Overall KPIs
  const totalTracked = inventoryItems.filter((i) => i.metadata?.trackInventory !== false).length;
  const totalCategoriesCount = categories.length;
  const lowStockCount = inventoryItems.filter((i) => i.stockStatus === "low_stock").length;
  const outOfStockCount = inventoryItems.filter((i) => i.stockStatus === "out_of_stock").length;
  const totalValuation = inventoryItems.reduce((acc, i) => acc + (i.stock * (i.costPrice || 0)), 0);

  const money = (val: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 2,
    }).format(val || 0);

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.size === 0) return;
    const count = selectedProductIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected product(s)? Historical records will be safely archived.`)) {
      return;
    }
    for (const id of selectedProductIds) {
      await deleteProduct.mutateAsync(id);
    }
    setSelectedProductIds(new Set());
  };

  // Stock Adjustment Submission
  const handleApplyAdjustment = async () => {
    if (!adjustModalProduct) return;
    setAdjustError("");

    const newStock = adjustModalProduct.stock + adjustQtyDelta;
    if (newStock < 0) {
      setAdjustError(`Adjustment would result in negative stock (${newStock}). Current available is ${adjustModalProduct.stock}.`);
      return;
    }

    try {
      await adjustStock.mutateAsync({
        productId: adjustModalProduct.id,
        quantityDelta: adjustQtyDelta,
        notes: adjustReason.trim() || "Manual inventory adjustment",
      });
      setAdjustModalProduct(null);
      setAdjustQtyDelta(0);
      setAdjustReason("");
    } catch (err: any) {
      setAdjustError(err.message || "Failed to adjust stock");
    }
  };

  // Save Quick Edit
  const handleSaveQuickEdit = async () => {
    if (!editProduct) return;
    try {
      await updateProduct.mutateAsync({
        id: editProduct.id,
        tenantId: editProduct.tenantId,
        name: editName.trim(),
        sellingPrice: editPrice,
        costPrice: editCost,
        minimumStock: editMinStock,
      });
      setEditProduct(null);
    } catch (err: any) {
      alert("Failed to update product: " + err.message);
    }
  };

  const loading = productsLoading || categoriesLoading;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900">
            <Package className="h-6 w-6 text-[#79556f]" />
            Inventory &amp; Stock Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time stock levels, purchase costs, valuations, and auditable stock movements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedProductIds.size > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkDelete}
              className="text-rose-600 border-rose-300 hover:bg-rose-50 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedProductIds.size})
            </Button>
          )}

          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-[#79556f] text-white hover:bg-[#63435a] shadow-sm flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            + New Product
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Total Tracked SKUs</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalTracked}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across catalog</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Active Categories</div>
            <div className="text-2xl font-bold text-[#79556f] mt-1">{totalCategoriesCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Database categories</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Low Stock Alerts</div>
            <div className={clsx("text-2xl font-bold mt-1", lowStockCount > 0 ? "text-amber-600" : "text-emerald-600")}>
              {lowStockCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">≤ Min stock trigger</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Out of Stock</div>
            <div className={clsx("text-2xl font-bold mt-1", outOfStockCount > 0 ? "text-rose-600" : "text-emerald-600")}>
              {outOfStockCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Zero availability</div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 font-medium">Stock Valuation (Cost)</div>
            <div className="text-xl font-bold text-emerald-700 mt-1">{money(totalValuation)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Available on hand</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, barcode, or category…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-[#79556f]"
          />
        </div>

        {/* Dynamic Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-10 px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-[#79556f] cursor-pointer md:w-56"
        >
          <option value="all">All Categories ({categories.length})</option>
          {categories.map((c) => {
            const count = inventoryItems.filter(
              (i) => i.categoryId === c.id || i.categoryName.toLowerCase() === c.name.toLowerCase()
            ).length;
            return (
              <option key={c.id} value={c.name}>
                {c.name} ({count})
              </option>
            );
          })}
        </select>

        {/* Stock Status Filter */}
        <select
          value={stockStatusFilter}
          onChange={(e) => setStockStatusFilter(e.target.value as any)}
          className="h-10 px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-[#79556f] cursor-pointer md:w-44"
        >
          <option value="all">All Stock Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock (≤ Alert)</option>
          <option value="out_of_stock">Out of Stock (0)</option>
        </select>
      </div>

      {/* ── Inventory Table ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 text-slate-600">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={
                    filteredItems.length > 0 &&
                    selectedProductIds.size === filteredItems.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-[#79556f] focus:ring-[#79556f]"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Product / Part</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>SKU / Barcode</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Sales Price</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                  Loading inventory database records…
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-8 w-8 text-slate-300" />
                    <p className="font-medium">No products match your filters</p>
                    <p className="text-xs text-slate-400">Try adjusting your search query or category</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedProductIds.has(item.id);
                return (
                  <TableRow
                    key={item.id}
                    className={clsx(
                      "hover:bg-slate-50/70 transition border-b last:border-0",
                      isSelected && "bg-[#fbf7fa]"
                    )}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(item.id)}
                        className="rounded border-slate-300 text-[#79556f] focus:ring-[#79556f]"
                      />
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {item.categoryName}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-slate-500">
                      <div>{item.sku || "—"}</div>
                      {item.barcode && <div className="text-[11px] text-slate-400">{item.barcode}</div>}
                    </TableCell>

                    <TableCell className="text-right text-slate-500 text-sm">
                      {money(item.costPrice || 0)}
                    </TableCell>

                    <TableCell className="text-right font-medium text-slate-900 text-sm">
                      {money(item.sellingPrice || 0)}
                    </TableCell>

                    <TableCell className="text-right">
                      <span
                        className={clsx(
                          "font-bold text-sm",
                          item.stock <= 0
                            ? "text-rose-600"
                            : item.stock <= item.minimumStock
                            ? "text-amber-600"
                            : "text-slate-900"
                        )}
                      >
                        {item.stock}
                      </span>
                    </TableCell>

                    <TableCell className="text-right text-xs text-slate-500 font-mono">
                      {item.minimumStock || 0}
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge
                        variant={
                          item.stockStatus === "in_stock"
                            ? "success"
                            : item.stockStatus === "low_stock"
                            ? "warning"
                            : "error"
                        }
                      >
                        {item.stockStatus === "in_stock"
                          ? "In Stock"
                          : item.stockStatus === "low_stock"
                          ? "Low Stock"
                          : "Out of Stock"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Adjust Stock Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAdjustModalProduct(item);
                            setAdjustQtyDelta(0);
                            setAdjustReason("");
                            setAdjustError("");
                          }}
                          title="Adjust Quantity"
                          className="text-[#79556f] hover:bg-[#eee7ed] h-8 px-2"
                        >
                          <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                          Adjust
                        </Button>

                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditProduct(item);
                            setEditName(item.name);
                            setEditPrice(item.sellingPrice);
                            setEditCost(item.costPrice || 0);
                            setEditMinStock(item.minimumStock || 0);
                          }}
                          title="Edit Details"
                          className="text-slate-600 hover:bg-slate-100 h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (window.confirm(`Delete "${item.name}" from catalog?`)) {
                              await deleteProduct.mutateAsync(item.id);
                            }
                          }}
                          title="Delete Product"
                          className="text-rose-600 hover:bg-rose-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Stock Adjustment Modal ── */}
      {adjustModalProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setAdjustModalProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-800 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-900">Adjust Inventory Stock</h3>
              <button
                onClick={() => setAdjustModalProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <div className="text-xs text-slate-500">Product Name</div>
                <div className="font-semibold text-slate-900">{adjustModalProduct.name}</div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  SKU: {adjustModalProduct.sku} · Current: {adjustModalProduct.stock} units
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Quantity Change (+ to add, - to reduce)
                </label>
                <input
                  type="number"
                  value={adjustQtyDelta || ""}
                  onChange={(e) => setAdjustQtyDelta(parseInt(e.target.value) || 0)}
                  placeholder="e.g. +10 or -2"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                />
                <div className="mt-1 text-xs text-slate-500">
                  New resulting stock:{" "}
                  <span className="font-bold text-slate-900">
                    {adjustModalProduct.stock + adjustQtyDelta}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Stock count recount, supplier shipment, damage"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                />
              </div>

              {adjustError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
                  {adjustError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={() => setAdjustModalProduct(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyAdjustment}
                isLoading={adjustStock.isPending}
                className="bg-[#79556f] text-white hover:bg-[#63435a]"
              >
                Save Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Edit Modal ── */}
      {editProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setEditProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-800 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-900">Edit Product Details</h3>
              <button
                onClick={() => setEditProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Product Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Sales Price (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Cost Price (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCost}
                    onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Min Stock Alert</label>
                <input
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#79556f]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={() => setEditProduct(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuickEdit}
                isLoading={updateProduct.isPending}
                className="bg-[#79556f] text-white hover:bg-[#63435a]"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Odoo-Style Modal */}
      <ProductForm open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  );
}

export default InventoryView;
