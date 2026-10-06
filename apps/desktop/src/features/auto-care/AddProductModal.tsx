"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Package, X, ScanBarcode, Camera, Plus } from "lucide-react";
import "./AddProductModal.css";
import { useCreateProduct } from "@/hooks/useProducts";
import { productRepo } from "@/lib/db";

// ─── Color palette ─────────────────────────────────────────────────────────
const COLOR_SWATCHES = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#111827", "#6b7280", "#d97706", "#059669",
];

// ─── Static POS category options (extend from DB if needed) ────────────────
const POS_CATEGORIES = [
  "Engine Oil & Fluids",
  "Filters",
  "Brakes",
  "Tyres & Wheels",
  "Battery & Electrical",
  "Suspension",
  "Exhaust",
  "Body Parts",
  "Accessories",
  "Consumables",
  "Workshop Tools",
  "Other",
];

// ─── Tax presets ──────────────────────────────────────────────────────────
const TAX_OPTIONS = [
  { id: "gst-17", label: "GST 17%", rate: 17 },
  { id: "gst-5",  label: "GST 5%",  rate: 5  },
  { id: "sts",    label: "Sales Tax (STS)", rate: 8 },
];

// ─── Types ────────────────────────────────────────────────────────────────
export interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface FormState {
  name: string;
  barcode: string;
  trackInventory: boolean;
  salesPrice: string;
  costPrice: string;
  stock: string;
  minimumStock: string;
  posCategory: string;
  color: string;
  selectedTaxIds: string[];
  imageDataUrl: string | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  barcode: "",
  trackInventory: true,
  salesPrice: "",
  costPrice: "",
  stock: "0",
  minimumStock: "0",
  posCategory: "",
  color: "",
  selectedTaxIds: [],
  imageDataUrl: null,
};

// ─── Toast helper ─────────────────────────────────────────────────────────
type ToastType = { msg: string; kind: "success" | "error" } | null;

// ─── Unique SKU generator ─────────────────────────────────────────────────
function generateSKU(name: string): string {
  const prefix = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(3, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

// ─── Component ────────────────────────────────────────────────────────────
export function AddProductModal({ open, onClose, onSaved }: AddProductModalProps) {
  const createProduct = useCreateProduct();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastType>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setIsDirty(false);
      setSaving(false);
      setTimeout(() => nameRef.current?.focus(), 120);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDiscard();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDirty]);

  // Show toast helper
  const showToast = useCallback((msg: string, kind: "success" | "error" = "success") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Field update
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Validate
  const validate = async (): Promise<boolean> => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = "Product name is required";
    const price = parseFloat(form.salesPrice);
    if (!form.salesPrice || isNaN(price) || price < 0)
      errs.salesPrice = "Enter a valid sales price";

    // Check duplicate barcode
    if (form.barcode.trim()) {
      try {
        const existing = await productRepo.findAll("tenant-1");
        const dup = existing.find(
          (p) => p.barcode && p.barcode.toLowerCase() === form.barcode.trim().toLowerCase()
        );
        if (dup) errs.barcode = `Barcode already used by "${dup.name}"`;
      } catch {
        // ignore DB errors in browser mode
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save core logic
  const doSave = async (): Promise<boolean> => {
    if (!(await validate())) return false;
    setSaving(true);
    try {
      const sku = generateSKU(form.name);
      await createProduct.mutateAsync({
        tenantId: "tenant-1",
        sku,
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        categoryId: form.posCategory || undefined,
        costPrice: parseFloat(form.costPrice) || 0,
        sellingPrice: parseFloat(form.salesPrice) || 0,
        stock: form.trackInventory ? (parseInt(form.stock) || 0) : 0,
        minimumStock: parseInt(form.minimumStock) || 0,
        status: "active",
        images: form.imageDataUrl ? [form.imageDataUrl] : undefined,
        metadata: {
          color: form.color || undefined,
          taxIds: form.selectedTaxIds,
          trackInventory: form.trackInventory,
        },
      });
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save product", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Add & Close
  const handleAddClose = async () => {
    const ok = await doSave();
    if (ok) {
      showToast(`"${form.name}" added successfully!`, "success");
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 600);
    }
  };

  // Add & New
  const handleAddNew = async () => {
    const ok = await doSave();
    if (ok) {
      showToast(`"${form.name}" added! Form ready for next product.`, "success");
      setForm(EMPTY_FORM);
      setIsDirty(false);
      setErrors({});
      setTimeout(() => nameRef.current?.focus(), 80);
      onSaved?.();
    }
  };

  // Discard
  const handleDiscard = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onClose();
    }
  };

  const confirmDiscard = () => {
    setShowDiscard(false);
    setForm(EMPTY_FORM);
    setIsDirty(false);
    onClose();
  };

  // Image upload
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      set("imageDataUrl", e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  // Tax toggle
  const toggleTax = (id: string) => {
    setIsDirty(true);
    setForm((prev) => ({
      ...prev,
      selectedTaxIds: prev.selectedTaxIds.includes(id)
        ? prev.selectedTaxIds.filter((t) => t !== id)
        : [...prev.selectedTaxIds, id],
    }));
  };

  if (!open) return null;

  const modal = (
    <div className="apm-overlay" onClick={(e) => e.target === e.currentTarget && handleDiscard()}>
      <div className="apm-modal" role="dialog" aria-modal="true" aria-label="Add Product">
        {/* ── Header ── */}
        <div className="apm-header">
          <span className="apm-title">
            <Package size={18} />
            Add Product
          </span>
          <button className="apm-close" onClick={handleDiscard} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="apm-body">
          {/* Sidebar — image + color */}
          <div className="apm-sidebar">
            {/* Image upload */}
            <div
              className="apm-image-area"
              onClick={() => imageInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()}
              aria-label="Upload product image"
            >
              {form.imageDataUrl ? (
                <>
                  <img src={form.imageDataUrl} alt="Product" />
                  <button
                    className="apm-image-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      set("imageDataUrl", null);
                    }}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </>
              ) : (
                <div className="apm-image-placeholder">
                  <Camera size={28} strokeWidth={1.5} />
                  <span>Click to add image</span>
                </div>
              )}
              {!form.imageDataUrl && (
                <span className="apm-image-badge"><Plus size={12} /></span>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="apm-image-input"
              onChange={handleImageInput}
            />

            {/* Color swatches */}
            <div className="apm-color-section">
              <div className="apm-color-label">Color</div>
              <div className="apm-color-swatches">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`apm-swatch${form.color === c ? " selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => set("color", form.color === c ? "" : c)}
                    aria-label={`Color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="apm-fields">
            {/* Product Name */}
            <div className="apm-row">
              <label className="apm-label required">Product Name</label>
              <div className="apm-value" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <input
                  ref={nameRef}
                  className={`apm-input${errors.name ? " error" : ""}`}
                  placeholder="e.g. Synthetic Engine Oil 5W-30"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                {errors.name && <div className="apm-error-msg">{errors.name}</div>}
              </div>
            </div>

            {/* Barcode */}
            <div className="apm-row">
              <label className="apm-label">Barcode</label>
              <div className="apm-value" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="apm-barcode-wrap">
                  <input
                    ref={barcodeRef}
                    className={`apm-input apm-barcode-input${errors.barcode ? " error" : ""}`}
                    placeholder="Scan or type barcode…"
                    value={form.barcode}
                    onChange={(e) => set("barcode", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                  <span
                    className="apm-barcode-icon"
                    title="Focus barcode scanner"
                    onClick={() => barcodeRef.current?.focus()}
                  >
                    <ScanBarcode size={18} />
                  </span>
                </div>
                {errors.barcode && <div className="apm-error-msg">{errors.barcode}</div>}
              </div>
            </div>

            {/* Track Inventory */}
            <div className="apm-row">
              <label className="apm-label">Track Inventory</label>
              <div className="apm-value">
                <label className="apm-toggle">
                  <input
                    type="checkbox"
                    checked={form.trackInventory}
                    onChange={(e) => set("trackInventory", e.target.checked)}
                  />
                  <span className="apm-toggle-track" />
                  <span className="apm-toggle-thumb" />
                </label>
                <span className="apm-toggle-text">
                  {form.trackInventory ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            {/* Sales Price */}
            <div className="apm-row">
              <label className="apm-label required">Sales Price</label>
              <div className="apm-value" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, color: "#6b7280", whiteSpace: "nowrap" }}>Rs.</span>
                  <input
                    type="number"
                    className={`apm-input${errors.salesPrice ? " error" : ""}`}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={form.salesPrice}
                    onChange={(e) => set("salesPrice", e.target.value)}
                  />
                </div>
                {errors.salesPrice && <div className="apm-error-msg">{errors.salesPrice}</div>}
              </div>
            </div>

            {/* Cost Price */}
            <div className="apm-row">
              <label className="apm-label">Cost Price</label>
              <div className="apm-value">
                <span style={{ fontSize: 14, color: "#6b7280", whiteSpace: "nowrap" }}>Rs.</span>
                <input
                  type="number"
                  className="apm-input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => set("costPrice", e.target.value)}
                />
              </div>
            </div>

            {/* Sales Taxes */}
            <div className="apm-row">
              <label className="apm-label">Sales Taxes</label>
              <div className="apm-value">
                <div className="apm-tags">
                  {form.selectedTaxIds.map((id) => {
                    const t = TAX_OPTIONS.find((x) => x.id === id);
                    return t ? (
                      <span key={id} className="apm-tag">
                        {t.label}
                        <button type="button" onClick={() => toggleTax(id)} aria-label={`Remove ${t.label}`}>
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                  {TAX_OPTIONS.filter((t) => !form.selectedTaxIds.includes(t.id)).map((t) => (
                    <button key={t.id} type="button" className="apm-tag-add" onClick={() => toggleTax(t.id)}>
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* POS Category */}
            <div className="apm-row">
              <label className="apm-label">POS Category</label>
              <div className="apm-value">
                <select
                  className="apm-select"
                  value={form.posCategory}
                  onChange={(e) => set("posCategory", e.target.value)}
                >
                  <option value="">— None —</option>
                  {POS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock (only if tracking) */}
            {form.trackInventory && (
              <>
                <div className="apm-row">
                  <label className="apm-label">Initial Stock</label>
                  <div className="apm-value">
                    <input
                      type="number"
                      className="apm-input"
                      placeholder="0"
                      min="0"
                      value={form.stock}
                      onChange={(e) => set("stock", e.target.value)}
                    />
                  </div>
                </div>
                <div className="apm-row">
                  <label className="apm-label">Min Stock Alert</label>
                  <div className="apm-value">
                    <input
                      type="number"
                      className="apm-input"
                      placeholder="0"
                      min="0"
                      value={form.minimumStock}
                      onChange={(e) => set("minimumStock", e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="apm-footer">
          <button className="apm-btn apm-btn-discard" type="button" onClick={handleDiscard} disabled={saving}>
            Discard
          </button>
          <button className="apm-btn apm-btn-add-new" type="button" onClick={handleAddNew} disabled={saving}>
            {saving ? <span className="apm-spinner" /> : <Plus size={14} />}
            Add &amp; New
          </button>
          <button className="apm-btn apm-btn-save" type="button" onClick={handleAddClose} disabled={saving}>
            {saving ? <span className="apm-spinner" /> : null}
            Add &amp; Close
          </button>
        </div>
      </div>

      {/* Discard confirm */}
      {showDiscard && (
        <div className="apm-confirm-overlay" onClick={() => setShowDiscard(false)}>
          <div className="apm-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="apm-confirm-title">Discard changes?</div>
            <div className="apm-confirm-text">
              You have unsaved changes. Are you sure you want to discard them?
            </div>
            <div className="apm-confirm-actions">
              <button className="apm-btn apm-btn-discard" onClick={() => setShowDiscard(false)}>
                Keep Editing
              </button>
              <button className="apm-btn apm-btn-save" style={{ background: "#ef4444", borderColor: "#ef4444" }} onClick={confirmDiscard}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      {toast &&
        createPortal(
          <div className={`apm-toast ${toast.kind}`}>
            {toast.kind === "success" ? "✓" : "✕"} {toast.msg}
          </div>,
          document.body
        )}
    </>
  );
}
