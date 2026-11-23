import { describe, it, expect, beforeEach } from 'vitest';
import { mobileProductRepo, productRepo } from '../../apps/desktop/src/lib/db';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';
import { ProductMobileDetails } from '../../packages/types/src/domain/product';

describe('GENX CLOUD Phase 1: Mobile Inventory Enhancement', () => {
  const tenantId = 'tenant-test-mobile';

  beforeEach(() => {
    setupTauriBrowserMock();
  });

  it('1. Correctly saves and loads mobile-specific fields linked to product', async () => {
    const productId = 'prod-iphone-15';
    
    // Save base product
    await productRepo.create({
      id: productId,
      tenantId,
      sku: 'IPHONE-15-PRO',
      name: 'Apple iPhone 15 Pro (256GB)',
      costPrice: 280000,
      sellingPrice: 320000,
      stock: 2, // 2 physical devices registered
      minimumStock: 1,
      status: 'active',
      metadata: {
        mobileDetails: {
          shopType: 'New Phone',
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          ram: '8 GB',
          storage: '256 GB',
          ptaStatus: 'Approved',
          warrantyType: 'Company',
          isImeiProduct: true,
          imeiCount: 2,
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Save mobile-specific relational table details
    const mobileDetails: ProductMobileDetails = {
      id: 'mob-detail-1',
      productId,
      tenantId,
      shopType: 'New Phone',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      ram: '8 GB',
      storage: '256 GB',
      ptaStatus: 'Approved',
      warrantyType: 'Company',
      isImeiProduct: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await mobileProductRepo.saveMobileDetails(mobileDetails);

    // Verify loading mobile details
    const loaded = await mobileProductRepo.findMobileDetails(tenantId, productId);
    expect(loaded).toBeDefined();
    expect(loaded?.shopType).toBe('New Phone');
    expect(loaded?.brand).toBe('Apple');
    expect(loaded?.model).toBe('iPhone 15 Pro');
    expect(loaded?.ram).toBe('8 GB');
    expect(loaded?.storage).toBe('256 GB');
    expect(loaded?.ptaStatus).toBe('Approved');
    expect(loaded?.warrantyType).toBe('Company');
    expect(loaded?.isImeiProduct).toBe(true);
  });

  it('2. Enforces IMEI Rules: IMEI 1 required, IMEI 2 optional, calculates stock', async () => {
    const productId = 'prod-s24-ultra';

    const devices = [
      { id: 'imei-dev-1', imei1: '358912345678901', imei2: '358912345678902', status: 'available' as const },
      { id: 'imei-dev-2', imei1: '358912345678903', imei2: undefined, status: 'available' as const }, // IMEI 2 optional
      { id: 'imei-dev-3', imei1: '358912345678904', imei2: '358912345678905', status: 'available' as const },
    ];

    await mobileProductRepo.saveImeis(tenantId, productId, devices);

    // Verify stored devices
    const storedImeis = await mobileProductRepo.findImeis(tenantId, productId);
    expect(storedImeis).toHaveLength(3);
    expect(storedImeis[0].imei1).toBe('358912345678901');
    expect(storedImeis[0].imei2).toBe('358912345678902');
    expect(storedImeis[1].imei1).toBe('358912345678903');
    expect(storedImeis[1].imei2).toBeUndefined();

    // Verify available stock calculation
    const stockCount = await mobileProductRepo.countAvailableImeis(tenantId, productId);
    expect(stockCount).toBe(3);
  });

  it('3. Prevents duplicate IMEI registration', async () => {
    const existingProductId = 'prod-pixel-8';
    await mobileProductRepo.saveImeis(tenantId, existingProductId, [
      { imei1: '864209876543210', imei2: '864209876543211', status: 'available' },
    ]);

    // Check duplicate detection
    const dupCheck1 = await mobileProductRepo.checkDuplicateImeis(tenantId, ['864209876543210']);
    expect(dupCheck1.isDuplicate).toBe(true);
    expect(dupCheck1.duplicateImei).toBe('864209876543210');

    // Check duplicate on IMEI 2 as well
    const dupCheck2 = await mobileProductRepo.checkDuplicateImeis(tenantId, ['864209876543211']);
    expect(dupCheck2.isDuplicate).toBe(true);
    expect(dupCheck2.duplicateImei).toBe('864209876543211');

    // Check clean IMEI (no duplicate)
    const cleanCheck = await mobileProductRepo.checkDuplicateImeis(tenantId, ['999999999999999']);
    expect(cleanCheck.isDuplicate).toBe(false);

    // Exclude current product when editing
    const selfCheck = await mobileProductRepo.checkDuplicateImeis(tenantId, ['864209876543210'], existingProductId);
    expect(selfCheck.isDuplicate).toBe(false);
  });

  it('4. Preserves normal inventory tracking for Accessories and non-mobile products', async () => {
    const accessoryId = 'prod-fast-charger';

    await productRepo.create({
      id: accessoryId,
      tenantId,
      sku: 'CHARGER-65W',
      name: 'Fast Charger 65W GaN',
      costPrice: 2500,
      sellingPrice: 3800,
      stock: 50,
      minimumStock: 10,
      status: 'active',
      metadata: {
        mobileDetails: {
          shopType: 'Accessories',
          isImeiProduct: false,
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const loaded = await productRepo.findById(tenantId, accessoryId);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Fast Charger 65W GaN');
    expect(loaded?.stock).toBe(50);
    expect(loaded?.metadata?.mobileDetails).toEqual({
      shopType: 'Accessories',
      isImeiProduct: false,
    });

    // Accessories have no IMEIs
    const imeis = await mobileProductRepo.findImeis(tenantId, accessoryId);
    expect(imeis).toHaveLength(0);
  });

  it('5. Supports Used Phone classification with warranty & PTA status', async () => {
    const usedPhoneId = 'prod-used-s22';

    await mobileProductRepo.saveMobileDetails({
      id: 'mob-used-1',
      productId: usedPhoneId,
      tenantId,
      shopType: 'Used Phone',
      brand: 'Samsung',
      model: 'Galaxy S22',
      ram: '8 GB',
      storage: '128 GB',
      ptaStatus: 'Non-PTA',
      warrantyType: 'Shop',
      isImeiProduct: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const loaded = await mobileProductRepo.findMobileDetails(tenantId, usedPhoneId);
    expect(loaded?.shopType).toBe('Used Phone');
    expect(loaded?.ptaStatus).toBe('Non-PTA');
    expect(loaded?.warrantyType).toBe('Shop');
  });
});
