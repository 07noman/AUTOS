export type ShopType =
  | 'Auto Store'
  | 'New Phone'
  | 'Used Phone'
  | 'Accessories'
  | 'Mobile Shop'
  | 'Retail Shop';
export type PtaStatus = 'Approved' | 'Non-PTA' | 'Pending';
export type WarrantyType = 'Company' | 'Shop' | 'No Warranty';
export type ImeiStatus = 'available' | 'sold' | 'transferred' | 'returned' | 'defective';

export interface ProductMobileDetails {
  id: string;
  productId: string;
  tenantId: string;
  shopType: ShopType;
  brand?: string;
  model?: string;
  variant?: string;
  color?: string;
  ram?: string;
  storage?: string;
  ptaStatus?: PtaStatus;
  warrantyType?: WarrantyType;
  batteryHealth?: number;
  isImeiProduct: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MobileUsedPurchase {
  id: string;
  productId: string;
  tenantId: string;
  sellerName?: string;
  sellerCnic?: string;
  sellerPhone?: string;
  purchasePrice?: number;
  condition?: string;
  batteryHealth?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProductImei {
  id: string;
  productId: string;
  tenantId: string;
  imei1: string;
  imei2?: string;
  status: ImeiStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  soldAt?: number;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  barcode?: string;
  categoryId?: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  stock: number;
  minimumStock: number;
  status: 'active' | 'inactive' | 'archived';
  images?: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}
