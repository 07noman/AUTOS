export type ShopType = 'New Phone' | 'Used Phone' | 'Accessories';
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
  ram?: string;
  storage?: string;
  ptaStatus?: PtaStatus;
  warrantyType?: WarrantyType;
  isImeiProduct: boolean;
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
