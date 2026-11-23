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

export interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  productToEdit?: Product | null;
}

export function ProductForm({ open, onOpenChange, onSaved, productToEdit }: ProductFormProps) {
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

  // Mobile Retail Enhancement Fields
  const [shopType, setShopType] = useState<ShopType>("New Phone");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [ptaStatus, setPtaStatus] = useState<PtaStatus>("Approved");
  const [warrantyType, setWarrantyType] = useState<WarrantyType>("Company");
  const [isImeiProduct, setIsImeiProduct] = useState<"Yes" | "No">("Yes");

  // IMEI Device Rows (each row = 1 physical device)
  const [imeiList, setImeiList] = useState<DeviceImeiRow[]>([
    { id: crypto.randomUUID(), imei1: "", imei2: "" },
  ]);

  // Add new category inline state
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load existing product or reset
  useEffect(() => {
    if (!open) return;

    if (productToEdit) {
      setName(productToEdit.name || "");
      setBarcode(productToEdit.barcode || "");
      setSalesPrice(productToEdit.sellingPrice?.toString() || "0.00");
      setCostPrice((productToEdit.costPrice || 0).toString());
      setTrackInventory(productToEdit.metadata?.trackInventory !== false);
      setSelectedTax((productToEdit.metadata?.tax as string) || "");
      setColor((productToEdit.metadata?.color as string) || "#ffffff");
      setImageDataUrl(productToEdit.images?.[0] || null);
      setIsNameManuallyEdited(true);

      // Resolve category
      if (productToEdit.categoryId) {
        const found = categories.find((c) => c.id === productToEdit.categoryId);
        setPosCategory(found ? found.name : productToEdit.categoryId);
      } else {
        setPosCategory("");
      }

      // Load mobile details
      const tenantId = getCurrentTenantId();
      void (async () => {
        try {
          const mobile = await mobileProductRepo.findMobileDetails(tenantId, productToEdit.id);
          const metaMobile = productToEdit.metadata?.mobileDetails as any;
          const src = mobile || metaMobile;

          if (src) {
            setShopType(src.shopType || "Accessories");
            setBrand(src.brand || "");
            setModel(src.model || "");
            setRam(src.ram || "");
            setStorage(src.storage || "");
            setPtaStatus(src.ptaStatus || "Approved");
            setWarrantyType(src.warrantyType || "Company");
            setIsImeiProduct(src.isImeiProduct ? "Yes" : "No");
          } else {
            // Default existing retail products to Accessories
            setShopType("Accessories");
            setIsImeiProduct("No");
          }

          // Load registered IMEIs
          const imeis = await mobileProductRepo.findImeis(tenantId, productToEdit.id);
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
        } catch (e) {
          console.warn("Could not load mobile details for editing:", e);
        }
      })();
    } else {
      resetForm();
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }

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
    setShopType("New Phone");
    setBrand("");
    setModel("");
    setRam("");
    setStorage("");
    setPtaStatus("Approved");
    setWarrantyType("Company");
    setIsImeiProduct("Yes");
    setImeiList([{ id: crypto.randomUUID(), imei1: "", imei2: "" }]);
    setErrors({});
    setShowNewCatInput(false);
    setNewCatName("");
    setIsNameManuallyEdited(false);
  };

  // Auto-suggest product name based on brand, model, and storage if not manually entered
  const autoSuggestName = (newBrand: string, newModel: string, newStorage: string) => {
    if (isNameManuallyEdited && name.trim().length > 0) return;
    const parts = [newBrand.trim(), newModel.trim()].filter(Boolean);
    if (parts.length > 0) {
      const generated = `${parts.join(" ")}${newStorage.trim() ? ` (${newStorage.trim()})` : ""}`;
      setName(generated);
    }
  };

  const handleBrandChange = (val: string) => {
    setBrand(val);
    autoSuggestName(val, model, storage);
  };

  const handleModelChange = (val: string) => {
    setModel(val);
    autoSuggestName(brand, val, storage);
  };

  const handleStorageChange = (val: string) => {
    setStorage(val);
    autoSuggestName(brand, model, val);
  };

  const handleShopTypeChange = (newType: ShopType) => {
    setShopType(newType);
    if (newType === "Accessories") {
      setIsImeiProduct("No");
    } else {
      setIsImeiProduct("Yes");
    }
    setErrors({});
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

  // Device IMEI manipulation
  const handleAddDevice = () => {
    setImeiList((prev) => [...prev, { id: crypto.randomUUID(), imei1: "", imei2: "" }]);
  };

  const handleRemoveDevice = (index: number) => {
    setImeiList((prev) => prev.filter((_, i) => i !== index));
    // Clear any errors for that index
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`imei1_${index}`];
      delete next[`imei2_${index}`];
      return next;
    });
  };

  const handleImeiChange = (index: number, field: "imei1" | "imei2", value: string) => {
    const cleanValue = value.replace(/\s+/g, ""); // strip spaces
    setImeiList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: cleanValue };
      return copy;
    });

    // Clear field-specific error
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${field}_${index}`];
      delete next.imeiGeneral;
      return next;
    });
  };

  // Calculated stock from registered IMEIs
  const validImeiDevices = imeiList.filter((d) => d.imei1.trim().length > 0);
  const calculatedStock = validImeiDevices.length;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = "Product name is required";
    const priceNum = parseFloat(salesPrice);
    if (isNaN(priceNum) || priceNum < 0) errs.salesPrice = "Valid sales price is required";

    // Mobile-specific validation
    const isPhone = shopType === "New Phone" || shopType === "Used Phone";
    if (isPhone && isImeiProduct === "Yes") {
      // Rule 1: IMEI 1 required during device registration
      if (imeiList.length === 0) {
        errs.imeiGeneral = "At least one device IMEI must be registered";
      }

      const seenImeis = new Set<string>();

      imeiList.forEach((device, index) => {
        const imei1 = device.imei1.trim();
        const imei2 = device.imei2.trim();

        if (!imei1) {
          errs[`imei1_${index}`] = `IMEI 1 is required for Device #${index + 1}`;
        } else {
          // Rule 2: Prevent duplicate IMEIs within the form
          if (seenImeis.has(imei1)) {
            errs[`imei1_${index}`] = `Duplicate IMEI 1 (${imei1}) already used in another device`;
          } else {
            seenImeis.add(imei1);
          }
        }

        if (imei2) {
          if (imei2 === imei1) {
            errs[`imei2_${index}`] = "IMEI 2 cannot be identical to IMEI 1";
          } else if (seenImeis.has(imei2)) {
            errs[`imei2_${index}`] = `Duplicate IMEI 2 (${imei2}) already used`;
          } else {
            seenImeis.add(imei2);
          }
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
      const isPhone = shopType === "New Phone" || shopType === "Used Phone";
      const isImeiTracking = isPhone && isImeiProduct === "Yes";

      // 1. Duplicate IMEI Check against Database
      if (isImeiTracking) {
        const allImeis = validImeiDevices.flatMap((d) => [d.imei1.trim(), d.imei2.trim()].filter(Boolean));
        const dupCheck = await mobileProductRepo.checkDuplicateImeis(
          tenantId,
          allImeis,
          productToEdit?.id
        );

        if (dupCheck.isDuplicate) {
          setErrors({
            imeiGeneral: `IMEI ${dupCheck.duplicateImei} is already registered in the system (Product: ${dupCheck.existingProductName || "existing device"}). Duplicate IMEIs are not allowed.`,
          });
          return false;
        }
      }

      // Resolve category ID
      let categoryIdToSave: string | undefined = undefined;
      if (posCategory && posCategory !== "") {
        const found = categories.find(
          (c) => c.name.toLowerCase() === posCategory.toLowerCase() || c.id === posCategory
        );
        categoryIdToSave = found ? found.id : posCategory;
      }

      // Stock calculation rule:
      // - For IMEI-tracked products: stock = calculated available stock from registered IMEI records
      // - For non-IMEI products: quantity-based inventory tracking (preserved)
      const stockToSave = isImeiTracking
        ? calculatedStock
        : trackInventory
        ? productToEdit
          ? productToEdit.stock
          : 10
        : 0;

      const mobileMetadata = isPhone
        ? {
            shopType,
            brand: brand.trim() || undefined,
            model: model.trim() || undefined,
            ram: ram.trim() || undefined,
            storage: storage.trim() || undefined,
            ptaStatus,
            warrantyType,
            isImeiProduct: isImeiProduct === "Yes",
            imeiCount: calculatedStock,
          }
        : {
            shopType: "Accessories",
            isImeiProduct: false,
          };

      const now = Date.now();
      const productId = productToEdit ? productToEdit.id : crypto.randomUUID();

      const productPayload: Product = {
        id: productId,
        tenantId,
        sku: productToEdit ? productToEdit.sku : sku,
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        categoryId: categoryIdToSave,
        sellingPrice: price,
        costPrice: cost,
        stock: stockToSave,
        minimumStock: trackInventory ? (isImeiTracking ? 1 : 2) : 0,
        status: productToEdit ? productToEdit.status : "active",
        images: imageDataUrl ? [imageDataUrl] : undefined,
        metadata: {
          color: color || undefined,
          tax: selectedTax || undefined,
          trackInventory: isImeiTracking ? true : trackInventory,
          mobileDetails: mobileMetadata,
        },
        createdAt: productToEdit ? productToEdit.createdAt : now,
        updatedAt: now,
      };

      // Save / Update Product
      if (productToEdit) {
        await updateProduct.mutateAsync(productPayload);
      } else {
        await createProduct.mutateAsync(productPayload);
      }

      // Save Mobile-Specific Details Table Record
      if (isPhone) {
        await mobileProductRepo.saveMobileDetails({
          id: crypto.randomUUID(),
          productId,
          tenantId,
          shopType,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          ram: ram.trim() || undefined,
          storage: storage.trim() || undefined,
          ptaStatus,
          warrantyType,
          isImeiProduct: isImeiProduct === "Yes",
          createdAt: productToEdit ? productToEdit.createdAt : now,
          updatedAt: now,
        });

        // Save IMEIs to relational table
        if (isImeiTracking) {
          await mobileProductRepo.saveImeis(
            tenantId,
            productId,
            validImeiDevices.map((d) => ({
              id: d.id,
              imei1: d.imei1.trim(),
              imei2: d.imei2.trim() || undefined,
              status: "available",
            }))
          );
        }
      } else {
        // Save Accessories details
        await mobileProductRepo.saveMobileDetails({
          id: crypto.randomUUID(),
          productId,
          tenantId,
          shopType: "Accessories",
          isImeiProduct: false,
          createdAt: productToEdit ? productToEdit.createdAt : now,
          updatedAt: now,
        });
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

  const isPhoneType = shopType === "New Phone" || shopType === "Used Phone";
  const isImeiTrackingEnabled = isPhoneType && isImeiProduct === "Yes";

  if (!open) return null;

  const modal = (
    <div
      className="odoo-prod-overlay"
      onClick={(e) => e.target === e.currentTarget && handleDiscard()}
    >
      <div className="odoo-prod-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="odoo-prod-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="odoo-prod-title">
              {productToEdit ? "Edit Product" : "New Product"}
            </span>
            {isPhoneType && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  backgroundColor: shopType === "New Phone" ? "#eff6ff" : "#fef3c7",
                  color: shopType === "New Phone" ? "#1d4ed8" : "#b45309",
                  border: `1px solid ${shopType === "New Phone" ? "#bfdbfe" : "#fde68a"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Smartphone size={12} />
                {shopType}
              </span>
            )}
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
                  placeholder={isPhoneType ? "e.g. Apple iPhone 15 Pro Max (256GB)" : "e.g. Fast Charger 65W"}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setIsNameManuallyEdited(true);
                  }}
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

            {/* ── Shop Type ──────────────────────────────────────────────── */}
            <div className="odoo-prod-row">
              <span className="odoo-prod-label">
                Shop Type <span className="odoo-prod-help" title="Select whether this is a Mobile Phone or Accessory">?</span>
              </span>
              <div className="odoo-prod-control">
                <select
                  className="odoo-prod-select"
                  value={shopType}
                  onChange={(e) => handleShopTypeChange(e.target.value as ShopType)}
                >
                  <option value="New Phone">New Phone</option>
                  <option value="Used Phone">Used Phone</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>
            </div>

            {/* ── Mobile-Specific Fields (Conditional: Only for New/Used Phone) ── */}
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

                {/* Model */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Model</span>
                  <div className="odoo-prod-control">
                    <input
                      type="text"
                      className="odoo-prod-input"
                      placeholder="e.g. iPhone 15 Pro Max, Galaxy S24 Ultra"
                      value={model}
                      onChange={(e) => handleModelChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* RAM & Storage */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">RAM</span>
                  <div className="odoo-prod-control">
                    <input
                      list="genx-ram-list"
                      type="text"
                      className="odoo-prod-input"
                      placeholder="e.g. 8 GB"
                      value={ram}
                      onChange={(e) => setRam(e.target.value)}
                    />
                    <datalist id="genx-ram-list">
                      {COMMON_RAMS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">Storage</span>
                  <div className="odoo-prod-control">
                    <input
                      list="genx-storage-list"
                      type="text"
                      className="odoo-prod-input"
                      placeholder="e.g. 256 GB"
                      value={storage}
                      onChange={(e) => handleStorageChange(e.target.value)}
                    />
                    <datalist id="genx-storage-list">
                      {COMMON_STORAGES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* PTA Status */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">
                    PTA Status <span className="odoo-prod-help" title="Pakistan Telecommunication Authority compliance status">?</span>
                  </span>
                  <div className="odoo-prod-control">
                    <select
                      className="odoo-prod-select"
                      value={ptaStatus}
                      onChange={(e) => setPtaStatus(e.target.value as PtaStatus)}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Non-PTA">Non-PTA</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                {/* Warranty Type */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">
                    Warranty Type <span className="odoo-prod-help" title="Warranty provider coverage">?</span>
                  </span>
                  <div className="odoo-prod-control">
                    <select
                      className="odoo-prod-select"
                      value={warrantyType}
                      onChange={(e) => setWarrantyType(e.target.value as WarrantyType)}
                    >
                      <option value="Company">Company</option>
                      <option value="Shop">Shop</option>
                      <option value="No Warranty">No Warranty</option>
                    </select>
                  </div>
                </div>

                {/* Is IMEI Product */}
                <div className="odoo-prod-row">
                  <span className="odoo-prod-label">
                    Is IMEI Product <span className="odoo-prod-help" title="Track stock device-by-device via unique IMEIs">?</span>
                  </span>
                  <div className="odoo-prod-control">
                    <select
                      className="odoo-prod-select"
                      value={isImeiProduct}
                      onChange={(e) => setIsImeiProduct(e.target.value as "Yes" | "No")}
                    >
                      <option value="Yes">Yes (IMEI-wise Tracking)</option>
                      <option value="No">No (Quantity-based)</option>
                    </select>
                  </div>
                </div>

                {/* ── IMEI Device Registration Section (Conditional: Is IMEI Product = Yes) ── */}
                {isImeiTrackingEnabled && (
                  <div className="odoo-prod-imei-section">
                    <div className="odoo-prod-imei-header">
                      <div className="odoo-prod-imei-title-row">
                        <span className="odoo-prod-imei-title">
                          <Smartphone size={14} color="#79556f" />
                          Registered Device IMEIs
                        </span>
                        <span className="odoo-prod-imei-badge">
                          Stock: {calculatedStock} {calculatedStock === 1 ? "device" : "devices"}
                        </span>
                      </div>
                      <span className="odoo-prod-imei-subtitle">
                        Each IMEI represents one physical device. IMEI 1 is required during registration. Stock is calculated from registered devices.
                      </span>
                    </div>

                    {errors.imeiGeneral && (
                      <div
                        style={{
                          margin: "6px 0",
                          padding: "6px 10px",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "4px",
                          color: "#ef4444",
                          fontSize: "12px",
                        }}
                      >
                        {errors.imeiGeneral}
                      </div>
                    )}

                    <div className="odoo-prod-imei-list">
                      {imeiList.map((device, index) => (
                        <div key={device.id} className="odoo-prod-imei-row">
                          <span className="odoo-prod-imei-device-num">#{index + 1}</span>
                          <div className="odoo-prod-imei-inputs">
                            <div className="odoo-prod-imei-input-wrap">
                              <input
                                type="text"
                                placeholder="IMEI 1 (Required) *"
                                maxLength={20}
                                className={errors[`imei1_${index}`] ? "error" : ""}
                                value={device.imei1}
                                onChange={(e) => handleImeiChange(index, "imei1", e.target.value)}
                              />
                              {errors[`imei1_${index}`] && (
                                <span className="odoo-prod-err">{errors[`imei1_${index}`]}</span>
                              )}
                            </div>
                            <div className="odoo-prod-imei-input-wrap">
                              <input
                                type="text"
                                placeholder="IMEI 2 (Optional)"
                                maxLength={20}
                                className={errors[`imei2_${index}`] ? "error" : ""}
                                value={device.imei2}
                                onChange={(e) => handleImeiChange(index, "imei2", e.target.value)}
                              />
                              {errors[`imei2_${index}`] && (
                                <span className="odoo-prod-err">{errors[`imei2_${index}`]}</span>
                              )}
                            </div>
                          </div>
                          {imeiList.length > 1 && (
                            <button
                              type="button"
                              className="odoo-prod-imei-remove-btn"
                              onClick={() => handleRemoveDevice(index)}
                              title="Remove physical device"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="odoo-prod-imei-actions">
                      <button
                        type="button"
                        className="odoo-prod-imei-add-btn"
                        onClick={handleAddDevice}
                      >
                        <Plus size={13} /> Add Physical Device (IMEI)
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Inventory Stock Control ─────────────────────────────────── */}
            {isImeiTrackingEnabled ? (
              /* IMEI-Tracked Stock (Calculated automatically, manual changes disabled) */
              <div className="odoo-prod-row">
                <span className="odoo-prod-label">
                  Available Stock <span className="odoo-prod-help" title="Stock is strictly calculated from registered device IMEIs">?</span>
                </span>
                <div className="odoo-prod-control">
                  <div className="odoo-prod-calculated-stock-badge">
                    <Check size={14} />
                    <span>
                      {calculatedStock} {calculatedStock === 1 ? "device" : "devices"} available (Calculated from IMEIs)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Normal Quantity-Based Inventory Tracking (Preserved for Accessories and Non-IMEI products) */
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
            )}

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

            {/* Cost Price */}
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

            {/* POS Category */}
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
          {productToEdit ? (
            <>
              <button
                type="button"
                className="odoo-prod-btn-primary"
                onClick={handleAddAndClose}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="odoo-prod-btn-discard"
                onClick={handleDiscard}
                disabled={saving}
              >
                Discard
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
