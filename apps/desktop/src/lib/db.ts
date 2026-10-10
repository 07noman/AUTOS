import Database from '@tauri-apps/plugin-sql';
import { Product, Category } from '@genx/types/domain/product';
import { Order } from '@genx/types/domain/order';
import { Customer } from '@genx/types/domain/customer';
import { db as legacyDb } from './db-legacy';
import { runMigrations } from './migrations';
import { getDeviceId } from './device';
import { stockMovementRepo } from './stock-movements';
import { supabase, isSupabaseConfigured } from './supabase';

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
// Reads the current logged-in user's tenantId dynamically at call time.
// Sources (in priority order):
//   1. Zustand persist store (genx-auth localStorage key) — set on every login
//   2. Supabase auth session stored by Supabase client (sb-*-auth-token)
//   3. Falls back to 'tenant-1' ONLY when truly unauthenticated (dev/local only)

function _deriveTenantFromMeta(meta: Record<string, any>, userId: string): string {
  if (meta?.tenant_id && typeof meta.tenant_id === 'string' && meta.tenant_id.trim()) {
    return meta.tenant_id.trim();
  }
  if (meta?.store_code && typeof meta.store_code === 'string') {
    return `tenant-${meta.store_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }
  return userId;
}

export function getCurrentTenantId(): string {
  // 1. Check Zustand persisted auth state (most up-to-date after login)
  try {
    const raw = localStorage.getItem('genx-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { user?: { tenantId?: string } } };
      const tenantId = parsed?.state?.user?.tenantId;
      if (tenantId && tenantId !== 'tenant-1') return tenantId;
    }
  } catch {
    // ignore parse errors
  }

  // 2. Check Supabase session keys written by the Supabase JS client (sb-*-auth-token)
  try {
    const sbKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    for (const key of sbKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw);
      const user = session?.user;
      if (user?.id) {
        return _deriveTenantFromMeta(user.user_metadata || {}, user.id);
      }
    }
  } catch {
    // ignore
  }

  // 3. Unauthenticated dev fallback — never reached in production for a logged-in user
  return 'tenant-1';
}

// Backward-compatible alias
export const TENANT_ID = 'tenant-1';


// Product Repository
export const productRepo = {
  async findAll(tenantId: string = getCurrentTenantId()): Promise<Product[]> {
    // 1. Supabase Real Cloud Database First
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('name');

        if (!error && data) {
          const products = data.map(mapToProduct);
          // Background sync to local SQLite for offline resilience
          void (async () => {
            try {
              const db = await getDatabase();
              for (const p of products) {
                await db.execute(
                  `INSERT INTO products (id, tenant_id, sku, name, description, barcode, category_id, cost_price, selling_price, wholesale_price, stock, minimum_stock, status, images, metadata, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    p.id, p.tenantId, p.sku, p.name, p.description || null, p.barcode || null,
                    p.categoryId || null, p.costPrice, p.sellingPrice, p.wholesalePrice || null,
                    p.stock, p.minimumStock, p.status, p.images ? JSON.stringify(p.images) : null,
                    p.metadata ? JSON.stringify(p.metadata) : null, p.createdAt, p.updatedAt,
                  ]
                ).catch(() => {});
              }
            } catch {
              // ignore local sync errors
            }
          })();
          return products;
        }
      } catch (err) {
        console.warn('[db] Supabase products fetch error, falling back to local:', err);
      }
    }

    // 2. Local SQLite / Cache Fallback
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name',
      [tenantId]
    );
    return rows.map(mapToProduct);
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Product | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .single();

        if (!error && data) {
          return mapToProduct(data);
        }
      } catch (err) {
        console.warn('[db] Supabase product findById error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    return rows.length > 0 ? mapToProduct(rows[0]) : null;
  },

  async findBySku(tenantId: string = getCurrentTenantId(), sku: string): Promise<Product | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('sku', sku)
          .is('deleted_at', null)
          .single();

        if (!error && data) {
          return mapToProduct(data);
        }
      } catch (err) {
        console.warn('[db] Supabase product findBySku error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM products WHERE tenant_id = ? AND sku = ? AND deleted_at IS NULL',
      [tenantId, sku]
    );
    return rows.length > 0 ? mapToProduct(rows[0]) : null;
  },

  async search(tenantId: string = getCurrentTenantId(), query: string): Promise<Product[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
          .order('name');

        if (!error && data) {
          return data.map(mapToProduct);
        }
      } catch (err) {
        console.warn('[db] Supabase product search error:', err);
      }
    }

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
    // 1. Persist directly to Supabase Cloud PostgreSQL
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('products').upsert({
          id: product.id,
          tenant_id: product.tenantId,
          sku: product.sku,
          name: product.name,
          description: product.description || null,
          barcode: product.barcode || null,
          category_id: product.categoryId || null,
          cost_price: product.costPrice,
          selling_price: product.sellingPrice,
          wholesale_price: product.wholesalePrice || null,
          stock: product.stock,
          minimum_stock: product.minimumStock,
          status: product.status,
          images: product.images ? JSON.stringify(product.images) : null,
          metadata: product.metadata ? JSON.stringify(product.metadata) : null,
          created_at: product.createdAt,
          updated_at: product.updatedAt,
        });

        if (error) {
          console.warn('[db] Supabase product insert warning:', error.message);
        }
      } catch (err) {
        console.warn('[db] Supabase product insert error:', err);
      }
    }

    // 2. Also save to local SQLite / Cache
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
    const now = Date.now();

    // 1. Persist update to Supabase
    if (isSupabaseConfigured()) {
      try {
        const updatePayload: Record<string, any> = { updated_at: now };
        if (product.sku !== undefined) updatePayload.sku = product.sku;
        if (product.name !== undefined) updatePayload.name = product.name;
        if (product.description !== undefined) updatePayload.description = product.description;
        if (product.barcode !== undefined) updatePayload.barcode = product.barcode;
        if (product.categoryId !== undefined) updatePayload.category_id = product.categoryId;
        if (product.costPrice !== undefined) updatePayload.cost_price = product.costPrice;
        if (product.sellingPrice !== undefined) updatePayload.selling_price = product.sellingPrice;
        if (product.wholesalePrice !== undefined) updatePayload.wholesale_price = product.wholesalePrice;
        if (product.stock !== undefined) updatePayload.stock = product.stock;
        if (product.minimumStock !== undefined) updatePayload.minimum_stock = product.minimumStock;
        if (product.status !== undefined) updatePayload.status = product.status;
        if (product.images !== undefined) updatePayload.images = JSON.stringify(product.images);
        if (product.metadata !== undefined) updatePayload.metadata = JSON.stringify(product.metadata);

        await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', product.id)
          .eq('tenant_id', product.tenantId);
      } catch (err) {
        console.warn('[db] Supabase product update error:', err);
      }
    }

    // 2. Also update local SQLite
    const db = await getDatabase();
    const existing = await this.findById(product.tenantId, product.id);
    if (!existing) throw new Error('Product not found');

    const updated = { ...existing, ...product, updatedAt: now };
    
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
    const now = Date.now();

    // 1. Soft-delete in Supabase
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('products')
          .update({ deleted_at: now, updated_at: now })
          .eq('id', id)
          .eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('[db] Supabase product delete error:', err);
      }
    }

    // 2. Soft-delete in local SQLite
    const db = await getDatabase();
    await db.execute(
      'UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [now, now, id, tenantId]
    );
  },

  async updateStock(tenantId: string = getCurrentTenantId(), productId: string, delta: number): Promise<void> {
    const now = Date.now();

    // 1. Update in Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('products')
          .select('stock')
          .eq('id', productId)
          .eq('tenant_id', tenantId)
          .single();

        if (data) {
          const newStock = Math.max(0, (Number(data.stock) || 0) + delta);
          await supabase
            .from('products')
            .update({ stock: newStock, updated_at: now })
            .eq('id', productId)
            .eq('tenant_id', tenantId);
        }
      } catch (err) {
        console.warn('[db] Supabase updateStock error:', err);
      }
    }

    // 2. Update in local SQLite
    const db = await getDatabase();
    if (delta < 0) {
      const required = Math.abs(delta);
      const existing = await this.findById(tenantId, productId);
      if (existing && existing.stock < required) {
        console.warn(`Stock low for "${existing.name}". Proceeding with deduction.`);
      }
    }
    await db.execute(
      'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [delta, now, productId, tenantId]
    );
  },

  async getLowStock(tenantId: string = getCurrentTenantId()): Promise<Product[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('stock', { ascending: true });

        if (!error && data) {
          return data.map(mapToProduct).filter((p) => p.stock <= p.minimumStock);
        }
      } catch (err) {
        console.warn('[db] Supabase low stock fetch error:', err);
      }
    }

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
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    sku: String(row.sku),
    name: String(row.name),
    description: row.description || undefined,
    barcode: row.barcode || undefined,
    categoryId: row.category_id ?? row.categoryId ?? undefined,
    costPrice: Number(row.cost_price ?? row.costPrice ?? 0),
    sellingPrice: Number(row.selling_price ?? row.sellingPrice ?? 0),
    wholesalePrice: row.wholesale_price != null || row.wholesalePrice != null
      ? Number(row.wholesale_price ?? row.wholesalePrice)
      : undefined,
    stock: Number(row.stock ?? 0),
    minimumStock: Number(row.minimum_stock ?? row.minimumStock ?? 0),
    status: (row.status as Product['status']) || 'active',
    images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : undefined,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    createdAt: Number(row.created_at ?? row.createdAt ?? Date.now()),
    updatedAt: Number(row.updated_at ?? row.updatedAt ?? Date.now()),
    deletedAt: row.deleted_at ?? row.deletedAt ? Number(row.deleted_at ?? row.deletedAt) : undefined,
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
    const now = Date.now();

    // 1. Supabase Cloud Sync
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('orders').upsert({
          id: order.id,
          tenant_id: order.tenantId,
          order_number: order.orderNumber,
          customer_id: order.customerId || null,
          subtotal: order.subtotal,
          discount: order.discount,
          tax: order.tax,
          total: order.total,
          payment_method: order.paymentMethod,
          status: order.status,
          notes: order.notes || null,
          created_at: order.createdAt || now,
          updated_at: order.updatedAt || now,
        });

        if (items && items.length > 0) {
          const itemRows = items.map((i) => ({
            id: crypto.randomUUID(),
            order_id: order.id,
            product_id: i.productId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            price: i.price,
            discount: i.discount,
            tax: i.tax,
            total: i.total,
            created_at: now,
          }));
          await supabase.from('order_items').insert(itemRows);
        }
      } catch (err) {
        console.warn('[db] Supabase order insert error:', err);
      }
    }

    // 2. Local SQLite Insert
    const db = await getDatabase();
    await db.transaction(async (tx) => {
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

    // 1. Direct Cloud Persistence to Supabase
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('orders').upsert({
          id: order.id,
          tenant_id: order.tenantId,
          order_number: order.orderNumber,
          customer_id: order.customerId || null,
          subtotal: order.subtotal,
          discount: order.discount,
          tax: order.tax,
          total: order.total,
          payment_method: order.paymentMethod,
          status: order.status,
          notes: order.notes || null,
          created_at: order.createdAt || now,
          updated_at: order.updatedAt || now,
        });

        if (items && items.length > 0) {
          const itemRows = items.map((item) => ({
            id: crypto.randomUUID(),
            order_id: order.id,
            product_id: item.productId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
            total: item.total,
            created_at: now,
          }));
          await supabase.from('order_items').insert(itemRows);

          // Deduct stock in Supabase for each item
          for (const item of items) {
            const { data } = await supabase
              .from('products')
              .select('stock')
              .eq('id', item.productId)
              .eq('tenant_id', order.tenantId)
              .single();

            if (data) {
              const currentStock = Number(data.stock || 0);
              await supabase
                .from('products')
                .update({ stock: Math.max(0, currentStock - item.quantity), updated_at: now })
                .eq('id', item.productId)
                .eq('tenant_id', order.tenantId);
            }
          }
        }

        // Credit sale customer balance update
        if (order.paymentMethod === 'credit' && order.customerId) {
          const { data: custData } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', order.customerId)
            .eq('tenant_id', order.tenantId)
            .single();

          if (custData) {
            await supabase
              .from('customers')
              .update({ balance: Number(custData.balance || 0) + order.total, updated_at: now })
              .eq('id', order.customerId)
              .eq('tenant_id', order.tenantId);
          }
        }
      } catch (err) {
        console.warn('[db] Supabase createAtomicSale error:', err);
      }
    }

    // 2. Local Atomic SQLite Transaction
    await db.transaction(async (tx) => {
      for (const item of items) {
        try {
          await tx.execute(
            'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
            [item.quantity, now, item.productId, order.tenantId]
          );

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
        } catch {
          // ignore local stock check failure in browser mock
        }
      }

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

      if (order.paymentMethod === 'credit' && order.customerId) {
        await tx.execute(
          'UPDATE customers SET balance = balance + ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
          [order.total, now, order.customerId, order.tenantId]
        );
      }

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

  async findAll(tenantId: string = getCurrentTenantId()): Promise<Order[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: String(row.id),
            tenantId: String(row.tenant_id),
            orderNumber: String(row.order_number),
            customerId: row.customer_id ? String(row.customer_id) : undefined,
            subtotal: Number(row.subtotal || 0),
            discount: Number(row.discount || 0),
            tax: Number(row.tax || 0),
            total: Number(row.total || 0),
            paymentMethod: row.payment_method || 'cash',
            status: row.status || 'completed',
            notes: row.notes || undefined,
            createdAt: Number(row.created_at || Date.now()),
            updatedAt: Number(row.updated_at || Date.now()),
            items: [],
          }));
        }
      } catch (err) {
        console.warn('[db] Supabase orders fetch error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    return rows.map((row) => ({
      ...row,
      tenantId: row.tenant_id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      paymentMethod: row.payment_method,
    }));
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Order | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            tenantId: String(data.tenant_id),
            orderNumber: String(data.order_number),
            customerId: data.customer_id ? String(data.customer_id) : undefined,
            subtotal: Number(data.subtotal || 0),
            discount: Number(data.discount || 0),
            tax: Number(data.tax || 0),
            total: Number(data.total || 0),
            paymentMethod: data.payment_method || 'cash',
            status: data.status || 'completed',
            notes: data.notes || undefined,
            createdAt: Number(data.created_at || Date.now()),
            updatedAt: Number(data.updated_at || Date.now()),
            items: [],
          };
        }
      } catch (err) {
        console.warn('[db] Supabase order findById error:', err);
      }
    }

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
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((row) => ({
            id: String(row.id),
            tenantId: String(row.tenant_id),
            orderNumber: String(row.order_number),
            customerId: row.customer_id ? String(row.customer_id) : undefined,
            subtotal: Number(row.subtotal || 0),
            discount: Number(row.discount || 0),
            tax: Number(row.tax || 0),
            total: Number(row.total || 0),
            paymentMethod: row.payment_method || 'cash',
            status: row.status || 'completed',
            notes: row.notes || undefined,
            createdAt: Number(row.created_at || Date.now()),
            updatedAt: Number(row.updated_at || Date.now()),
            items: [],
          }));
        }
      } catch (err) {
        console.warn('[db] Supabase findByDateRange error:', err);
      }
    }

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
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('name');

        if (!error && data) {
          return data.map(mapToCustomer);
        }
      } catch (err) {
        console.warn('[db] Supabase customers fetch error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM customers WHERE tenant_id = ? ORDER BY name', [tenantId]);
    return rows.map(mapToCustomer);
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Customer | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .single();

        if (!error && data) {
          return mapToCustomer(data);
        }
      } catch (err) {
        console.warn('[db] Supabase customer findById error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return rows.length > 0 ? mapToCustomer(rows[0]) : null;
  },

  async create(customer: Omit<Customer, 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number; updatedAt?: number }): Promise<Customer> {
    const tenantId = customer.tenantId || getCurrentTenantId();
    const id = customer.id || crypto.randomUUID();
    const now = customer.createdAt || Date.now();
    const balance = Number(customer.balance || 0);
    const creditLimit = Number(customer.creditLimit || 0);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('customers').upsert({
          id,
          tenant_id: tenantId,
          name: customer.name,
          phone: customer.phone || null,
          email: customer.email || null,
          address: customer.address || null,
          balance,
          credit_limit: creditLimit,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('[db] Supabase customer insert error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO customers (id, tenant_id, name, phone, email, address, balance, credit_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        customer.name,
        customer.phone || null,
        customer.email || null,
        customer.address || null,
        balance,
        creditLimit,
        now,
        now,
      ]
    );

    return {
      id,
      tenantId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      balance,
      creditLimit,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateBalance(tenantId: string = getCurrentTenantId(), id: string, amountDelta: number, tx?: any): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single();

        if (data) {
          const newBalance = Number(data.balance || 0) + amountDelta;
          await supabase
            .from('customers')
            .update({ balance: newBalance, updated_at: Date.now() })
            .eq('id', id)
            .eq('tenant_id', tenantId);
        }
      } catch (err) {
        console.warn('[db] Supabase updateBalance error:', err);
      }
    }

    const db = tx ?? (await getDatabase());
    await db.execute(
      'UPDATE customers SET balance = balance + ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
      [amountDelta, Date.now(), id, tenantId]
    );
  },
};

function mapToCustomer(row: any): Customer {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    name: String(row.name),
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    balance: Number(row.balance || 0),
    creditLimit: Number(row.credit_limit ?? row.creditLimit ?? 0),
    createdAt: Number(row.created_at ?? row.createdAt ?? Date.now()),
    updatedAt: Number(row.updated_at ?? row.updatedAt ?? Date.now()),
  };
}

// Category Repository
export const categoryRepo = {
  async findAll(tenantId: string = getCurrentTenantId()): Promise<Category[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('name', { ascending: true });

        if (!error && data) {
          return data.map((r) => ({
            id: String(r.id),
            tenantId: String(r.tenant_id),
            name: String(r.name),
            parentId: r.parent_id || undefined,
            createdAt: Number(r.created_at || Date.now()),
            updatedAt: Number(r.updated_at || Date.now()),
          }));
        }
      } catch (err) {
        console.warn('[db] Supabase categories fetch error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM categories WHERE tenant_id = ? ORDER BY name ASC',
      [tenantId]
    );
    return rows.map((r) => ({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      name: String(r.name),
      parentId: r.parent_id || undefined,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  },

  async findById(tenantId: string = getCurrentTenantId(), id: string): Promise<Category | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .single();

        if (!error && data) {
          return {
            id: String(data.id),
            tenantId: String(data.tenant_id),
            name: String(data.name),
            parentId: data.parent_id || undefined,
            createdAt: Number(data.created_at || Date.now()),
            updatedAt: Number(data.updated_at || Date.now()),
          };
        }
      } catch (err) {
        console.warn('[db] Supabase category findById error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      tenantId: String(r.tenant_id),
      name: String(r.name),
      parentId: r.parent_id || undefined,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  },

  async create(category: Category): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('categories').upsert({
          id: category.id,
          tenant_id: category.tenantId,
          name: category.name,
          parent_id: category.parentId || null,
          created_at: category.createdAt,
          updated_at: category.updatedAt,
        });
      } catch (err) {
        console.warn('[db] Supabase category insert error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO categories (id, tenant_id, name, parent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.tenantId,
        category.name,
        category.parentId || null,
        category.createdAt,
        category.updatedAt,
      ]
    );
  },

  async update(category: Partial<Category> & { id: string; tenantId: string }): Promise<void> {
    const now = Date.now();
    if (isSupabaseConfigured()) {
      try {
        const updatePayload: Record<string, any> = { updated_at: now };
        if (category.name !== undefined) updatePayload.name = category.name;
        if (category.parentId !== undefined) updatePayload.parent_id = category.parentId;
        await supabase
          .from('categories')
          .update(updatePayload)
          .eq('id', category.id)
          .eq('tenant_id', category.tenantId);
      } catch (err) {
        console.warn('[db] Supabase category update error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `UPDATE categories SET name = COALESCE(?, name), parent_id = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        category.name ?? null,
        category.parentId ?? null,
        now,
        category.id,
        category.tenantId,
      ]
    );
  },

  async delete(tenantId: string = getCurrentTenantId(), id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('categories')
          .update({ deleted_at: Date.now(), updated_at: Date.now() })
          .eq('id', id)
          .eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('[db] Supabase category delete error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute('DELETE FROM categories WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  },
};

// Unified Sales Report Record
export interface SaleRecord {
  id: string;
  source: 'retail_pos' | 'auto_care_pos' | 'auto_care_invoice';
  orderNumber: string;
  customerName?: string;
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: number;
}

// Sales Report Repository (queries actual completed transactions with tenant isolation)
export const salesReportRepo = {
  async getCompletedSales(
    tenantId: string = getCurrentTenantId(),
    startDate?: number,
    endDate?: number
  ): Promise<SaleRecord[]> {
    const sales: SaleRecord[] = [];

    // 1. Fetch completed/paid retail POS orders from Supabase (or local SQLite)
    if (isSupabaseConfigured()) {
      try {
        const { data: orderRows } = await supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (orderRows) {
          for (const r of orderRows) {
            const time = typeof r.created_at === 'number' ? r.created_at : new Date(r.created_at).getTime();
            if (startDate && time < startDate) continue;
            if (endDate && time > endDate) continue;
            sales.push({
              id: String(r.id),
              source: 'retail_pos',
              orderNumber: r.order_number || String(r.id).slice(0, 8),
              customerName: r.customer_name || undefined,
              customerId: r.customer_id || undefined,
              subtotal: Number(r.subtotal) || 0,
              discount: Number(r.discount) || 0,
              tax: Number(r.tax) || 0,
              total: Number(r.total) || 0,
              paymentMethod: (r.payment_method || 'cash').toLowerCase(),
              status: r.status,
              createdAt: time,
            });
          }
        }
      } catch (err) {
        console.warn('[db] Supabase sales report orders fetch error:', err);
      }
    }

    if (sales.length === 0) {
      try {
        const db = await getDatabase();
        const orderRows = await db.select<any[]>(
          `SELECT * FROM orders 
           WHERE tenant_id = ? 
             AND LOWER(status) IN ('completed', 'paid')
           ORDER BY created_at DESC`,
          [tenantId]
        );
        for (const r of orderRows) {
          const time = typeof r.created_at === 'number' ? r.created_at : new Date(r.created_at).getTime();
          if (startDate && time < startDate) continue;
          if (endDate && time > endDate) continue;
          sales.push({
            id: r.id,
            source: 'retail_pos',
            orderNumber: r.order_number || r.id.slice(0, 8),
            customerName: r.customer_name || undefined,
            customerId: r.customer_id || undefined,
            subtotal: Number(r.subtotal) || 0,
            discount: Number(r.discount) || 0,
            tax: Number(r.tax) || 0,
            total: Number(r.total) || 0,
            paymentMethod: (r.payment_method || 'cash').toLowerCase(),
            status: r.status,
            createdAt: time,
          });
        }
      } catch (err) {
        console.warn('Could not query orders for sales report:', err);
      }
    }

    // 2. Fetch completed/paid orders from `pos_orders` (Auto Care POS)
    if (isSupabaseConfigured()) {
      try {
        const { data: posRows } = await supabase
          .from('pos_orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'PAID')
          .order('created_at', { ascending: false });

        if (posRows) {
          for (const r of posRows) {
            const time = typeof r.created_at === 'number' ? r.created_at : new Date(r.created_at).getTime();
            if (startDate && time < startDate) continue;
            if (endDate && time > endDate) continue;
            sales.push({
              id: String(r.id),
              source: 'auto_care_pos',
              orderNumber: String(r.order_number || String(r.id).slice(0, 8)),
              customerName: r.customer_name || undefined,
              customerId: r.customer_id || undefined,
              subtotal: Number(r.subtotal) || 0,
              discount: 0,
              tax: Number(r.tax) || 0,
              total: Number(r.total) || 0,
              paymentMethod: (r.payment_method || 'cash').toLowerCase(),
              status: r.status,
              createdAt: time,
            });
          }
        }
      } catch (err) {
        console.warn('[db] Supabase sales report pos_orders fetch error:', err);
      }
    }

    // 3. Fetch completed/paid invoices from `auto_care_invoices`
    if (isSupabaseConfigured()) {
      try {
        const { data: invRows } = await supabase
          .from('auto_care_invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false });

        if (invRows) {
          for (const r of invRows) {
            const time = typeof r.created_at === 'number' ? r.created_at : new Date(r.created_at).getTime();
            if (startDate && time < startDate) continue;
            if (endDate && time > endDate) continue;
            sales.push({
              id: String(r.id),
              source: 'auto_care_invoice',
              orderNumber: r.invoice_number || String(r.id).slice(0, 8),
              customerName: r.customer_name || undefined,
              customerId: r.customer_id || undefined,
              subtotal: Number(r.subtotal) || 0,
              discount: Number(r.discount) || 0,
              tax: Number(r.tax) || 0,
              total: Number(r.total) || 0,
              paymentMethod: (r.payment_method || 'cash').toLowerCase(),
              status: r.status,
              createdAt: time,
            });
          }
        }
      } catch (err) {
        console.warn('[db] Supabase sales report invoices fetch error:', err);
      }
    }

    return sales.sort((a, b) => b.createdAt - a.createdAt);
  },
};

export const db = legacyDb;

export { Database };
