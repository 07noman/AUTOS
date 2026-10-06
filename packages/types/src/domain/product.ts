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
