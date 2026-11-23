"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Check, Smartphone, AlertCircle } from "lucide-react";
import "./OdooProductModal.css";
import { useCreateProduct, useUpdateProduct, useCategories, useCreateCategory } from "@/hooks/useProducts";
import { getCurrentTenantId, productRepo, mobileProductRepo } from "@/lib/db";
import { Product, ShopType, PtaStatus, WarrantyType } from "@genx/types/domain/product";

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

const POPULAR_BRANDS = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Vivo",
  "Oppo",
  "Realme",
  "Infinix",
  "Tecno",
  "OnePlus",
  "Google",
  "Motorola",
  "Huawei",
  "Honor",
  "Nothing",
  "Nokia",
  "Sony",
];

const COMMON_RAMS = ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB"];
const COMMON_STORAGES = ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"];

export interface DeviceImeiRow {
  id: string;
  imei1: string;
  imei2: string;
}

export interface NewProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  productToEdit?: Product | null;
}

/**
 * New Inventory Form — Used for Retail Store and Mobile Shops.
 *
 * Requirements:
 * - Fields: Product Name, Category, Brand, Variant, Color, PTA Status, Warranty,
 *   IMEI Product Yes/No, Shop Type [Auto Store (Default) / New Phone / Used Phone / Accessories / Mobile Shop / Retail Shop],
 *   Purchase Price, Sale Price, Barcode, Stock
 * - Default Shop Type = "Auto Store"
 * - Conditional Logic:
 *   - When New Phone, Used Phone, or Mobile Shop: Show mobile-specific fields.
 *   - When Auto Store, Accessories, or Retail Shop: Hide phone-specific fields, standard quantity stock.
 *   - Is IMEI Product = Yes: IMEI-wise device tracking, calculate stock from IMEI records.
 *   - Is IMEI Product = No: Standard quantity inventory.
 */
export function NewProductForm({ open, onOpenChange, onSaved, productToEdit }: NewProductFormProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();

  // Core Form states
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [salesPrice, setSalesPrice] = useState("1.00");
  const [costPrice, setCostPrice] = useState("0.00");
  const [selectedTax, setSelectedTax] = useState("");
  const [posCategory, setPosCategory] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // Mobile Retail Enhancement Fields — Default Shop Type is "Auto Store"
  const [shopType, setShopType] = useState<ShopType>("Auto Store");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [ptaStatus, setPtaStatus] = useState<PtaStatus>("Approved");
  const [warrantyType, setWarrantyType] = useState<WarrantyType>("Company");
  const [batteryHealth, setBatteryHealth] = useState<string>("");
  const [isImeiProduct, setIsImeiProduct] = useState<"Yes" | "No">("Yes");

  // IMEI Device Rows (each row = 1 physical device)
  const [imeiList, setImeiList] = useState<DeviceImeiRow[]>([
    { id: crypto.randomUUID(), imei1: "", imei2: "" },
  ]);

  // Add new category inline state
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  // Manual stock for non-IMEI items
  const [manualStock, setManualStock] = useState<number>(0);

  // UI state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Reset or load productToEdit
  useEffect(() => {
    if (!open) return;

    if (productToEdit) {
      setName(productToEdit.name || "");
      setBarcode(productToEdit.barcode || productToEdit.sku || "");
      setSalesPrice(productToEdit.sellingPrice !== undefined ? String(productToEdit.sellingPrice) : "1.00");
      setCostPrice(productToEdit.costPrice !== undefined ? String(productToEdit.costPrice) : "0.00");
      setManualStock(productToEdit.stock || 0);
      setPosCategory(productToEdit.categoryId || "");
      setIsNameManuallyEdited(true);

      if (productToEdit.images && productToEdit.images.length > 0) {
        setImageDataUrl(productToEdit.images[0]);
      } else {
        setImageDataUrl(null);
      }

      // Load mobile details
      const tenantId = getCurrentTenantId();
      void mobileProductRepo.findMobileDetails(tenantId, productToEdit.id).then((details) => {
        if (details) {
          setShopType(details.shopType || "Auto Store");
          setBrand(details.brand || "");
          setModel(details.model || "");
          setVariant((details as any).variant || details.model || "");
          setRam(details.ram || "");
          setStorage(details.storage || "");
          setPtaStatus(details.ptaStatus || "Approved");
          setWarrantyType(details.warrantyType || "Company");
          if ((details as any).batteryHealth) {
            setBatteryHealth(String((details as any).batteryHealth));
          }
          setIsImeiProduct(details.isImeiProduct ? "Yes" : "No");
        } else {
          setShopType("Auto Store");
        }
      });

      // Load registered IMEIs
      void mobileProductRepo.findImeis(tenantId, productToEdit.id).then((imeis) => {
        if (imeis && imeis.length > 0) {
          setImeiList(
            imeis.map((i) => ({
              id: i.id,
              imei1: i.imei1,
              imei2: i.imei2 || "",
            }))
          );
        } else {
          setImeiList([{ id: crypto.randomUUID(), imei1: "", imei2: "" }]);
        }
      });
    } else {
      resetForm();
    }

    setTimeout(() => nameInputRef.current?.focus(), 80);
    setErrors({});
    setShowNewCatInput(false);
    setNewCatName("");
  }, [open, productToEdit]);

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
    setShopType("Auto Store"); // Default Auto Store as required
    setBrand("");
    setModel("");
    setVariant("");
    setRam("");
    setStorage("");
    setPtaStatus("Approved");
    setWarrantyType("Company");
    setBatteryHealth("");
    setIsImeiProduct("Yes");
    setImeiList([{ id: crypto.randomUUID(), imei1: "", imei2: "" }]);
    setManualStock(0);
    setIsNameManuallyEdited(false);
    setErrors({});
    setShowNewCatInput(false);
    setNewCatName("");
  };

  // Auto-compose product name for mobile phones if user hasn't typed a custom name
  useEffect(() => {
    const isPhone = shopType === "New Phone" || shopType === "Used Phone" || shopType === "Mobile Shop";
    if (!isNameManuallyEdited && isPhone) {
      const parts = [
        brand.trim(),
        (variant.trim() || model.trim()),
        storage.trim(),
        ram.trim() ? `(${ram.trim()} RAM)` : "",
      ].filter(Boolean);

      if (parts.length > 0) {
        setName(parts.join(" "));
      }
    }
  }, [brand, model, variant, ram, storage, shopType, isNameManuallyEdited]);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImageDataUrl(e.target?.result as string);
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

  // Device IMEI row operations
  const handleAddImeiRow = () => {
    setImeiList((prev) => [...prev, { id: crypto.randomUUID(), imei1: "", imei2: "" }]);
  };

  const handleRemoveImeiRow = (index: number) => {
    setImeiList((prev) => {
      if (prev.length <= 1) {
        return [{ id: crypto.randomUUID(), imei1: "", imei2: "" }];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleImeiChange = (index: number, field: "imei1" | "imei2", value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 16);
    setImeiList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: clean };
      return updated;
    });
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[`imei_${index}_${field}`];
      delete copy.duplicate_imei;
      return copy;
    });
  };

  const handleShopTypeChange = (newType: ShopType) => {
    setShopType(newType);
    const isPhone = newType === "New Phone" || newType === "Used Phone" || newType === "Mobile Shop";
    if (!isPhone) {
      setIsImeiProduct("No");
    } else {
      setIsImeiProduct("Yes");
    }
  };

  const handleBrandChange = (b: string) => {
    setBrand(b);
  };

  const handleModelChange = (m: string) => {
    setModel(m);
    if (!variant) setVariant(m);
  };

  const handleVariantChange = (v: string) => {
    setVariant(v);
    if (!model) setModel(v);
  };

  // Calculated stock from registered IMEIs
  const validImeiDevices = imeiList.filter((d) => d.imei1.trim().length > 0);
  const calculatedStock = validImeiDevices.length;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Product name is required";
    const priceNum = parseFloat(salesPrice);
    if (isNaN(priceNum) || priceNum < 0) errs.salesPrice = "Valid sales price is required";

    const isPhone = shopType === "New Phone" || shopType === "Used Phone" || shopType === "Mobile Shop";

    // IMEI Validations when tracking is active
    if (isPhone && isImeiProduct === "Yes") {
      const seenImeis = new Set<string>();

      validImeiDevices.forEach((device, idx) => {
        const i1 = device.imei1.trim();
        const i2 = device.imei2.trim();

        if (i1.length < 14) {
          errs[`imei_${idx}_imei1`] = "IMEI 1 must be at least 14-16 digits";
        }
        if (seenImeis.has(i1)) {
          errs.duplicate_imei = `Duplicate IMEI ${i1} entered multiple times in this form`;
        }
        seenImeis.add(i1);

        if (i2.length > 0) {
          if (i2.length < 14) {
            errs[`imei_${idx}_imei2`] = "IMEI 2 must be at least 14-16 digits";
          }
          if (seenImeis.has(i2)) {
            errs.duplicate_imei = `Duplicate IMEI ${i2} entered multiple times in this form`;
          }
          seenImeis.add(i2);
        }
      });
    }

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

      const isPhone = shopType === "New Phone" || shopType === "Used Phone" || shopType === "Mobile Shop";
      const isImeiTracking = isPhone && isImeiProduct === "Yes";

      // 1. Database-wide Duplicate IMEI check
      if (isImeiTracking && validImeiDevices.length > 0) {
        const allImeis = validImeiDevices.flatMap((d) => [d.imei1, d.imei2].filter(Boolean));
        const dupCheck = await mobileProductRepo.checkDuplicateImeis(
          tenantId,
          allImeis,
          productToEdit?.id
        );

        if (dupCheck.isDuplicate) {
          setErrors({
            duplicate_imei: `IMEI ${dupCheck.duplicateImei} is already registered with product "${dupCheck.existingProductName}". Duplicate registration is blocked.`,
          });
          setSaving(false);
          return false;
        }
      }

      // Stock calculation rule
      const finalStock = isImeiTracking ? calculatedStock : manualStock;

      // Category resolution
      let categoryIdToSave: string | undefined = undefined;
      if (posCategory && posCategory !== "") {
        const found = categories.find(
          (c) => c.name.toLowerCase() === posCategory.toLowerCase() || c.id === posCategory
        );
        categoryIdToSave = found ? found.id : posCategory;
      }

      let savedProductId = productToEdit?.id;

      if (productToEdit) {
        // Edit existing product
        await updateProduct.mutateAsync({
          id: productToEdit.id,
          tenantId,
          sku,
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryIdToSave,
          costPrice: cost,
          sellingPrice: price,
          stock: finalStock,
          minimumStock: productToEdit.minimumStock || 0,
          status: "active",
          images: imageDataUrl ? [imageDataUrl] : [],
        });
        savedProductId = productToEdit.id;
      } else {
        // Create new product
        const created = await createProduct.mutateAsync({
          tenantId,
          sku,
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryIdToSave,
          costPrice: cost,
          sellingPrice: price,
          wholesalePrice: price,
          stock: finalStock,
          minimumStock: 0,
          status: "active",
          images: imageDataUrl ? [imageDataUrl] : [],
        });
        savedProductId = created.id;
      }

      // Save mobile details and IMEI devices
      if (savedProductId) {
        const now = Date.now();
        await mobileProductRepo.saveMobileDetails({
          id: crypto.randomUUID(),
          productId: savedProductId,
          tenantId,
          shopType,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          variant: variant.trim() || model.trim() || undefined,
          color: color || undefined,
          ram: ram.trim() || undefined,
          storage: storage.trim() || undefined,
          ptaStatus: isPhone ? ptaStatus : undefined,
          warrantyType: isPhone ? warrantyType : undefined,
          batteryHealth: batteryHealth ? parseInt(batteryHealth) || undefined : undefined,
          isImeiProduct: isImeiTracking,
          createdAt: now,
          updatedAt: now,
        });

        if (isImeiTracking) {
          const devicePayload = validImeiDevices.map((d) => ({
            id: d.id,
            imei1: d.imei1.trim(),
            imei2: d.imei2.trim() || undefined,
            status: "available" as const,
          }));
          await mobileProductRepo.saveImeis(tenantId, savedProductId, devicePayload);
        }
      }

      onSaved?.();
      return true;
    } catch (err) {
      console.error("Save product failed:", err);
      setErrors({ form: "Failed to save product. Please try again." });
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

  const isPhoneType = shopType === "New Phone" || shopType === "Used Phone" || shopType === "Mobile Shop";
  const isImeiTrackingEnabled = isPhoneType && isImeiProduct === "Yes";

  if (!open) return null;

  const modal = (
    <div
      className="odoo-prod-overlay"
      onClick={(e) => e.target === e.currentTarget && handleDiscard()}
    >
      <div className="odoo-prod-modal" role="dialog" aria-modal="true" data-testid="new-product-form">
        {/* Header */}
        <div className="odoo-prod-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="odoo-prod-title">
              {productToEdit ? "Edit Product" : "New Product"}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: isPhoneType ? "#eff6ff" : "#f1f5f9",
                color: isPhoneType ? "#1d4ed8" : "#475569",
                border: "1px solid #cbd5e1",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {isPhoneType && <Smartphone size={12} />}
              {shopType}
            </span>
          </div>
          <button
            type="button"
            className="odoo-prod-close"
            onClick={handleDiscard}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Error Banner */}
        {errors.form && (
          <div
            style={{
              margin: "0 26px 10px 26px",
              padding: "8px 12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#b91c1c",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AlertCircle size={15} />
            {errors.form}
          </div>
        )}

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
                  placeholder={isPhoneType ? "e.g. Apple iPhone 15 Pro Max (256GB)" : "e.g. Fast Charger 65W, Engine Oil"}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIsNameManuallyEdited(true);
                  }}
                />
                {errors.name && <span className="odoo-prod-err">{errors.name}</span>}
              </div>
            </div>

            {/* Category */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Category</span>
              <div className="odoo-prod-control">
                {showNewCatInput ? (
                  <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                    <input
                      type="text"
                      className="odoo-prod-input"
                      placeholder="New category name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="odoo-prod-btn-primary"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                      onClick={handleCreateNewCategory}
                      disabled={creatingCat}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="odoo-prod-btn-discard"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      onClick={() => setShowNewCatInput(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                    <select
                      className="odoo-prod-select"
                      value={posCategory}
                      onChange={(e) => setPosCategory(e.target.value)}
                    >
                      <option value="">Select category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="odoo-prod-btn-secondary"
                      style={{ padding: "4px 8px", whiteSpace: "nowrap", fontSize: "12px" }}
                      onClick={() => setShowNewCatInput(true)}
                    >
                      <Plus size={13} style={{ display: "inline" }} /> New
                    </button>
                  </div>
                )}
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
                  <span
                    className="odoo-prod-barcode-btn"
                    title="Generate standard barcode"
                    onClick={generateBarcode}
                  >
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

            {/* ── Shop Type (Default: Auto Store as required) ──────────────── */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Shop Type <span className="odoo-prod-help" title="Select product classification">?</span>
              </span>
              <div className="odoo-prod-control">
                <select
                  className="odoo-prod-select"
                  value={shopType}
                  onChange={(e) => handleShopTypeChange(e.target.value as ShopType)}
                  data-testid="shop-type-select"
                >
                  <option value="Auto Store">Auto Store</option>
                  <option value="New Phone">New Phone</option>
                  <option value="Used Phone">Used Phone</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Mobile Shop">Mobile Shop</option>
                  <option value="Retail Shop">Retail Shop</option>
                </select>
              </div>
            </div>

            {/* ── Mobile-Specific Fields (Conditional: Only for New/Used Phone or Mobile Shop) ── */}
            {isPhoneType && (
              <>
                {/* Brand */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Brand</span>
                  <div className="odoo-prod-control">
                    <input
                      list="genx-brands-list"
                      type="text"
                      className="odoo-prod-input"
                      placeholder="e.g. Apple, Samsung, Xiaomi"
                      value={brand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                    />
                    <datalist id="genx-brands-list">
                      {POPULAR_BRANDS.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Model / Variant */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Model / Variant</span>
                  <div className="odoo-prod-control" style={{ gap: "6px" }}>
                    <input
                      type="text"
                      className="odoo-prod-input"
                      style={{ flex: 1 }}
                      placeholder="Model e.g. iPhone 15 Pro, S24 Ultra"
                      value={model}
                      onChange={(e) => handleModelChange(e.target.value)}
                    />
                    <input
                      type="text"
                      className="odoo-prod-input"
                      style={{ flex: 1 }}
                      placeholder="Variant e.g. Dual SIM, 256GB"
                      value={variant}
                      onChange={(e) => handleVariantChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* RAM & Storage */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">RAM / Storage</span>
                  <div className="odoo-prod-control" style={{ gap: "8px" }}>
                    {/* RAM */}
                    <div style={{ flex: 1 }}>
                      <input
                        list="genx-ram-list"
                        type="text"
                        className="odoo-prod-input"
                        placeholder="RAM (e.g. 8 GB)"
                        value={ram}
                        onChange={(e) => setRam(e.target.value)}
                      />
                      <datalist id="genx-ram-list">
                        {COMMON_RAMS.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </div>

                    {/* Storage */}
                    <div style={{ flex: 1 }}>
                      <input
                        list="genx-storage-list"
                        type="text"
                        className="odoo-prod-input"
                        placeholder="Storage (e.g. 256 GB)"
                        value={storage}
                        onChange={(e) => setStorage(e.target.value)}
                      />
                      <datalist id="genx-storage-list">
                        {COMMON_STORAGES.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* PTA Status */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">PTA Status</span>
                  <div className="odoo-prod-control">
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {(["Approved", "Non-PTA", "Pending"] as PtaStatus[]).map((status) => (
                        <label
                          key={status}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: ptaStatus === status ? 600 : 400,
                            color:
                              status === "Approved" && ptaStatus === status
                                ? "#16a34a"
                                : status === "Non-PTA" && ptaStatus === status
                                ? "#dc2626"
                                : "#334155",
                          }}
                        >
                          <input
                            type="radio"
                            name="pta-status"
                            value={status}
                            checked={ptaStatus === status}
                            onChange={() => setPtaStatus(status)}
                            style={{ cursor: "pointer", accentColor: "#79556f" }}
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Warranty Type */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Warranty Type</span>
                  <div className="odoo-prod-control">
                    <select
                      className="odoo-prod-select"
                      value={warrantyType}
                      onChange={(e) => setWarrantyType(e.target.value as WarrantyType)}
                    >
                      <option value="Company">Company Warranty</option>
                      <option value="Shop">Shop Warranty</option>
                      <option value="No Warranty">No Warranty</option>
                    </select>
                  </div>
                </div>

                {/* Battery Health (shown for Used Phone) */}
                {shopType === "Used Phone" && (
                  <div className="odoo-prod-row">
                    <span className="odoo-prod-label">Battery Health</span>
                    <div className="odoo-prod-control">
                      <div className="odoo-prod-price-wrap" style={{ maxWidth: "160px" }}>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="odoo-prod-input odoo-prod-price-input"
                          placeholder="e.g. 88"
                          value={batteryHealth}
                          onChange={(e) => setBatteryHealth(e.target.value)}
                        />
                        <span className="odoo-prod-price-suffix">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Is IMEI Product */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Is IMEI Product</span>
                  <div className="odoo-prod-control">
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="is-imei-product"
                          value="Yes"
                          checked={isImeiProduct === "Yes"}
                          onChange={() => setIsImeiProduct("Yes")}
                          style={{ cursor: "pointer", accentColor: "#79556f" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: isImeiProduct === "Yes" ? 600 : 400 }}>
                          Yes (IMEI-wise Device Tracking)
                        </span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="is-imei-product"
                          value="No"
                          checked={isImeiProduct === "No"}
                          onChange={() => setIsImeiProduct("No")}
                          style={{ cursor: "pointer", accentColor: "#79556f" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: isImeiProduct === "No" ? 600 : 400 }}>
                          No (Normal Stock Tracking)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── IMEI Device Registration Section (Conditional: Is IMEI Product = Yes) ── */}
            {isImeiTrackingEnabled && (
              <div
                style={{
                  margin: "10px 0 16px 0",
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                      Device IMEI Registration
                    </span>
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#79556f",
                        background: "#f3e8ff",
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      Available Stock: {calculatedStock} {calculatedStock === 1 ? "device" : "devices"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddImeiRow}
                    style={{
                      background: "#79556f",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={13} /> Add Another Device
                  </button>
                </div>

                {errors.duplicate_imei && (
                  <div
                    style={{
                      padding: "8px 12px",
                      marginBottom: "10px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      color: "#b91c1c",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <AlertCircle size={14} />
                    {errors.duplicate_imei}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {imeiList.map((device, index) => (
                    <div
                      key={device.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "#ffffff",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#64748b",
                          width: "60px",
                          flexShrink: 0,
                        }}
                      >
                        Device #{index + 1}
                      </span>

                      {/* IMEI 1 (Required) */}
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          className={`odoo-prod-input ${errors[`imei_${index}_imei1`] ? "error" : ""}`}
                          placeholder="IMEI 1 (Required, 15 digits)*"
                          value={device.imei1}
                          maxLength={16}
                          onChange={(e) => handleImeiChange(index, "imei1", e.target.value)}
                        />
                        {errors[`imei_${index}_imei1`] && (
                          <span style={{ fontSize: "11px", color: "#dc2626", marginTop: "2px", display: "block" }}>
                            {errors[`imei_${index}_imei1`]}
                          </span>
                        )}
                      </div>

                      {/* IMEI 2 (Optional) */}
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          className={`odoo-prod-input ${errors[`imei_${index}_imei2`] ? "error" : ""}`}
                          placeholder="IMEI 2 (Optional)"
                          value={device.imei2}
                          maxLength={16}
                          onChange={(e) => handleImeiChange(index, "imei2", e.target.value)}
                        />
                        {errors[`imei_${index}_imei2`] && (
                          <span style={{ fontSize: "11px", color: "#dc2626", marginTop: "2px", display: "block" }}>
                            {errors[`imei_${index}_imei2`]}
                          </span>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImeiRow(index)}
                        title="Remove device"
                        style={{
                          background: "#fee2e2",
                          color: "#b91c1c",
                          border: "none",
                          borderRadius: "4px",
                          width: "28px",
                          height: "28px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "10px", fontSize: "11.5px", color: "#64748b" }}>
                  💡 Each registered device contributes 1 unit to available stock. Manual quantity adjustment is disabled for IMEI products.
                </div>
              </div>
            )}

            {/* ── Stock Quantity Section ── */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Stock Quantity</span>
              <div className="odoo-prod-control">
                {isImeiTrackingEnabled ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="text"
                      className="odoo-prod-input"
                      style={{ maxWidth: "120px", background: "#f1f5f9", cursor: "not-allowed", fontWeight: 700 }}
                      value={calculatedStock}
                      disabled
                      readOnly
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#059669",
                        background: "#ecfdf5",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      ✓ Auto-calculated from IMEI records
                    </span>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    className="odoo-prod-input"
                    style={{ maxWidth: "160px" }}
                    value={manualStock}
                    onChange={(e) => setManualStock(parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                )}
              </div>
            </div>

            {/* Purchase Price (Cost) */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Purchase Price</span>
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

            {/* Sale Price */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">Sale Price</span>
              <div className="odoo-prod-control" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="odoo-prod-price-wrap">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`odoo-prod-input odoo-prod-price-input ${errors.salesPrice ? "error" : ""}`}
                    value={salesPrice}
                    onChange={(e) => setSalesPrice(e.target.value)}
                  />
                  <span className="odoo-prod-price-suffix">Rs</span>
                </div>
                {errors.salesPrice && <span className="odoo-prod-err">{errors.salesPrice}</span>}
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
                  <option value="">No Tax (0%)</option>
                  {TAX_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
                    <div className="odoo-prod-color-palette" onClick={(e) => e.stopPropagation()}>
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
                <img src={imageDataUrl} alt="Product preview" className="odoo-prod-photo-preview" />
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
