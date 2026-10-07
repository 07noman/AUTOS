export type MovementType =
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'TRANSFER'
  | 'OPENING_BALANCE';

export type ReferenceType = 'order' | 'pos_order' | 'adjustment' | 'manual' | 'sync';

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  quantityDelta: number; // e.g. -2 for sale of 2 items, +10 for restock
  movementType: MovementType;
  referenceType: ReferenceType;
  referenceId: string; // e.g. orderId or invoiceId
  deviceId: string;
  notes?: string;
  createdAt: number;
}
