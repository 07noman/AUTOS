/**
 * Pharmacy Multi-Unit & Packing Utilities (Tablet / Strip / Box)
 * Pure helper functions for packing calculations, unit conversions, and stock formatting.
 */

export type UnitType = 'base' | 'strip' | 'box';

export interface UnitOption {
  unit: UnitType;
  label: string;
  multiplier: number;
}

/**
 * Returns default base unit name based on dosage form
 */
export function getDefaultBaseUnit(dosageForm?: string): string {
  if (!dosageForm) return 'Tablet';
  const df = dosageForm.trim().toLowerCase();
  if (df.includes('tablet')) return 'Tablet';
  if (df.includes('capsule')) return 'Capsule';
  if (df.includes('syrup') || df.includes('suspension') || df.includes('drops')) return 'Bottle';
  if (df.includes('ointment') || df.includes('cream') || df.includes('gel')) return 'Tube';
  if (df.includes('injection')) return 'Ampoule';
  if (df.includes('sachet')) return 'Sachet';
  return 'Tablet';
}

/**
 * Checks if a medicine has multi-unit packing configured (Strip or Box)
 */
export function hasPackingConfigured(med: {
  stripSize?: number;
  boxSize?: number;
}): boolean {
  const hasStrip = typeof med.stripSize === 'number' && med.stripSize > 1;
  const hasBox = typeof med.boxSize === 'number' && med.boxSize > 1;
  return Boolean(hasStrip || hasBox);
}

/**
 * Returns available units for a medicine.
 * If medicine has no packing defined, returns ONLY base unit.
 */
export function getAvailableUnits(med: {
  dosageForm?: string;
  baseUnit?: string;
  stripSize?: number;
  boxSize?: number;
}): UnitOption[] {
  const baseLabel = med.baseUnit || getDefaultBaseUnit(med.dosageForm);
  const units: UnitOption[] = [
    { unit: 'base', label: baseLabel, multiplier: 1 },
  ];

  const stripSize =
    typeof med.stripSize === 'number' && med.stripSize > 1 ? Number(med.stripSize) : null;
  const boxSize =
    typeof med.boxSize === 'number' && med.boxSize > 1 ? Number(med.boxSize) : null;

  if (stripSize) {
    units.push({
      unit: 'strip',
      label: 'Strip',
      multiplier: stripSize,
    });
  }

  if (boxSize) {
    // 1 Box = boxSize * (stripSize || 1) base units
    const boxMultiplier = stripSize ? boxSize * stripSize : boxSize;
    units.push({
      unit: 'box',
      label: 'Box',
      multiplier: boxMultiplier,
    });
  }

  return units;
}

/**
 * Calculates selling price for a given unit based on Base Unit Price.
 * Base Price is always per Base Unit (e.g. 1 Tablet = Rs. 20)
 * Strip Price = Base Price * Strip Size (e.g. 20 * 10 = 200)
 * Box Price = Strip Price * Box Size (e.g. 200 * 10 = 2000)
 */
export function calculateUnitPrice(
  basePrice: number,
  unit: UnitType,
  stripSize?: number,
  boxSize?: number
): number {
  const safeBasePrice = Math.max(0, Number(basePrice) || 0);
  const safeStrip = typeof stripSize === 'number' && stripSize > 1 ? Number(stripSize) : null;
  const safeBox = typeof boxSize === 'number' && boxSize > 1 ? Number(boxSize) : null;

  if (unit === 'base') {
    return safeBasePrice;
  }

  if (unit === 'strip') {
    return safeStrip ? safeBasePrice * safeStrip : safeBasePrice;
  }

  if (unit === 'box') {
    if (safeStrip && safeBox) {
      const stripPrice = safeBasePrice * safeStrip;
      return stripPrice * safeBox;
    }
    if (safeBox) {
      return safeBasePrice * safeBox;
    }
    return safeBasePrice;
  }

  return safeBasePrice;
}

/**
 * Converts a quantity of a given unit to Base Units.
 * e.g. 2 Strips of 10 -> 20 Base Units
 */
export function toBaseUnits(
  qty: number,
  unit: UnitType,
  stripSize?: number,
  boxSize?: number
): number {
  const safeQty = Math.max(0, Number(qty) || 0);
  const safeStrip = typeof stripSize === 'number' && stripSize > 1 ? Number(stripSize) : null;
  const safeBox = typeof boxSize === 'number' && boxSize > 1 ? Number(boxSize) : null;

  if (unit === 'base') return safeQty;
  if (unit === 'strip') return safeStrip ? safeQty * safeStrip : safeQty;
  if (unit === 'box') {
    const boxMultiplier = safeStrip ? safeBox! * safeStrip : (safeBox || 1);
    return safeQty * boxMultiplier;
  }
  return safeQty;
}

/**
 * Formats stock display with base unit count and packing breakdown.
 * Example: Stock = 96 Tablets, Strip = 10, Box = 10 -> "96 Tablets (9 Strips + 6 Tablets)"
 */
export function formatStockWithPacking(
  stockInBaseUnits: number,
  med: {
    dosageForm?: string;
    baseUnit?: string;
    stripSize?: number;
    boxSize?: number;
  }
): string {
  const baseLabel = med.baseUnit || getDefaultBaseUnit(med.dosageForm);
  const safeStock = Math.max(0, Math.floor(Number(stockInBaseUnits) || 0));

  if (safeStock === 0) {
    return `0 ${baseLabel}s`;
  }

  const stripSize =
    typeof med.stripSize === 'number' && med.stripSize > 1 ? Number(med.stripSize) : null;
  const boxSize =
    typeof med.boxSize === 'number' && med.boxSize > 1 ? Number(med.boxSize) : null;

  // No packing defined -> standard base count
  if (!stripSize && !boxSize) {
    return `${safeStock} ${baseLabel}${safeStock > 1 ? 's' : ''}`;
  }

  // Both Box & Strip defined
  if (stripSize && boxSize) {
    const boxMultiplier = boxSize * stripSize;
    const boxes = Math.floor(safeStock / boxMultiplier);
    const remainderAfterBoxes = safeStock % boxMultiplier;
    const strips = Math.floor(remainderAfterBoxes / stripSize);
    const singles = remainderAfterBoxes % stripSize;

    const parts: string[] = [];
    if (boxes > 0) parts.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
    if (strips > 0) parts.push(`${strips} Strip${strips > 1 ? 's' : ''}`);
    if (singles > 0) parts.push(`${singles} ${baseLabel}${singles > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return `${safeStock} ${baseLabel}s`;
    }

    return `${safeStock} ${baseLabel}s (${parts.join(' + ')})`;
  }

  // Only Strip defined
  if (stripSize) {
    const strips = Math.floor(safeStock / stripSize);
    const singles = safeStock % stripSize;
    const parts: string[] = [];
    if (strips > 0) parts.push(`${strips} Strip${strips > 1 ? 's' : ''}`);
    if (singles > 0) parts.push(`${singles} ${baseLabel}${singles > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return `${safeStock} ${baseLabel}s`;
    }

    return `${safeStock} ${baseLabel}s (${parts.join(' + ')})`;
  }

  // Only Box defined
  if (boxSize) {
    const boxes = Math.floor(safeStock / boxSize);
    const singles = safeStock % boxSize;
    const parts: string[] = [];
    if (boxes > 0) parts.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
    if (singles > 0) parts.push(`${singles} ${baseLabel}${singles > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return `${safeStock} ${baseLabel}s`;
    }

    return `${safeStock} ${baseLabel}s (${parts.join(' + ')})`;
  }

  return `${safeStock} ${baseLabel}s`;
}
