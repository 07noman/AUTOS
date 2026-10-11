import { getDatabase, getCurrentTenantId } from './db';
import { getDeviceId } from './device';
import { stockMovementRepo } from './stock-movements';
import { supabase, isSupabaseConfigured } from './supabase';
import type { Vehicle, AutoCareService, ServiceJob, ServiceJobItem, AutoCareInvoice } from '@genx/types/domain/auto-care';

// ─── Schema Initialisation ────────────────────────────────────────────────────
export async function initializeAutoCareSchema(): Promise<void> {
  const db = await getDatabase();

  await db.execute(`CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT NOT NULL,
    vin TEXT,
    color TEXT,
    mileage INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS auto_care_services (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    labor_rate REAL NOT NULL DEFAULT 80,
    estimated_hours REAL NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'general',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS service_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    job_number TEXT NOT NULL UNIQUE,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    vehicle_id TEXT,
    vehicle_summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'normal',
    mechanic_id TEXT,
    mechanic_name TEXT,
    estimated_hours REAL,
    actual_hours REAL,
    notes TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS service_job_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'part',
    product_id TEXT,
    service_id TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES service_jobs(id)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS auto_care_invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    job_id TEXT,
    job_number TEXT,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    vehicle_summary TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    status TEXT NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // ── POS Orders table ──────────────────────────────────────────────────────
  await db.execute(`CREATE TABLE IF NOT EXISTS pos_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    order_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ONGOING',
    customer_name TEXT,
    customer_id TEXT,
    payment_method TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid_amount REAL,
    items TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant ON pos_orders(tenant_id, status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_pos_orders_number ON pos_orders(tenant_id, order_number)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON service_jobs(tenant_id, status)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_number ON service_jobs(job_number)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id)`);
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapJob(r: any): ServiceJob {
  if (!r) return {} as ServiceJob;
  return {
    id: String(r.id || ''),
    tenantId: String(r.tenant_id ?? r.tenantId ?? ''),
    jobNumber: String(r.job_number ?? r.jobNumber ?? ''),
    customerId: r.customer_id ?? r.customerId ?? undefined,
    customerName: String(r.customer_name ?? r.customerName ?? ''),
    vehicleId: r.vehicle_id ?? r.vehicleId ?? undefined,
    vehicleSummary: String(r.vehicle_summary ?? r.vehicleSummary ?? ''),
    status: (r.status || 'pending') as ServiceJob['status'],
    priority: (r.priority || 'normal') as ServiceJob['priority'],
    mechanicId: r.mechanic_id ?? r.mechanicId ?? undefined,
    mechanicName: r.mechanic_name ?? r.mechanicName ?? undefined,
    estimatedHours: (r.estimated_hours ?? r.estimatedHours) != null ? Number(r.estimated_hours ?? r.estimatedHours) : undefined,
    actualHours: (r.actual_hours ?? r.actualHours) != null ? Number(r.actual_hours ?? r.actualHours) : undefined,
    notes: r.notes || undefined,
    startedAt: (r.started_at ?? r.startedAt) ? Number(r.started_at ?? r.startedAt) : undefined,
    completedAt: (r.completed_at ?? r.completedAt) ? Number(r.completed_at ?? r.completedAt) : undefined,
    createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
    updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
  };
}

function mapService(r: any): AutoCareService {
  return {
    id: String(r.id || ''),
    tenantId: String(r.tenant_id ?? r.tenantId ?? ''),
    name: String(r.name || ''),
    description: r.description || undefined,
    laborRate: Number(r.labor_rate ?? r.laborRate ?? 80),
    estimatedHours: Number(r.estimated_hours ?? r.estimatedHours ?? 1),
    category: (r.category || 'general') as AutoCareService['category'],
    isActive: Boolean(r.is_active ?? r.isActive ?? 1),
    createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
    updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
  };
}

function mapVehicle(r: any): Vehicle {
  return {
    id: String(r.id || ''),
    tenantId: String(r.tenant_id ?? r.tenantId ?? ''),
    customerId: r.customer_id ?? r.customerId ?? undefined,
    customerName: r.customer_name ?? r.customerName ?? undefined,
    make: String(r.make || ''),
    model: String(r.model || ''),
    year: Number(r.year || 0),
    licensePlate: String(r.license_plate ?? r.licensePlate ?? ''),
    vin: r.vin || undefined,
    color: r.color || undefined,
    mileage: (r.mileage != null) ? Number(r.mileage) : undefined,
    notes: r.notes || undefined,
    createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
    updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
  };
}

function mapInvoice(r: any): AutoCareInvoice {
  let items: any[] = [];
  try {
    items = typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []);
  } catch {
    items = [];
  }
  return {
    id: String(r.id || ''),
    tenantId: String(r.tenant_id ?? r.tenantId ?? ''),
    invoiceNumber: String(r.invoice_number ?? r.invoiceNumber ?? ''),
    jobId: r.job_id ?? r.jobId ?? undefined,
    jobNumber: r.job_number ?? r.jobNumber ?? undefined,
    customerId: r.customer_id ?? r.customerId ?? undefined,
    customerName: String(r.customer_name ?? r.customerName ?? ''),
    vehicleSummary: r.vehicle_summary ?? r.vehicleSummary ?? undefined,
    items,
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    tax: Number(r.tax || 0),
    total: Number(r.total || 0),
    paymentMethod: r.payment_method ?? r.paymentMethod ?? 'cash',
    status: (r.status || 'paid') as AutoCareInvoice['status'],
    notes: r.notes || undefined,
    createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
    updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
  };
}

// ─── POS Order Types & Repository ─────────────────────────────────────────────

export interface POSOrderItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  type: 'product' | 'service';
  category?: string;
  trackInventory?: boolean;
}

export interface POSOrder {
  id: string;
  tenantId: string;
  orderNumber: number;
  status: 'ONGOING' | 'PAID' | 'CANCELLED';
  customerName?: string;
  customerId?: string;
  paymentMethod?: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount?: number;
  items: POSOrderItem[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

function mapPOSOrder(r: any): POSOrder {
  let items: POSOrderItem[] = [];
  try {
    items = typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []);
  } catch {
    items = [];
  }

  // Fallback: If items is empty, check if notes contains JSON with items
  let notesStr = r.notes ?? undefined;
  if ((!items || items.length === 0) && r.notes) {
    try {
      const parsedNotes = JSON.parse(r.notes);
      if (Array.isArray(parsedNotes?.items)) {
        items = parsedNotes.items;
        notesStr = parsedNotes.notes || undefined;
      }
    } catch {
      // notes is plain text, keep as is
    }
  }

  // Normalize status so COMPLETED, completed, PAID, and paid are all treated uniformly
  const rawStatus = String(r.status || 'ONGOING').toUpperCase();
  const normalizedStatus: POSOrder['status'] =
    (rawStatus === 'COMPLETED' || rawStatus === 'PAID')
      ? 'PAID'
      : (rawStatus === 'CANCELLED' ? 'CANCELLED' : 'ONGOING');

  const total = Number(r.total || 0);
  const paidAmount = (r.paid_amount != null || r.paidAmount != null)
    ? Number(r.paid_amount ?? r.paidAmount)
    : (normalizedStatus === 'PAID' ? total : undefined);

  return {
    id: String(r.id),
    tenantId: String(r.tenant_id ?? r.tenantId),
    orderNumber: Number(r.order_number ?? r.orderNumber) || 1,
    status: normalizedStatus,
    customerName: r.customer_name ?? r.customerName ?? undefined,
    customerId: r.customer_id ?? r.customerId ?? undefined,
    paymentMethod: r.payment_method ?? r.paymentMethod ?? undefined,
    subtotal: Number(r.subtotal || 0),
    tax: Number(r.tax || 0),
    total,
    paidAmount,
    items,
    notes: notesStr,
    createdAt: Number(r.created_at ?? r.createdAt ?? Date.now()),
    updatedAt: Number(r.updated_at ?? r.updatedAt ?? Date.now()),
  };
}

export const posOrderRepo = {
  /** Get next sequential order number for tenant */
  async nextOrderNumber(tenantId = getCurrentTenantId()): Promise<number> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('pos_orders')
          .select('order_number')
          .eq('tenant_id', tenantId)
          .order('order_number', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          return (Number(data[0].order_number) || 0) + 1;
        }
      } catch (err) {
        console.warn('[db] Supabase nextOrderNumber error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT COALESCE(MAX(order_number), 0) as max_num FROM pos_orders WHERE tenant_id = ?',
      [tenantId]
    );
    return (Number(rows[0]?.max_num) || 0) + 1;
  },

  /** Find all POS orders for tenant */
  async findAll(tenantId = getCurrentTenantId()): Promise<POSOrder[]> {
    const results: POSOrder[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('pos_orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          results.push(...data.map(mapPOSOrder));
        }
      } catch (err) {
        console.warn('[db] Supabase pos_orders findAll error:', err);
      }

      // Also merge any completed orders from standard `orders` table (retail POS)
      try {
        const { data: stdOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (stdOrders && stdOrders.length > 0) {
          const existingIds = new Set(results.map((o) => o.id));
          for (const so of stdOrders) {
            if (!existingIds.has(String(so.id))) {
              results.push({
                id: String(so.id),
                tenantId: String(so.tenant_id),
                orderNumber: Number(String(so.order_number).replace(/\D/g, '')) || 1,
                status: 'PAID',
                customerName: so.customer_id ? `Customer (${so.customer_id})` : undefined,
                paymentMethod: so.payment_method || 'cash',
                subtotal: Number(so.subtotal || 0),
                tax: Number(so.tax || 0),
                total: Number(so.total || 0),
                paidAmount: Number(so.total || 0),
                items: [],
                notes: so.notes || undefined,
                createdAt: Number(so.created_at || Date.now()),
                updatedAt: Number(so.updated_at || Date.now()),
              });
            }
          }
        }
      } catch (ordErr) {
        console.warn('[db] Supabase orders fallback error:', ordErr);
      }

      if (results.length > 0) {
        return results.sort((a, b) => b.createdAt - a.createdAt);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM pos_orders WHERE tenant_id = ? ORDER BY order_number DESC',
      [tenantId]
    );
    return rows.map(mapPOSOrder);
  },

  /** Find by status: ONGOING or PAID or CANCELLED */
  async findByStatus(status: POSOrder['status'], tenantId = getCurrentTenantId()): Promise<POSOrder[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('pos_orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', status)
          .order('order_number', { ascending: false });

        if (!error && data) {
          return data.map(mapPOSOrder);
        }
      } catch (err) {
        console.warn('[db] Supabase findByStatus error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM pos_orders WHERE tenant_id = ? AND status = ? ORDER BY order_number DESC',
      [tenantId, status]
    );
    return rows.map(mapPOSOrder);
  },

  /** Find a single order by ID */
  async findById(id: string, tenantId = getCurrentTenantId()): Promise<POSOrder | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('pos_orders')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single();

        if (!error && data) {
          return mapPOSOrder(data);
        }
      } catch (err) {
        console.warn('[db] Supabase findById error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM pos_orders WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    return rows.length ? mapPOSOrder(rows[0]) : null;
  },

  /** Create an ONGOING (in-progress) order */
  async createOngoing(input: {
    items: POSOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    customerName?: string;
    customerId?: string;
    notes?: string;
    tenantId?: string;
  }): Promise<POSOrder> {
    const tenantId = input.tenantId ?? getCurrentTenantId();
    const id = crypto.randomUUID();
    const now = Date.now();
    const orderNumber = await this.nextOrderNumber(tenantId);

    const order: POSOrder = {
      id,
      tenantId,
      orderNumber,
      status: 'ONGOING',
      customerName: input.customerName,
      customerId: input.customerId,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      items: input.items,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    if (isSupabaseConfigured()) {
      try {
        const fullPayload = {
          id: order.id,
          tenant_id: order.tenantId,
          order_number: order.orderNumber,
          status: order.status,
          customer_name: order.customerName || null,
          customer_id: order.customerId || null,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          items: JSON.stringify(order.items),
          notes: order.notes || null,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
        };
        const { error: ongoingErr } = await supabase.from('pos_orders').upsert(fullPayload);
        if (ongoingErr) {
          console.warn('[db] pos_orders createOngoing retry with safe payload:', ongoingErr.message);
          // Fallback payload without columns that might not exist yet
          await supabase.from('pos_orders').upsert({
            id: order.id,
            tenant_id: order.tenantId,
            order_number: String(order.orderNumber),
            status: order.status,
            customer_name: order.customerName || null,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            notes: JSON.stringify({ items: order.items, notes: order.notes }),
            created_at: order.createdAt,
            updated_at: order.updatedAt,
          });
        }
      } catch (err) {
        console.warn('[db] Supabase createOngoing error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO pos_orders (id, tenant_id, order_number, status, customer_name, customer_id, subtotal, tax, total, items, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id, order.tenantId, order.orderNumber, order.status,
        order.customerName ?? null, order.customerId ?? null,
        order.subtotal, order.tax, order.total,
        JSON.stringify(order.items), order.notes ?? null,
        order.createdAt, order.updatedAt,
      ]
    );

    return order;
  },

  /** Create a fully PAID order after successful payment */
  async createPaid(input: {
    items: POSOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    paidAmount: number;
    paymentMethod: string;
    customerName?: string;
    customerId?: string;
    notes?: string;
    tenantId?: string;
    existingOrderId?: string;
  }): Promise<POSOrder> {
    const tenantId = input.tenantId ?? getCurrentTenantId();
    const now = Date.now();
    const db = await getDatabase();
    const deviceId = await getDeviceId();

    let finalOrder: POSOrder | null = null;
    const orderId = input.existingOrderId ?? crypto.randomUUID();
    const orderNumber = await this.nextOrderNumber(tenantId);

    // 1. Direct Supabase Cloud Persistence
    if (isSupabaseConfigured()) {
      try {
        // Attempt full schema upsert into pos_orders
        const fullPayload: Record<string, any> = {
          id: orderId,
          tenant_id: tenantId,
          order_number: orderNumber,
          status: 'PAID',
          customer_name: input.customerName || null,
          customer_id: input.customerId || null,
          payment_method: input.paymentMethod,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          paid_amount: input.paidAmount,
          items: JSON.stringify(input.items),
          notes: input.notes || null,
          created_at: now,
          updated_at: now,
        };

        const { error: upsertErr } = await supabase.from('pos_orders').upsert(fullPayload);
        if (upsertErr) {
          console.warn('[db] pos_orders full upsert warning, retrying with fallback payload:', upsertErr.message);
          // Fallback payload: safe columns only, items encoded in notes
          const safePayload = {
            id: orderId,
            tenant_id: tenantId,
            order_number: String(orderNumber),
            status: 'PAID',
            customer_name: input.customerName || null,
            payment_method: input.paymentMethod,
            subtotal: input.subtotal,
            discount: 0,
            tax: input.tax,
            total: input.total,
            notes: JSON.stringify({ items: input.items, notes: input.notes, paidAmount: input.paidAmount }),
            created_at: now,
            updated_at: now,
          };
          const { error: safeErr } = await supabase.from('pos_orders').upsert(safePayload);
          if (safeErr) {
            console.error('[db] pos_orders safe upsert error:', safeErr.message);
          }
        }

        // Also mirror to standard `orders` and `order_items` tables so dashboard & reports see it
        try {
          await supabase.from('orders').upsert({
            id: orderId,
            tenant_id: tenantId,
            order_number: `ORD-${orderNumber}`,
            customer_id: input.customerId || null,
            subtotal: input.subtotal,
            discount: 0,
            tax: input.tax,
            total: input.total,
            payment_method: input.paymentMethod,
            status: 'completed',
            notes: input.notes || null,
            created_at: now,
            updated_at: now,
          });

          if (input.items && input.items.length > 0) {
            const itemRows = input.items.map((it) => ({
              id: crypto.randomUUID(),
              order_id: orderId,
              tenant_id: tenantId,
              product_id: String(it.id),
              name: it.name,
              sku: String(it.id),
              quantity: it.quantity,
              price: it.price,
              discount: 0,
              tax: 0,
              total: it.price * it.quantity,
            }));
            await supabase.from('order_items').insert(itemRows);
          }
        } catch (stdErr) {
          console.warn('[db] standard orders mirror error:', stdErr);
        }

        // Deduct inventory in Supabase products
        for (const item of input.items) {
          if (item.type !== 'service' && item.quantity > 0) {
            const { data } = await supabase
              .from('products')
              .select('stock')
              .eq('id', String(item.id))
              .eq('tenant_id', tenantId)
              .single();

            if (data) {
              const current = Number(data.stock || 0);
              await supabase
                .from('products')
                .update({ stock: Math.max(0, current - item.quantity), updated_at: now })
                .eq('id', String(item.id))
                .eq('tenant_id', tenantId);
            }
          }
        }
      } catch (err) {
        console.warn('[db] Supabase createPaid error:', err);
      }
    }

    // 2. Local Database Transaction
    await db.transaction(async (tx) => {
      for (const item of input.items) {
        if (item.type !== 'service' && item.quantity > 0) {
          try {
            await tx.execute(
              'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
              [item.quantity, now, String(item.id), tenantId]
            );

            await stockMovementRepo.insert(
              {
                id: crypto.randomUUID(),
                tenantId,
                productId: String(item.id),
                quantityDelta: -item.quantity,
                movementType: 'SALE',
                referenceType: 'pos_order',
                referenceId: orderId,
                deviceId,
                notes: `Auto care sale of ${item.name}`,
                createdAt: now,
              },
              tx
            );
          } catch {
            // ignore local mock stock check
          }
        }
      }

      if (input.existingOrderId) {
        await tx.execute(
          `UPDATE pos_orders SET status='PAID', payment_method=?, paid_amount=?, subtotal=?, tax=?, total=?, items=?, customer_name=?, customer_id=?, updated_at=? WHERE id=? AND tenant_id=?`,
          [
            input.paymentMethod, input.paidAmount,
            input.subtotal, input.tax, input.total,
            JSON.stringify(input.items),
            input.customerName ?? null, input.customerId ?? null,
            now, input.existingOrderId, tenantId,
          ]
        );
        const rows = await tx.select<any[]>(
          'SELECT * FROM pos_orders WHERE id = ? AND tenant_id = ?',
          [input.existingOrderId, tenantId]
        );
        if (rows.length > 0 && rows[0]) {
          finalOrder = mapPOSOrder(rows[0]);
        }
      }

      if (!finalOrder) {
        finalOrder = {
          id: orderId,
          tenantId,
          orderNumber,
          status: 'PAID',
          customerName: input.customerName,
          customerId: input.customerId,
          paymentMethod: input.paymentMethod,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          paidAmount: input.paidAmount,
          items: input.items,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        };

        await tx.execute(
          `INSERT INTO pos_orders (id, tenant_id, order_number, status, customer_name, customer_id, payment_method, subtotal, tax, total, paid_amount, items, notes, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            finalOrder.id, finalOrder.tenantId, finalOrder.orderNumber, finalOrder.status,
            finalOrder.customerName ?? null, finalOrder.customerId ?? null, finalOrder.paymentMethod,
            finalOrder.subtotal, finalOrder.tax, finalOrder.total, finalOrder.paidAmount,
            JSON.stringify(finalOrder.items), finalOrder.notes ?? null,
            finalOrder.createdAt, finalOrder.updatedAt,
          ]
        );
      }
    });

    if (!finalOrder) {
      finalOrder = {
        id: orderId,
        tenantId,
        orderNumber,
        status: 'PAID',
        customerName: input.customerName,
        customerId: input.customerId,
        paymentMethod: input.paymentMethod,
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        paidAmount: input.paidAmount,
        items: input.items,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };
    }

    return finalOrder;
  },

  /** Soft-delete: set status to CANCELLED */
  async cancel(id: string, tenantId = getCurrentTenantId()): Promise<void> {
    const now = Date.now();
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('pos_orders')
          .update({ status: 'CANCELLED', updated_at: now })
          .eq('id', id)
          .eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('[db] Supabase pos_order cancel error:', err);
      }
    }
    const db = await getDatabase();
    await db.execute(
      `UPDATE pos_orders SET status='CANCELLED', updated_at=? WHERE id=? AND tenant_id=?`,
      [now, id, tenantId]
    );
  },
};

// ─── Repositories ─────────────────────────────────────────────────────────────

export const jobRepo = {
  async findAll(tenantId = getCurrentTenantId()): Promise<ServiceJob[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('service_jobs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapJob);
        }
      } catch (err) {
        console.warn('[db] Supabase service_jobs findAll error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
    return rows.map(mapJob);
  },

  async findByStatus(status: string, tenantId = getCurrentTenantId()): Promise<ServiceJob[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('service_jobs')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', status)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapJob);
        }
      } catch (err) {
        console.warn('[db] Supabase service_jobs findByStatus error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC', [tenantId, status]);
    return rows.map(mapJob);
  },

  async findById(id: string, tenantId = getCurrentTenantId()): Promise<ServiceJob | null> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('service_jobs')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single();

        if (!error && data) {
          return mapJob(data);
        }
      } catch (err) {
        console.warn('[db] Supabase service_jobs findById error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return rows.length ? mapJob(rows[0]) : null;
  },

  async create(job: Omit<ServiceJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceJob> {
    const id = crypto.randomUUID();
    const now = Date.now();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('service_jobs').upsert({
          id,
          tenant_id: job.tenantId,
          job_number: job.jobNumber,
          customer_id: job.customerId || null,
          customer_name: job.customerName,
          vehicle_id: job.vehicleId || null,
          vehicle_summary: job.vehicleSummary,
          status: job.status,
          priority: job.priority,
          mechanic_id: job.mechanicId || null,
          mechanic_name: job.mechanicName || null,
          estimated_hours: job.estimatedHours || null,
          notes: job.notes || null,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('[db] Supabase service_job create error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO service_jobs (id, tenant_id, job_number, customer_id, customer_name, vehicle_id, vehicle_summary, status, priority, mechanic_id, mechanic_name, estimated_hours, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, job.tenantId, job.jobNumber, job.customerId || null, job.customerName,
        job.vehicleId || null, job.vehicleSummary, job.status, job.priority,
        job.mechanicId || null, job.mechanicName || null, job.estimatedHours || null,
        job.notes || null, now, now
      ]
    );
    return {
      id,
      tenantId: job.tenantId,
      jobNumber: job.jobNumber,
      customerId: job.customerId,
      customerName: job.customerName,
      vehicleId: job.vehicleId,
      vehicleSummary: job.vehicleSummary,
      status: job.status,
      priority: job.priority,
      mechanicId: job.mechanicId,
      mechanicName: job.mechanicName,
      estimatedHours: job.estimatedHours,
      notes: job.notes,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateStatus(id: string, status: ServiceJob['status'], extras: Partial<{ actualHours: number; startedAt: number; completedAt: number }> = {}, tenantId = getCurrentTenantId()): Promise<void> {
    const now = Date.now();
    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = { status, updated_at: now };
        if (extras.actualHours !== undefined) payload.actual_hours = extras.actualHours;
        if (extras.startedAt !== undefined) payload.started_at = extras.startedAt;
        if (extras.completedAt !== undefined) payload.completed_at = extras.completedAt;

        await supabase.from('service_jobs').update(payload).eq('id', id).eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('[db] Supabase updateStatus error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET status = ?, actual_hours = COALESCE(?, actual_hours), started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at), updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [status, extras.actualHours ?? null, extras.startedAt ?? null, extras.completedAt ?? null, now, id, tenantId]
    );
  },

  async update(id: string, data: Partial<ServiceJob>, tenantId = getCurrentTenantId()): Promise<void> {
    const now = Date.now();
    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = { updated_at: now };
        if (data.customerName !== undefined) payload.customer_name = data.customerName;
        if (data.vehicleSummary !== undefined) payload.vehicle_summary = data.vehicleSummary;
        if (data.status !== undefined) payload.status = data.status;
        if (data.priority !== undefined) payload.priority = data.priority;
        if (data.mechanicName !== undefined) payload.mechanic_name = data.mechanicName;
        if (data.estimatedHours !== undefined) payload.estimated_hours = data.estimatedHours;
        if (data.notes !== undefined) payload.notes = data.notes;

        await supabase.from('service_jobs').update(payload).eq('id', id).eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('[db] Supabase job update error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET customer_name = COALESCE(?, customer_name), vehicle_summary = COALESCE(?, vehicle_summary), status = COALESCE(?, status), priority = COALESCE(?, priority), mechanic_name = COALESCE(?, mechanic_name), estimated_hours = COALESCE(?, estimated_hours), notes = COALESCE(?, notes), updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [data.customerName ?? null, data.vehicleSummary ?? null, data.status ?? null,
       data.priority ?? null, data.mechanicName ?? null, data.estimatedHours ?? null,
       data.notes ?? null, now, id, tenantId]
    );
  },

  async nextJobNumber(tenantId = getCurrentTenantId()): Promise<string> {
    if (isSupabaseConfigured()) {
      try {
        const { count } = await supabase
          .from('service_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        const n = (count || 0) + 1;
        return `JOB-${String(n).padStart(3, '0')}`;
      } catch (err) {
        console.warn('[db] Supabase nextJobNumber error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT COUNT(*) as count FROM service_jobs WHERE tenant_id = ?', [tenantId]);
    const n = (rows[0]?.count || 0) + 1;
    return `JOB-${String(n).padStart(3, '0')}`;
  },

  async getStats(tenantId = getCurrentTenantId()): Promise<{ active: number; pending: number; completedToday: number; revenue: number }> {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    if (isSupabaseConfigured()) {
      try {
        const [activeRes, pendingRes, compRes, invRes] = await Promise.all([
          supabase.from('service_jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'in_progress'),
          supabase.from('service_jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending'),
          supabase.from('service_jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed').gte('completed_at', todayStart.getTime()),
          supabase.from('auto_care_invoices').select('total').eq('tenant_id', tenantId).gte('created_at', todayStart.getTime()),
        ]);

        const rev = (invRes.data || []).reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
        return {
          active: activeRes.count || 0,
          pending: pendingRes.count || 0,
          completedToday: compRes.count || 0,
          revenue: rev,
        };
      } catch (err) {
        console.warn('[db] Supabase getStats error:', err);
      }
    }

    const db = await getDatabase();
    const [active, pending, completedToday] = await Promise.all([
      db.select<any[]>("SELECT COUNT(*) as c FROM service_jobs WHERE tenant_id=? AND status='in_progress'", [tenantId]),
      db.select<any[]>("SELECT COUNT(*) as c FROM service_jobs WHERE tenant_id=? AND status='pending'", [tenantId]),
      db.select<any[]>('SELECT COUNT(*) as c FROM service_jobs WHERE tenant_id=? AND status=\'completed\' AND completed_at >= ?', [tenantId, todayStart.getTime()]),
    ]);
    const rev = await db.select<any[]>('SELECT COALESCE(SUM(total),0) as r FROM auto_care_invoices WHERE tenant_id=? AND created_at >= ?', [tenantId, todayStart.getTime()]);
    return { active: active[0]?.c || 0, pending: pending[0]?.c || 0, completedToday: completedToday[0]?.c || 0, revenue: rev[0]?.r || 0 };
  },
};

export const serviceRepo = {
  async findAll(tenantId = getCurrentTenantId()): Promise<AutoCareService[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('auto_care_services')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', 1)
          .order('name');

        if (!error && data) {
          return data.map(mapService);
        }
      } catch (err) {
        console.warn('[db] Supabase services findAll error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM auto_care_services WHERE tenant_id = ? AND is_active = 1 ORDER BY category, name', [tenantId]);
    return rows.map(mapService);
  },
};

export const vehicleRepo = {
  async findAll(tenantId = getCurrentTenantId()): Promise<Vehicle[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('make');

        if (!error && data) {
          return data.map(mapVehicle);
        }
      } catch (err) {
        console.warn('[db] Supabase vehicles findAll error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY make, model', [tenantId]);
    return rows.map(mapVehicle);
  },

  async create(v: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    const id = crypto.randomUUID();
    const now = Date.now();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('vehicles').upsert({
          id,
          tenant_id: v.tenantId,
          customer_id: v.customerId || null,
          customer_name: v.customerName || null,
          make: v.make,
          model: v.model,
          year: v.year,
          license_plate: v.licensePlate,
          vin: v.vin || null,
          color: v.color || null,
          mileage: v.mileage || null,
          notes: v.notes || null,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('[db] Supabase vehicle create error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO vehicles (id, tenant_id, customer_id, customer_name, make, model, year, license_plate, vin, color, mileage, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, v.tenantId, v.customerId||null, v.customerName||null, v.make, v.model, v.year, v.licensePlate, v.vin||null, v.color||null, v.mileage||null, v.notes||null, now, now]
    );

    return {
      id,
      tenantId: v.tenantId,
      customerId: v.customerId,
      customerName: v.customerName,
      make: v.make,
      model: v.model,
      year: v.year,
      licensePlate: v.licensePlate,
      vin: v.vin,
      color: v.color,
      mileage: v.mileage,
      notes: v.notes,
      createdAt: now,
      updatedAt: now,
    };
  },
};

export const invoiceRepo = {
  async create(inv: Omit<AutoCareInvoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutoCareInvoice> {
    const id = crypto.randomUUID();
    const now = Date.now();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('auto_care_invoices').upsert({
          id,
          tenant_id: inv.tenantId,
          invoice_number: inv.invoiceNumber,
          job_id: inv.jobId || null,
          job_number: inv.jobNumber || null,
          customer_id: inv.customerId || null,
          customer_name: inv.customerName,
          vehicle_summary: inv.vehicleSummary || null,
          items: JSON.stringify(inv.items),
          subtotal: inv.subtotal,
          discount: inv.discount,
          tax: inv.tax,
          total: inv.total,
          payment_method: inv.paymentMethod,
          status: inv.status,
          notes: inv.notes || null,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('[db] Supabase invoice create error:', err);
      }
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO auto_care_invoices (id, tenant_id, invoice_number, job_id, job_number, customer_id, customer_name, vehicle_summary, items, subtotal, discount, tax, total, payment_method, status, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, inv.tenantId, inv.invoiceNumber, inv.jobId||null, inv.jobNumber||null,
       inv.customerId||null, inv.customerName, inv.vehicleSummary||null,
       JSON.stringify(inv.items), inv.subtotal, inv.discount, inv.tax, inv.total,
       inv.paymentMethod, inv.status, inv.notes||null, now, now]
    );

    return {
      id,
      tenantId: inv.tenantId,
      invoiceNumber: inv.invoiceNumber,
      jobId: inv.jobId,
      jobNumber: inv.jobNumber,
      customerId: inv.customerId,
      customerName: inv.customerName,
      vehicleSummary: inv.vehicleSummary,
      items: inv.items,
      subtotal: inv.subtotal,
      discount: inv.discount,
      tax: inv.tax,
      total: inv.total,
      paymentMethod: inv.paymentMethod,
      status: inv.status,
      notes: inv.notes,
      createdAt: now,
      updatedAt: now,
    };
  },

  async nextInvoiceNumber(tenantId = getCurrentTenantId()): Promise<string> {
    if (isSupabaseConfigured()) {
      try {
        const { count } = await supabase
          .from('auto_care_invoices')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        const n = (count || 0) + 1;
        return `INV-${String(n).padStart(4, '0')}`;
      } catch (err) {
        console.warn('[db] Supabase nextInvoiceNumber error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT COUNT(*) as count FROM auto_care_invoices WHERE tenant_id = ?', [tenantId]);
    const n = (rows[0]?.count || 0) + 1;
    return `INV-${String(n).padStart(4, '0')}`;
  },

  async findAll(tenantId = getCurrentTenantId()): Promise<AutoCareInvoice[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('auto_care_invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(mapInvoice);
        }
      } catch (err) {
        console.warn('[db] Supabase invoices findAll error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM auto_care_invoices WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
    return rows.map(mapInvoice);
  },
};

// ─── POSSale helper ────────────────────────────────────────────────────────────
export interface POSSaleInput {
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
  customerName?: string;
  customerId?: string;
  notes?: string;
}

export async function completePOSSale(
  input: POSSaleInput
): Promise<AutoCareInvoice> {
  if (input.paymentMethod === 'credit' && !input.customerName) {
    throw new Error('Customer name is required for credit sales.');
  }

  const tenantId = getCurrentTenantId();
  const now = Date.now();
  const invoiceNumber = await invoiceRepo.nextInvoiceNumber(tenantId);

  const invoiceItems: ServiceJobItem[] = input.items.map((item) => ({
    id: crypto.randomUUID(),
    jobId: '',
    type: 'part' as const,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    discount: 0,
    tax: 0,
    total: item.price * item.quantity,
    createdAt: now,
  }));

  const status: AutoCareInvoice['status'] =
    input.paymentMethod === 'credit' ? ('credit' as any) : 'paid';

  return await invoiceRepo.create({
    tenantId,
    invoiceNumber,
    jobId: undefined,
    jobNumber: undefined,
    customerId: input.customerId,
    customerName: input.customerName ?? 'Walk-in Customer',
    vehicleSummary: undefined,
    items: invoiceItems,
    subtotal: input.subtotal,
    discount: 0,
    tax: input.tax,
    total: input.total,
    paymentMethod: input.paymentMethod,
    status,
    notes: input.notes,
  });
}
