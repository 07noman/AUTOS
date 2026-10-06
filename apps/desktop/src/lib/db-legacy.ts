import Dexie, { Table } from 'dexie';
import type { Product } from '@genx/types/domain/product';
import type { Order } from '@genx/types/domain/order';
import type { Customer } from '@genx/types/domain/customer';

export interface OutboxRow {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  error?: string;
  createdAt: number;
}

class GenXDatabase extends Dexie {
  products!: Table<Product>;
  orders!: Table<Order>;
  customers!: Table<Customer>;
  outbox!: Table<OutboxRow>;

  constructor() {
    super('GenXDatabase');
    this.version(1).stores({
      products: 'id, tenantId, sku, barcode, categoryId, status, updatedAt',
      orders: 'id, tenantId, orderNumber, status, createdAt',
      customers: 'id, tenantId, phone, email',
      outbox: 'id, tenantId, status, createdAt',
    });
  }
}

export const db = new GenXDatabase();
