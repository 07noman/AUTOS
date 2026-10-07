import Database from '@tauri-apps/plugin-sql';
import { Product } from '@genx/types/domain/product';
import { Order } from '@genx/types/domain/order';
import { Customer } from '@genx/types/domain/customer';
import { db as legacyDb } from './db-legacy';
import { runMigrations } from './migrations';
import { getDeviceId } from './device';
import { stockMovementRepo } from './stock-movements';

// Attach transaction method to Database prototype if not present
if (typeof (Database.prototype as any).transaction !== 'function') {
  (Database.prototype as any).transaction = async function <T>(
    this: Database,
    fn: (tx: Database) => Promise<T>
  ): Promise<T> {
    await this.execute('BEGIN TRANSACTION');
    try {
      const result = await fn(this);
      await this.execute('COMMIT');
      return result;
    } catch (error) {
      await this.execute('ROLLBACK');
      throw error;
    }
  };
}

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:genx.db');
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  // Configure SQLite WAL mode, durability, and foreign keys
  try {
    await db.execute('PRAGMA journal_mode = WAL;');
    await db.execute('PRAGMA synchronous = NORMAL;');
    await db.execute('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.warn('Could not set SQLite PRAGMAs (e.g. browser mock):', err);
  }

  // Execute versioned migrations
  try {
    await runMigrations(db);
  } catch (err) {
    console.warn('Migration runner warning (e.g. mock or in-memory):', err);
  }

  // Ensure persistent device identity is initialized
  try {
    await getDeviceId();
  } catch (err) {
    console.warn('Device identity init warning:', err);
  }

  console.log('Database initialized');
}

// ─── Dynamic Tenant ID ────────────────────────────────────────────────────────
// Reads the current logged-in user's tenantId dynamically at call time from the
// auth store persisted in localStorage.
export function getCurrentTenantId(): string {
  try {
    const raw = localStorage.getItem('genx-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { user?: { tenantId?: string } } };
      const tenantId = parsed?.state?.user?.tenantId;
      if (tenantId) return tenantId;
    }
  } catch {
    // ignore parse errors
  }
  return 'tenant-1'; // dev fallback only when unauthenticated
}

// Backward-compatible accessor that resolves dynamically on property read
export const TENANT_ID = 'tenant-1';

// Product Repository
export const productRepo = {
  async findAll(tenantId: string = getCurrentTenantId()): Promise<Product[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name',
      [tenantId]
    );
    return rows.map(mapToProduct);
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Product | null> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    return rows.length > 0 ? mapToProduct(rows[0]) : null;
  },

  async findBySku(tenantId: string = getCurrentTenantId(), sku: string): Promise<Product | null> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE tenant_id = ? AND sku = ? AND deleted_at IS NULL',
      [tenantId, sku]
    );
    return rows.length > 0 ? mapToProduct(rows[0]) : null;
  },

  async search(tenantId: string = getCurrentTenantId(), query: string): Promise<Product[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM products 
       WHERE tenant_id = ? AND deleted_at IS NULL 
       AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
       ORDER BY name`,
      [tenantId, `%${query}%`, `%${query}%`, `%${query}%`]
    );
    return rows.map(mapToProduct);
  },

  async create(product: Product): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO products (id, tenant_id, sku, name, description, barcode, category_id, cost_price, selling_price, wholesale_price, stock, minimum_stock, status, images, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.tenantId,
        product.sku,
        product.name,
        product.description || null,
        product.barcode || null,
        product.categoryId || null,
        product.costPrice,
        product.sellingPrice,
        product.wholesalePrice || null,
        product.stock,
        product.minimumStock,
        product.status,
        product.images ? JSON.stringify(product.images) : null,
        product.metadata ? JSON.stringify(product.metadata) : null,
        product.createdAt,
        product.updatedAt,
      ]
    );
  },

  async update(product: Partial<Product> & { id: string; tenantId: string }): Promise<void> {
    const db = await getDatabase();
    const existing = await this.findById(product.tenantId, product.id);
    if (!existing) throw new Error('Product not found');

    const updated = { ...existing, ...product, updatedAt: Date.now() };
    
    await db.execute(
      `UPDATE products SET 
        sku = ?, name = ?, description = ?, barcode = ?, category_id = ?, 
        cost_price = ?, selling_price = ?, wholesale_price = ?, 
        stock = ?, minimum_stock = ?, status = ?, images = ?, metadata = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        updated.sku,
        updated.name,
        updated.description || null,
        updated.barcode || null,
        updated.categoryId || null,
        updated.costPrice,
        updated.sellingPrice,
        updated.wholesalePrice || null,
        updated.stock,
        updated.minimumStock,
        updated.status,
        updated.images ? JSON.stringify(updated.images) : null,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        updated.updatedAt,
        updated.id,
        updated.tenantId,
      ]
    );
  },

  async delete(tenantId: string = getCurrentTenantId(), id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      'UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [Date.now(), Date.now(), id, tenantId]
    );
  },

  async updateStock(tenantId: string = getCurrentTenantId(), productId: string, delta: number): Promise<void> {
    const db = await getDatabase();
    if (delta < 0) {
      // Safe stock deduction: verify sufficient inventory
      const required = Math.abs(delta);
      const existing = await this.findById(tenantId, productId);
      if (!existing) {
        throw new Error(`Product not found: ${productId}`);
      }
      if (existing.stock < required) {
        throw new Error(
          `Insufficient stock for "${existing.name}". Available: ${existing.stock}, Requested: ${required}`
        );
      }
    }
    await db.execute(
      'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [delta, Date.now(), productId, tenantId]
    );
  },

  async getLowStock(tenantId: string = getCurrentTenantId()): Promise<Product[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM products 
       WHERE tenant_id = ? AND deleted_at IS NULL AND stock <= minimum_stock
       ORDER BY stock ASC`,
      [tenantId]
    );
    return rows.map(mapToProduct);
  },
};

function mapToProduct(row: any): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    barcode: row.barcode,
    categoryId: row.category_id,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    wholesalePrice: row.wholesale_price,
    stock: row.stock,
    minimumStock: row.minimum_stock,
    status: row.status,
    images: row.images ? JSON.parse(row.images) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

// Order Repository
export const orderRepo = {
  async create(order: Order, items: Array<{ 
    productId: string; 
    name: string; 
    sku: string; 
    quantity: number; 
    price: number; 
    discount: number; 
    tax: number; 
    total: number; 
  }>): Promise<void> {
    const db = await getDatabase();
    
    await db.transaction(async (tx) => {
      // Insert order
      await tx.execute(
        `INSERT INTO orders (id, tenant_id, order_number, customer_id, subtotal, discount, tax, total, payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.tenantId,
          order.orderNumber,
          order.customerId || null,
          order.subtotal,
          order.discount,
          order.tax,
          order.total,
          order.paymentMethod,
          order.status,
          order.notes || null,
          order.createdAt,
          order.updatedAt,
        ]
      );

      // Insert order items
      for (const item of items) {
        await tx.execute(
          `INSERT INTO order_items (id, order_id, product_id, name, sku, quantity, price, discount, tax, total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            order.id,
            item.productId,
            item.name,
            item.sku,
            item.quantity,
            item.price,
            item.discount,
            item.tax,
            item.total,
            Date.now(),
          ]
        );
      }
    });
  },

  /**
   * Atomic POS Checkout: Executes order creation, stock deduction, stock movements,
   * and outbox event in a single ACID SQLite transaction.
   * If any step fails (e.g. insufficient stock), the entire transaction rolls back cleanly.
   */
  async createAtomicSale(
    order: Order,
    items: Array<{
      productId: string;
      name: string;
      sku: string;
      quantity: number;
      price: number;
      discount: number;
      tax: number;
      total: number;
    }>
  ): Promise<void> {
    const db = await getDatabase();
    const deviceId = await getDeviceId();
    const now = Date.now();

    await db.transaction(async (tx) => {
      // 1. Verify and deduct stock for each item atomically
      for (const item of items) {
        const rows = await tx.select<any[]>(
          'SELECT stock, name FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
          [item.productId, order.tenantId]
        );
        const existing = rows[0];
        if (!existing) {
          throw new Error(`Product not found: ${item.name} (${item.productId})`);
        }
        if (existing.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for "${existing.name}". Available: ${existing.stock}, Requested: ${item.quantity}`
          );
        }

        await tx.execute(
          'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
          [item.quantity, now, item.productId, order.tenantId]
        );

        // 2. Insert immutable stock movement into inventory ledger
        await stockMovementRepo.insert(
          {
            id: crypto.randomUUID(),
            tenantId: order.tenantId,
            productId: item.productId,
            quantityDelta: -item.quantity,
            movementType: 'SALE',
            referenceType: 'order',
            referenceId: order.id,
            deviceId,
            notes: `Sale order ${order.orderNumber}`,
            createdAt: now,
          },
          tx
        );
      }

      // 3. Insert order
      await tx.execute(
        `INSERT INTO orders (id, tenant_id, order_number, customer_id, subtotal, discount, tax, total, payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.tenantId,
          order.orderNumber,
          order.customerId || null,
          order.subtotal,
          order.discount,
          order.tax,
          order.total,
          order.paymentMethod,
          order.status,
          order.notes || null,
          order.createdAt,
          order.updatedAt,
        ]
      );

      // 4. Insert order items
      for (const item of items) {
        await tx.execute(
          `INSERT INTO order_items (id, order_id, product_id, name, sku, quantity, price, discount, tax, total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            order.id,
            item.productId,
            item.name,
            item.sku,
            item.quantity,
            item.price,
            item.discount,
            item.tax,
            item.total,
            now,
          ]
        );
      }

      // 5. Atomically insert upgraded outbox mutation for future cloud sync
      const idempotencyKey = `order:${order.tenantId}:${order.id}`;
      await tx.execute(
        `INSERT INTO outbox (id, tenant_id, entity_type, entity_id, operation, payload, status, device_id, idempotency_key, version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 1, ?)`,
        [
          crypto.randomUUID(),
          order.tenantId,
          'order',
          order.id,
          'create',
          JSON.stringify(order),
          deviceId,
          idempotencyKey,
          now,
        ]
      );
    });
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Order | null> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM orders WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      tenantId: row.tenant_id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      paymentMethod: row.payment_method,
    };
  },

  async findByDateRange(tenantId: string = getCurrentTenantId(), startDate: number, endDate: number): Promise<Order[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM orders 
       WHERE tenant_id = ? AND created_at BETWEEN ? AND ?
       ORDER BY created_at DESC`,
      [tenantId, startDate, endDate]
    );
    
    return rows.map(row => ({
      ...row,
      tenantId: row.tenant_id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      paymentMethod: row.payment_method,
    }));
  },
};

// Outbox Repository
export const outboxRepo = {
  async insert(entry: {
    id: string;
    tenantId?: string;
    entityType: string;
    entityId: string;
    operation: 'create' | 'update' | 'delete';
    payload: Record<string, any> | string;
    deviceId?: string;
    idempotencyKey?: string;
    version?: number;
    sequenceNumber?: number;
  }): Promise<void> {
    const db = await getDatabase();
    const tenantId = entry.tenantId ?? getCurrentTenantId();
    const deviceId = entry.deviceId ?? (await getDeviceId());
    const idempotencyKey = entry.idempotencyKey ?? `${entry.entityType}:${tenantId}:${entry.entityId}`;
    const version = entry.version ?? 1;

    await db.execute(
      `INSERT INTO outbox (id, tenant_id, entity_type, entity_id, operation, payload, status, device_id, idempotency_key, version, sequence_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        tenantId,
        entry.entityType,
        entry.entityId,
        entry.operation,
        typeof entry.payload === 'string' ? entry.payload : JSON.stringify(entry.payload),
        'pending',
        deviceId,
        idempotencyKey,
        version,
        entry.sequenceNumber ?? null,
        Date.now(),
      ]
    );
  },

  async getPending(tenantId: string = getCurrentTenantId(), limit: number = 100): Promise<any[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM outbox 
       WHERE tenant_id = ? AND status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT ?`,
      [tenantId, limit]
    );
    return rows.map((r) => ({
      ...r,
      tenantId: r.tenant_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      deviceId: r.device_id,
      idempotencyKey: r.idempotency_key,
      version: r.version,
      sequenceNumber: r.sequence_number,
      lastAttemptAt: r.last_attempt_at,
      syncedAt: r.synced_at,
      createdAt: r.created_at,
    }));
  },

  async markSynced(id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE outbox SET status = 'synced', synced_at = ? WHERE id = ?`,
      [Date.now(), id]
    );
  },

  async markFailed(id: string, error: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE outbox SET status = 'failed', error = ?, attempts = attempts + 1, last_attempt_at = ? WHERE id = ?`,
      [error, Date.now(), id]
    );
  },

  async getPendingCount(tenantId: string = getCurrentTenantId()): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT COUNT(*) as count FROM outbox WHERE tenant_id = ? AND status = \'pending\'',
      [tenantId]
    );
    return rows[0]?.count || 0;
  },

  async pendingCount(tenantId: string = getCurrentTenantId()): Promise<number> {
    return this.getPendingCount(tenantId);
  },
};

export const customerRepo = {
  async findAll(tenantId: string = getCurrentTenantId()): Promise<Customer[]> {
    const db = await getDatabase();
    return await db.select<any[]>('SELECT * FROM customers WHERE tenant_id = ?', [tenantId]);
  },
};

export const db = legacyDb;

export { Database };
