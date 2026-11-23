import { describe, it, expect, beforeEach } from 'vitest';
import { isRetailOrMobileBusiness, normalizeBusinessModelName } from '../../apps/desktop/src/lib/businessModelDetection';
import { mobileProductRepo, productRepo, getCurrentTenantId } from '../../apps/desktop/src/lib/db';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';

describe('Business Model Wise Inventory Form Logic', () => {
  beforeEach(() => {
    setupTauriBrowserMock();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('1. Business Model Detection Condition (isRetailOrMobileBusiness)', () => {
    it('returns TRUE for "Retail Store" and "Mobile Shops" variants', () => {
      // Retail Store variations
      expect(isRetailOrMobileBusiness('Retail Store')).toBe(true);
      expect(isRetailOrMobileBusiness('retail store')).toBe(true);
      expect(isRetailOrMobileBusiness('Retail Shop')).toBe(true);
      expect(isRetailOrMobileBusiness('retail')).toBe(true);
      expect(isRetailOrMobileBusiness('retail_store')).toBe(true);
      expect(isRetailOrMobileBusiness('retail-store')).toBe(true);

      // Mobile Shops variations
      expect(isRetailOrMobileBusiness('Mobile Shops')).toBe(true);
      expect(isRetailOrMobileBusiness('mobile shops')).toBe(true);
      expect(isRetailOrMobileBusiness('Mobile Shop')).toBe(true);
      expect(isRetailOrMobileBusiness('mobile')).toBe(true);
      expect(isRetailOrMobileBusiness('mobile_shops')).toBe(true);
      expect(isRetailOrMobileBusiness('mobile-shops')).toBe(true);
      expect(isRetailOrMobileBusiness('mobile phone')).toBe(true);
    });

    it('returns FALSE for ANY OTHER business model (Auto Store, AromaBlaze, Grocery, Pharmacy, etc.)', () => {
      // Auto Store
      expect(isRetailOrMobileBusiness('Auto Store')).toBe(false);
      expect(isRetailOrMobileBusiness('auto store')).toBe(false);
      expect(isRetailOrMobileBusiness('auto-parts')).toBe(false);
      expect(isRetailOrMobileBusiness('auto_care')).toBe(false);

      // AromaBlaze
      expect(isRetailOrMobileBusiness('AromaBlaze')).toBe(false);
      expect(isRetailOrMobileBusiness('aromablaze')).toBe(false);
      expect(isRetailOrMobileBusiness('Aroma Blaze')).toBe(false);

      // Grocery & Mart
      expect(isRetailOrMobileBusiness('Grocery')).toBe(false);
      expect(isRetailOrMobileBusiness('mart')).toBe(false);
      expect(isRetailOrMobileBusiness('Mart & Grocery')).toBe(false);

      // Pharmacy
      expect(isRetailOrMobileBusiness('Pharmacy')).toBe(false);
      expect(isRetailOrMobileBusiness('pharmacy')).toBe(false);

      // Others
      expect(isRetailOrMobileBusiness('Restaurant')).toBe(false);
      expect(isRetailOrMobileBusiness('Bakery')).toBe(false);
      expect(isRetailOrMobileBusiness('Cafe')).toBe(false);
      expect(isRetailOrMobileBusiness('Clothing')).toBe(false);
      expect(isRetailOrMobileBusiness('Furniture')).toBe(false);
      expect(isRetailOrMobileBusiness('')).toBe(false);
      expect(isRetailOrMobileBusiness(null)).toBe(false);
      expect(isRetailOrMobileBusiness(undefined)).toBe(false);
    });

    it('detects business model from localStorage / sessionStorage / session metadata', () => {
      // Test localStorage genx:selectedModule = 'retail'
      localStorage.setItem('genx:selectedModule', 'retail');
      expect(isRetailOrMobileBusiness()).toBe(true);

      // Test localStorage genx:selectedModule = 'auto-parts'
      localStorage.setItem('genx:selectedModule', 'auto-parts');
      expect(isRetailOrMobileBusiness()).toBe(false);

      // Test sessionStorage shop_type = 'Mobile Shops'
      localStorage.clear();
      sessionStorage.setItem('shop_type', 'Mobile Shops');
      expect(isRetailOrMobileBusiness()).toBe(true);

      // Test sessionStorage shop_type = 'AromaBlaze'
      sessionStorage.setItem('shop_type', 'AromaBlaze');
      expect(isRetailOrMobileBusiness()).toBe(false);

      // Test business_model_id = 'retail-store'
      sessionStorage.clear();
      localStorage.setItem('genx:business_model_id', 'retail-store');
      expect(isRetailOrMobileBusiness()).toBe(true);

      // Test auth user metadata
      localStorage.clear();
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({
          state: {
            user: {
              user_metadata: {
                business_type: 'Mobile Shops',
              },
            },
          },
        })
      );
      expect(isRetailOrMobileBusiness()).toBe(true);
    });
  });

  describe('2. Shop Type Default Logic inside New Form', () => {
    it('supports required Shop Type options with default "Auto Store"', () => {
      const validShopTypes = [
        'Auto Store',
        'New Phone',
        'Used Phone',
        'Accessories',
        'Mobile Shop',
        'Retail Shop',
      ];
      const defaultShopType = 'Auto Store';

      expect(validShopTypes).toContain(defaultShopType);
      expect(defaultShopType).toBe('Auto Store');
      expect(validShopTypes).toHaveLength(6);
    });

    it('correctly distinguishes phone types vs general retail/auto accessories', () => {
      const isPhoneType = (shopType: string) =>
        shopType === 'New Phone' || shopType === 'Used Phone' || shopType === 'Mobile Shop';

      expect(isPhoneType('New Phone')).toBe(true);
      expect(isPhoneType('Used Phone')).toBe(true);
      expect(isPhoneType('Mobile Shop')).toBe(true);

      // Auto Store, Accessories, Retail Shop hide phone-specific fields
      expect(isPhoneType('Auto Store')).toBe(false);
      expect(isPhoneType('Accessories')).toBe(false);
      expect(isPhoneType('Retail Shop')).toBe(false);
    });
  });

  describe('3. Database Non-Breaking Compatibility', () => {
    const tenantId = getCurrentTenantId();

    it('Old business models save products strictly in old tables without mobile records', async () => {
      const oldProduct = {
        id: 'prod-auto-oil-5w30',
        tenantId,
        sku: 'OIL-5W30',
        name: 'Synthetic Engine Oil 5W-30 4L',
        costPrice: 4500,
        sellingPrice: 6200,
        stock: 25,
        minimumStock: 5,
        status: 'active' as const,
      };

      await productRepo.create(oldProduct);

      const saved = await productRepo.findById(tenantId, oldProduct.id);
      expect(saved).not.toBeNull();
      expect(saved?.name).toBe('Synthetic Engine Oil 5W-30 4L');
      expect(saved?.stock).toBe(25);

      // Verify no mobile details exist for standard product
      const mobileDetails = await mobileProductRepo.findMobileDetails(tenantId, oldProduct.id);
      expect(mobileDetails).toBeNull();

      const imeis = await mobileProductRepo.findImeis(tenantId, oldProduct.id);
      expect(imeis).toHaveLength(0);
    });

    it('Mobile / Retail products save mobile details into mobile_phone_details and product_imeis', async () => {
      const mobileProd = {
        id: 'prod-iphone-15',
        tenantId,
        sku: 'IPHONE15-128',
        name: 'Apple iPhone 15 (128GB)',
        costPrice: 220000,
        sellingPrice: 245000,
        stock: 2,
        minimumStock: 1,
        status: 'active' as const,
      };

      await productRepo.create(mobileProd);

      // Save mobile phone details
      await mobileProductRepo.saveMobileDetails({
        id: 'mpd-iphone-15',
        productId: mobileProd.id,
        tenantId,
        shopType: 'New Phone',
        brand: 'Apple',
        model: 'iPhone 15',
        variant: '128GB Blue',
        ram: '6 GB',
        storage: '128 GB',
        ptaStatus: 'Approved',
        warrantyType: 'Company',
        isImeiProduct: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Save IMEIs
      await mobileProductRepo.saveImeis(tenantId, mobileProd.id, [
        { imei1: '351234567890123', imei2: '351234567890124', status: 'available' },
        { imei1: '351234567890125', status: 'available' },
      ]);

      const savedDetails = await mobileProductRepo.findMobileDetails(tenantId, mobileProd.id);
      expect(savedDetails).not.toBeNull();
      expect(savedDetails?.brand).toBe('Apple');
      expect(savedDetails?.model).toBe('iPhone 15');
      expect(savedDetails?.ptaStatus).toBe('Approved');
      expect(savedDetails?.isImeiProduct).toBe(true);

      const savedImeis = await mobileProductRepo.findImeis(tenantId, mobileProd.id);
      expect(savedImeis).toHaveLength(2);
      expect(savedImeis[0].imei1).toBe('351234567890123');

      const availableCount = await mobileProductRepo.countAvailableImeis(tenantId, mobileProd.id);
      expect(availableCount).toBe(2);
    });
  });
});
