import { describe, it, expect } from 'vitest';
import {
  getDefaultBaseUnit,
  getAvailableUnits,
  calculateUnitPrice,
  toBaseUnits,
  formatStockWithPacking,
  hasPackingConfigured,
} from '../../apps/desktop/src/features/pharmacy/packingUtils';

describe('Pharmacy Multi-Unit & Packing Utilities (Task 2)', () => {
  describe('getDefaultBaseUnit', () => {
    it('returns correct base units by dosage form', () => {
      expect(getDefaultBaseUnit('Tablet')).toBe('Tablet');
      expect(getDefaultBaseUnit('Capsule')).toBe('Capsule');
      expect(getDefaultBaseUnit('Syrup')).toBe('Bottle');
      expect(getDefaultBaseUnit('Suspension')).toBe('Bottle');
      expect(getDefaultBaseUnit('Drops')).toBe('Bottle');
      expect(getDefaultBaseUnit('Ointment')).toBe('Tube');
      expect(getDefaultBaseUnit('Injection')).toBe('Ampoule');
      expect(getDefaultBaseUnit('Sachet')).toBe('Sachet');
      expect(getDefaultBaseUnit(undefined)).toBe('Tablet');
    });
  });

  describe('getAvailableUnits & hasPackingConfigured', () => {
    it('returns only base unit when no packing is configured (backward-compatibility)', () => {
      const med = {
        dosageForm: 'Tablet',
        baseUnit: 'Tablet',
        stripSize: undefined,
        boxSize: undefined,
      };
      expect(hasPackingConfigured(med)).toBe(false);
      const units = getAvailableUnits(med);
      expect(units).toHaveLength(1);
      expect(units[0]).toEqual({ unit: 'base', label: 'Tablet', multiplier: 1 });
    });

    it('returns Base, Strip, and Box units when full packing is configured', () => {
      const med = {
        dosageForm: 'Tablet',
        baseUnit: 'Tablet',
        stripSize: 10,
        boxSize: 10,
      };
      expect(hasPackingConfigured(med)).toBe(true);
      const units = getAvailableUnits(med);
      expect(units).toHaveLength(3);
      expect(units[0]).toEqual({ unit: 'base', label: 'Tablet', multiplier: 1 });
      expect(units[1]).toEqual({ unit: 'strip', label: 'Strip', multiplier: 10 });
      expect(units[2]).toEqual({ unit: 'box', label: 'Box', multiplier: 100 });
    });

    it('returns Base and Strip when only stripSize is configured', () => {
      const med = {
        dosageForm: 'Capsule',
        baseUnit: 'Capsule',
        stripSize: 12,
      };
      const units = getAvailableUnits(med);
      expect(units).toHaveLength(2);
      expect(units[0]).toEqual({ unit: 'base', label: 'Capsule', multiplier: 1 });
      expect(units[1]).toEqual({ unit: 'strip', label: 'Strip', multiplier: 12 });
    });

    it('returns Base and Box when only boxSize is configured (e.g. ampoules or bottles in a carton)', () => {
      const med = {
        dosageForm: 'Injection',
        baseUnit: 'Ampoule',
        boxSize: 5,
      };
      const units = getAvailableUnits(med);
      expect(units).toHaveLength(2);
      expect(units[0]).toEqual({ unit: 'base', label: 'Ampoule', multiplier: 1 });
      expect(units[1]).toEqual({ unit: 'box', label: 'Box', multiplier: 5 });
    });
  });

  describe('calculateUnitPrice', () => {
    const basePrice = 20; // 1 Tablet = Rs. 20
    const stripSize = 10; // 1 Strip = 10 Tablets
    const boxSize = 10;   // 1 Box = 10 Strips

    it('calculates Base Price correctly', () => {
      expect(calculateUnitPrice(basePrice, 'base', stripSize, boxSize)).toBe(20);
    });

    it('calculates Strip Price = Base Price * Strip Size (20 * 10 = 200)', () => {
      expect(calculateUnitPrice(basePrice, 'strip', stripSize, boxSize)).toBe(200);
    });

    it('calculates Box Price = Strip Price * Box Size (200 * 10 = 2000)', () => {
      expect(calculateUnitPrice(basePrice, 'box', stripSize, boxSize)).toBe(2000);
    });
  });

  describe('toBaseUnits (Stock Deduction Conversion)', () => {
    const stripSize = 10;
    const boxSize = 10;

    it('converts 2 Tablets to 2 Base Units', () => {
      expect(toBaseUnits(2, 'base', stripSize, boxSize)).toBe(2);
    });

    it('converts 1 Strip to 10 Base Units (never 1!)', () => {
      expect(toBaseUnits(1, 'strip', stripSize, boxSize)).toBe(10);
    });

    it('converts 3 Strips to 30 Base Units', () => {
      expect(toBaseUnits(3, 'strip', stripSize, boxSize)).toBe(30);
    });

    it('converts 1 Box to 100 Base Units (never 1 or 10!)', () => {
      expect(toBaseUnits(1, 'box', stripSize, boxSize)).toBe(100);
    });

    it('converts 2 Boxes to 200 Base Units', () => {
      expect(toBaseUnits(2, 'box', stripSize, boxSize)).toBe(200);
    });
  });

  describe('formatStockWithPacking', () => {
    it('formats exact example: "Stock: 96 Tablets (9 Strips + 6 Tablets)"', () => {
      const med = {
        dosageForm: 'Tablet',
        baseUnit: 'Tablet',
        stripSize: 10,
        boxSize: 10,
      };
      const formatted = formatStockWithPacking(96, med);
      expect(formatted).toBe('96 Tablets (9 Strips + 6 Tablets)');
    });

    it('formats full boxes and strips correctly', () => {
      const med = {
        dosageForm: 'Tablet',
        baseUnit: 'Tablet',
        stripSize: 10,
        boxSize: 10,
      };
      // 235 tablets = 2 Boxes + 3 Strips + 5 Tablets
      expect(formatStockWithPacking(235, med)).toBe('235 Tablets (2 Boxes + 3 Strips + 5 Tablets)');
    });

    it('formats 0 stock gracefully', () => {
      const med = {
        dosageForm: 'Tablet',
        baseUnit: 'Tablet',
        stripSize: 10,
        boxSize: 10,
      };
      expect(formatStockWithPacking(0, med)).toBe('0 Tablets');
    });

    it('falls back to simple base unit string if no packing is configured', () => {
      const med = {
        dosageForm: 'Syrup',
        baseUnit: 'Bottle',
      };
      expect(formatStockWithPacking(5, med)).toBe('5 Bottles');
    });
  });

  describe('Critical Stock Deduction Integrity', () => {
    it('simulates stock deduction sequence', () => {
      let currentStock = 100; // 100 Tablets in inventory
      const stripSize = 10;
      const boxSize = 10;

      // Sale 1: Sell 1 Strip (10 Tablets)
      const sale1Deduction = toBaseUnits(1, 'strip', stripSize, boxSize);
      expect(sale1Deduction).toBe(10);
      currentStock -= sale1Deduction;
      expect(currentStock).toBe(90);

      // Sale 2: Sell 2 loose Tablets
      const sale2Deduction = toBaseUnits(2, 'base', stripSize, boxSize);
      expect(sale2Deduction).toBe(2);
      currentStock -= sale2Deduction;
      expect(currentStock).toBe(88);

      // Remaining stock formatting
      expect(
        formatStockWithPacking(currentStock, {
          dosageForm: 'Tablet',
          baseUnit: 'Tablet',
          stripSize,
          boxSize,
        })
      ).toBe('88 Tablets (8 Strips + 8 Tablets)');
    });
  });
});
