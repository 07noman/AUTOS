"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Check } from "lucide-react";
import "./OdooProductModal.css";
import { useCreateProduct, useUpdateProduct, useCategories, useCreateCategory } from "@/hooks/useProducts";
import { getCurrentTenantId, Product } from "@/lib/db";

const COLOR_PALETTE = [
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

const TAX_OPTIONS = [
  { id: "none", label: "No Tax (0%)", rate: 0 },
  { id: "gst-17", label: "Sales Tax 17%", rate: 17 },
  { id: "gst-18", label: "GST 18%", rate: 18 },
  { id: "gst-5", label: "Reduced 5%", rate: 5 },
  { id: "sts-8", label: "Services Tax 8%", rate: 8 },
];

export interface OldProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  productToEdit?: Product | null;
}

/**
 * Old Inventory Form — Used for ANY other business model:
 * Auto Store, AromaBlaze, Grocery, Pharmacy, Restaurant, Bakery, Cafe, etc.
 *
 * Strict Requirements:
 * - Exactly same fields as before: Product Name, Category, Barcode, Track Inventory, Sales Price, Cost Price, Sales Taxes, Color, Image.
 * - NO Mobile Fields: NO IMEI, NO PTA, NO Variant, NO Battery Health, NO Used Phone fields.
 * - NO Shop Type dropdown.
 * - Saves strictly to existing inventory products table.
 */
export function OldProductForm({ open, onOpenChange, onSaved, productToEdit }: OldProductFormProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();

  // Form states matching original Odoo product modal
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [stock, setStock] = useState("0");
  const [salesPrice, setSalesPrice] = useState("1.00");
  const [costPrice, setCostPrice] = useState("0.00");
  const [selectedTax, setSelectedTax] = useState("");
  const [posCategory, setPosCategory] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Add new category inline state
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; barcode?: string; salesPrice?: string }>({});
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (productToEdit) {
        setName(productToEdit.name || "");
        setBarcode(productToEdit.barcode || productToEdit.sku || "");
        setSalesPrice(productToEdit.sellingPrice !== undefined ? String(productToEdit.sellingPrice) : "1.00");
        setCostPrice(productToEdit.costPrice !== undefined ? String(productToEdit.costPrice) : "0.00");
        setStock(productToEdit.stock !== undefined ? String(productToEdit.stock) : "0");
        setPosCategory(productToEdit.categoryId || "");
        if (productToEdit.images && productToEdit.images.length > 0) {
          setImageDataUrl(productToEdit.images[0]);
        } else {
          setImageDataUrl(null);
        }
      } else {
        resetForm();
      }
      setTimeout(() => nameInputRef.current?.focus(), 80);
      setErrors({});
      setShowNewCatInput(false);
      setNewCatName("");
    }
  }, [open, productToEdit]);

  const resetForm = () => {
    setName("");
    setBarcode("");
    setTrackInventory(true);
    setStock("0");
    setSalesPrice("1.00");
    setCostPrice("0.00");
    setSelectedTax("");
    setPosCategory("");
    setColor("#ffffff");
    setImageDataUrl(null);
    setErrors({});
    setShowNewCatInput(false);
    setNewCatName("");
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageDataUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateBarcode = () => {
    const randomBarcode = "2" + Math.floor(10000000000 + Math.random() * 90000000000).toString();
    setBarcode(randomBarcode);
  };

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const created = await createCategory.mutateAsync(newCatName.trim());
      setPosCategory(created.name);
      setNewCatName("");
      setShowNewCatInput(false);
    } catch (err) {
      console.error("Failed to create category:", err);
    } finally {
      setCreatingCat(false);
    }
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Product name is required";
    const priceNum = parseFloat(salesPrice);
    if (isNaN(priceNum) || priceNum < 0) errs.salesPrice = "Valid sales price is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const doSave = async (): Promise<boolean> => {
    if (!validate()) return false;
    setSaving(true);
    try {
      const tenantId = getCurrentTenantId();
      const sku = barcode.trim() || `SKU-${Date.now().toString().slice(-6)}`;
      const price = parseFloat(salesPrice) || 0;
      const cost = parseFloat(costPrice) || 0;
      const stockVal = trackInventory ? parseInt(stock) || 0 : 0;

      let categoryIdToSave: string | undefined = undefined;
      if (posCategory && posCategory !== "") {
        const found = categories.find((c) => c.name.toLowerCase() === posCategory.toLowerCase() || c.id === posCategory);
        categoryIdToSave = found ? found.id : posCategory;
      }

      if (productToEdit) {
        await updateProduct.mutateAsync({
          id: productToEdit.id,
          tenantId,
          sku,
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryIdToSave,
          costPrice: cost,
          sellingPrice: price,
          stock: stockVal,
          minimumStock: productToEdit.minimumStock || 0,
          status: 'active',
          images: imageDataUrl ? [imageDataUrl] : [],
        });
      } else {
        await createProduct.mutateAsync({
          tenantId,
          sku,
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryIdToSave,
          costPrice: cost,
          sellingPrice: price,
          wholesalePrice: price,
          stock: stockVal,
          minimumStock: 0,
          status: "active",
          images: imageDataUrl ? [imageDataUrl] : [],
        });
      }

      onSaved?.();
      return true;
    } catch (err: any) {
      console.error("Failed to save product:", err);
      setErrors({ name: err?.message || "Failed to save product" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddAndNew = async () => {
    const ok = await doSave();
    if (ok) {
      resetForm();
      nameInputRef.current?.focus();
    }
  };

  const handleAddAndClose = async () => {
    const ok = await doSave();
    if (ok) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleDiscard = () => {
    resetForm();
    onOpenChange(false);
  };

  if (!open) return null;

  const modal = (
    <div
      className="odoo-prod-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDiscard();
      }}
    >
      <div className="odoo-prod-modal" role="dialog" aria-modal="true" data-testid="old-product-form">
        {/* Header */}
        <div className="odoo-prod-header">
          <span className="odoo-prod-title">
            {productToEdit ? "Edit Product" : "New Product"}
          </span>
          <button
            type="button"
            className="odoo-prod-close"
            onClick={handleDiscard}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="odoo-prod-body">
          {/* Left: Input Rows */}
          <div className="odoo-prod-fields">
            {/* Product Name */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Product Name</span>
              <div className="odoo-prod-control">
                <input
                  ref={nameInputRef}
                  type="text"
                  className={`odoo-prod-input ${errors.name ? "odoo-prod-input-error" : ""}`}
                  placeholder="e.g. Engine Oil, Air Freshener, Paracetamol..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddAndClose();
                  }}
                />
                {errors.name && (
                  <span className="odoo-prod-field-error">{errors.name}</span>
                )}
              </div>
            </div>

            {/* Sales Taxes */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Sales Taxes</span>
              <div className="odoo-prod-control">
                <select
                  className="odoo-prod-select"
                  value={selectedTax}
                  onChange={(e) => setSelectedTax(e.target.value)}
                >
                  <option value="">Choose tax...</option>
                  {TAX_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sales Price */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Sales Price</span>
              <div className="odoo-prod-control">
                <div className="odoo-prod-price-wrap">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`odoo-prod-input odoo-prod-price-input ${errors.salesPrice ? "odoo-prod-input-error" : ""}`}
                    value={salesPrice}
                    onChange={(e) => {
                      setSalesPrice(e.target.value);
                      if (errors.salesPrice) setErrors((prev) => ({ ...prev, salesPrice: undefined }));
                    }}
                  />
                  <span className="odoo-prod-price-suffix">Rs</span>
                </div>
                {errors.salesPrice && (
                  <span className="odoo-prod-field-error">{errors.salesPrice}</span>
                )}
              </div>
            </div>

            {/* Cost Price */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Cost</span>
              <div className="odoo-prod-control">
                <div className="odoo-prod-price-wrap">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="odoo-prod-input odoo-prod-price-input"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                  <span className="odoo-prod-price-suffix">Rs</span>
                </div>
              </div>
            </div>

            {/* Barcode */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Barcode</span>
              <div className="odoo-prod-control">
                <div className="odoo-prod-barcode-wrap">
                  <input
                    type="text"
                    className="odoo-prod-input odoo-prod-barcode-input"
                    placeholder="Scan or enter barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="odoo-prod-barcode-btn"
                    onClick={generateBarcode}
                    title="Generate standard barcode"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Track Inventory */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Track Inventory</span>
              <div className="odoo-prod-control">
                <label className="odoo-prod-checkbox-label">
                  <input
                    type="checkbox"
                    className="odoo-prod-checkbox"
                    checked={trackInventory}
                    onChange={(e) => setTrackInventory(e.target.checked)}
                  />
                  <span className="odoo-prod-checkbox-text">
                    Track on-hand stock quantities for this product
                  </span>
                </label>
              </div>
            </div>

            {/* Stock Quantity */}
            {trackInventory && (
              <div className="odoo-prod-row">
                <span className="odoo-prod-label">Stock Quantity</span>
                <div className="odoo-prod-control">
                  <input
                    type="number"
                    min="0"
                    className="odoo-prod-input"
                    style={{ maxWidth: "160px" }}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Category with Inline Add Button */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Category</span>
              <div className="odoo-prod-control">
                {showNewCatInput ? (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="text"
                      className="odoo-prod-input"
                      style={{ height: "34px", fontSize: "13px" }}
                      placeholder="Enter new category name..."
                      value={newCatName}
                      autoFocus
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateNewCategory();
                        } else if (e.key === "Escape") {
                          setShowNewCatInput(false);
                          setNewCatName("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateNewCategory}
                      disabled={creatingCat || !newCatName.trim()}
                      style={{
                        padding: "6px 12px",
                        background: "#79556f",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Check size={13} /> {creatingCat ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCatInput(false);
                        setNewCatName("");
                      }}
                      style={{
                        padding: "6px 8px",
                        background: "#e2e8f0",
                        color: "#475569",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      className="odoo-prod-select"
                      style={{ flex: 1 }}
                      value={posCategory}
                      onChange={(e) => setPosCategory(e.target.value)}
                    >
                      <option value="">Select Category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCatInput(true)}
                      title="Add new category"
                      style={{
                        background: "#f1f5f9",
                        border: "1px dashed #cbd5e1",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "#79556f",
                        padding: "4px 8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      <Plus size={13} /> New
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Color</span>
              <div className="odoo-prod-control">
                <div
                  className="odoo-prod-color-circle"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Choose card color"
                >
                  {showColorPicker && (
                    <div
                      className="odoo-prod-color-palette"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {COLOR_PALETTE.map((c) => (
                        <div
                          key={c}
                          className="odoo-prod-color-swatch"
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setColor(c);
                            setShowColorPicker(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Camera Photo Box */}
          <div
            className="odoo-prod-photo-box"
            onClick={() => imageInputRef.current?.click()}
            title="Click to upload image"
          >
            {imageDataUrl ? (
              <>
                <img
                  src={imageDataUrl}
                  alt="Product preview"
                  className="odoo-prod-photo-preview"
                />
                <button
                  type="button"
                  className="odoo-prod-photo-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageDataUrl(null);
                  }}
                  title="Remove photo"
                >
                  ×
                </button>
              </>
            ) : (
              <svg
                className="odoo-prod-photo-svg-icon"
                viewBox="0 0 72 72"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 24h9l3-5h24l3 5h9a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5z" />
                <circle cx="36" cy="40" r="11" />
                <circle cx="53" cy="46" r="10" fill="#cbd5e1" stroke="#ffffff" strokeWidth="2" />
                <line x1="53" y1="41" x2="53" y2="51" stroke="#ffffff" strokeWidth="2.5" />
                <line x1="48" y1="46" x2="58" y2="46" stroke="#ffffff" strokeWidth="2.5" />
              </svg>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageFile(f);
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="odoo-prod-footer">
          <button
            type="button"
            className="odoo-prod-btn-primary"
            onClick={handleAddAndNew}
            disabled={saving}
          >
            {saving ? "Adding..." : "Add & New"}
          </button>
          <button
            type="button"
            className="odoo-prod-btn-secondary"
            onClick={handleAddAndClose}
            disabled={saving}
          >
            Add & Close
          </button>
          <button
            type="button"
            className="odoo-prod-btn-discard"
            onClick={handleDiscard}
            disabled={saving}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
