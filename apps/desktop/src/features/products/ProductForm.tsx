"use client";

import React from "react";
import { Product } from "@/lib/db";
import { isRetailOrMobileBusiness } from "@/lib/businessModelDetection";
import { NewProductForm } from "./NewProductForm";
import { OldProductForm } from "./OldProductForm";

export interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  productToEdit?: Product | null;
  businessType?: string | null;
}

/**
 * Master Inventory Product Form
 *
 * Requirements:
 * IF Business Model = "Retail Store" OR "Mobile Shops":
 *   -> Render NEW Inventory Form
 * IF Business Model = ANY OTHER [Auto Store, AromaBlaze, Grocery, Pharmacy, etc.]:
 *   -> Render OLD Inventory Form ONLY
 *
 * - ONE Inventory Page, ONE New Product Button.
 * - On New Product click, checks current Business Model from session / shop_type / business_model_id / route.
 * - Based on that, conditionally renders NEW Form OR OLD Form.
 * - UI Design, Layout, Style remains SAME as existing system for both forms.
 */
export function ProductForm({
  open,
  onOpenChange,
  onSaved,
  productToEdit,
  businessType,
}: ProductFormProps) {
  const isRetailOrMobile = isRetailOrMobileBusiness(businessType);

  if (isRetailOrMobile) {
    return (
      <NewProductForm
        open={open}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        productToEdit={productToEdit}
      />
    );
  }

  return (
    <OldProductForm
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      productToEdit={productToEdit}
    />
  );
}

export { NewProductForm } from "./NewProductForm";
export { OldProductForm } from "./OldProductForm";
export default ProductForm;
