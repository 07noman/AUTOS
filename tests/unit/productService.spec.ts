import { describe, it, expect, vi } from 'vitest';
import { productService } from '../../apps/api/src/services/productService';

describe('Product Service', () => {
  it('should create product with valid data', async () => {
    const product = await productService.create({
      tenantId: 'tenant-1',
      sku: 'TEST-001',
      name: 'Test Product',
      costPrice: 10.00,
      sellingPrice: 15.00,
      stock: 100,
      minimumStock: 10,
      status: 'active',
    });

    expect(product.id).toBeDefined();
    expect(product.sku).toBe('TEST-001');
  });

  it('should update product stock', async () => {
    const updated = await productService.updateStock('tenant-1', 'product-1', -5);

    expect(updated.stock).toBeLessThan(100);
  });

  it('should return low stock products', async () => {
    const lowStock = await productService.getLowStock('tenant-1');

    expect(Array.isArray(lowStock)).toBe(true);
    lowStock.forEach(product => {
      expect(product.stock).toBeLessThanOrEqual(product.minimumStock);
    });
  });
});
