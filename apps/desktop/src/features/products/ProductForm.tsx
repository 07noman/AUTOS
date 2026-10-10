"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Check } from "lucide-react";
import "./OdooProductModal.css";
import { useCreateProduct, useCategories, useCreateCategory } from "@/hooks/useProducts";
import { getCurrentTenantId } from "@/lib/db";

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

export interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ProductForm({ open, onOpenChange, onSaved }: ProductFormProps) {
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();

  // Form states matching screenshot
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
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
      setTimeout(() => nameInputRef.current?.focus(), 80);
      setErrors({});
      setShowNewCatInput(false);
      setNewCatName("");
    }
  }, [open]);

  if (!open) return null;

  const resetForm = () => {
    setName("");
    setBarcode("");
    setTrackInventory(true);
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
    // Generate standard EAN-13 style random barcode
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

      // Resolve category ID if category name was provided
      let categoryIdToSave: string | undefined = undefined;
      if (posCategory && posCategory !== "") {
        const found = categories.find((c) => c.name.toLowerCase() === posCategory.toLowerCase() || c.id === posCategory);
        categoryIdToSave = found ? found.id : posCategory;
      }

      await createProduct.mutateAsync({
        tenantId,
        sku,
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        categoryId: categoryIdToSave,
        sellingPrice: price,

        costPrice: cost,
        stock: trackInventory ? 10 : 0,
        minimumStock: trackInventory ? 2 : 0,
        status: "active",
        images: imageDataUrl ? [imageDataUrl] : undefined,
        metadata: {
          color: color || undefined,
          tax: selectedTax || undefined,
          trackInventory,
        },
      });

      onSaved?.();
      return true;
    } catch (err) {
      console.error("Save product failed:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddAndNew = async () => {
    const success = await doSave();
    if (success) {
      resetForm();
      nameInputRef.current?.focus();
    }
  };

  const handleAddAndClose = async () => {
    const success = await doSave();
    if (success) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleDiscard = () => {
    resetForm();
    onOpenChange(false);
  };

  const modal = (
    <div
      className="odoo-prod-overlay"
      onClick={(e) => e.target === e.currentTarget && handleDiscard()}
    >
      <div className="odoo-prod-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="odoo-prod-header">
          <span className="odoo-prod-title">New Product</span>
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
          {/* Left: Input Fields */}
          <div className="odoo-prod-fields">
            {/* Product Name */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Product Name</span>
              <div className="odoo-prod-control" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <input
                  ref={nameInputRef}
                  type="text"
                  className={`odoo-prod-input ${errors.name ? "error" : ""}`}
                  placeholder="e.g. Cheese Burger"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <span className="odoo-prod-err">{errors.name}</span>}
              </div>
            </div>

            {/* Barcode */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Barcode</span>
              <div className="odoo-prod-control">
                <div className="odoo-prod-barcode-wrap">
                  <input
                    type="text"
                    className="odoo-prod-input"
                    placeholder="e.g. 1234567890"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                  <span
                    className="odoo-prod-barcode-icon"
                    title="Generate / Scan Barcode"
                    onClick={generateBarcode}
                  >
                    {/* Barcode visual lines icon */}
                    <svg width="22" height="15" viewBox="0 0 24 16" fill="currentColor">
                      <rect x="0" y="0" width="2" height="16" />
                      <rect x="3" y="0" width="1" height="16" />
                      <rect x="5" y="0" width="3" height="16" />
                      <rect x="9" y="0" width="1" height="16" />
                      <rect x="11" y="0" width="2" height="16" />
                      <rect x="14" y="0" width="1" height="16" />
                      <rect x="16" y="0" width="3" height="16" />
                      <rect x="20" y="0" width="1.5" height="16" />
                      <rect x="22.5" y="0" width="1.5" height="16" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Track Inventory */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Track Inventory <span className="odoo-prod-help" title="Track inventory and stock alerts for this item">?</span>
              </span>
              <div className="odoo-prod-control">
                <label className="odoo-prod-checkbox-wrap">
                  <input
                    type="checkbox"
                    className="odoo-prod-checkbox"
                    checked={trackInventory}
                    onChange={(e) => setTrackInventory(e.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* Sales Price */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Sales Price <span className="odoo-prod-help" title="Customer sales price in PKR">?</span>
              </span>
              <div className="odoo-prod-control" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`odoo-prod-input ${errors.salesPrice ? "error" : ""}`}
                  placeholder="1.00"
                  value={salesPrice}
                  onChange={(e) => setSalesPrice(e.target.value)}
                />
                {errors.salesPrice && <span className="odoo-prod-err">{errors.salesPrice}</span>}
              </div>
            </div>

            {/* Cost Price (directly below Sales Price) */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Cost Price <span className="odoo-prod-help" title="Purchase/Cost price of product">?</span>
              </span>
              <div className="odoo-prod-control" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="odoo-prod-input"
                  placeholder="0.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Sales Taxes */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Sales Taxes <span className="odoo-prod-help" title="Applicable sales taxes">?</span>
              </span>
              <div className="odoo-prod-control">
                <select
                  className="odoo-prod-select"
                  value={selectedTax}
                  onChange={(e) => setSelectedTax(e.target.value)}
                >
                  <option value="">Select tax...</option>
                  {TAX_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* POS Category with + Add New Category option */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                POS Category <span className="odoo-prod-help" title="Assign category to display in POS screen">?</span>
              </span>
              <div className="odoo-prod-control" style={{ flexDirection: "column", alignItems: "stretch" }}>
                {showNewCatInput ? (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%" }}>
                    <input
                      type="text"
                      className="odoo-prod-input"
                      placeholder="Enter new category name..."
                      value={newCatName}
                      autoFocus
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateNewCategory();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateNewCategory}
                      disabled={creatingCat || !newCatName.trim()}
                      className="odoo-prod-btn-primary"
                      style={{ padding: "4px 10px", fontSize: "12px", height: "30px", flexShrink: 0 }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewCatInput(false)}
                      className="odoo-prod-btn-discard"
                      style={{ padding: "4px 8px", fontSize: "12px", height: "30px", flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
                    <select
                      className="odoo-prod-select category-select"
                      value={posCategory}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") {
                          setShowNewCatInput(true);
                        } else {
                          setPosCategory(e.target.value);
                        }
                      }}
                    >
                      <option value="">Select category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__add_new__">+ Add New Category...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCatInput(true)}
                      title="Add New Category"
                      style={{
                        background: "none",
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

          {/* Right: Camera Photo Box matching screenshot */}
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
              /* Camera + Plus SVG Icon from Screenshot */
              <svg
                className="odoo-prod-photo-svg-icon"
                viewBox="0 0 72 72"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Camera body */}
                <path d="M12 24h9l3-5h24l3 5h9a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5z" />
                {/* Camera Lens Circle */}
                <circle cx="36" cy="40" r="11" />
                {/* Plus circle badge */}
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
