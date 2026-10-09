import { getDatabase, getCurrentTenantId } from './db';
import { getDeviceId } from './device';
import { stockMovementRepo } from './stock-movements';
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
    id: r.id || '',
    tenantId: r.tenant_id || '',
    jobNumber: r.job_number || '',
    customerId: r.customer_id || undefined,
    customerName: r.customer_name || '',
    vehicleId: r.vehicle_id || undefined,
    vehicleSummary: r.vehicle_summary || '',
    status: r.status || 'pending',
    priority: r.priority || 'normal',
    mechanicId: r.mechanic_id || undefined,
    mechanicName: r.mechanic_name || undefined,
    estimatedHours: r.estimated_hours != null ? Number(r.estimated_hours) : undefined,
    actualHours: r.actual_hours != null ? Number(r.actual_hours) : undefined,
    notes: r.notes || undefined,
    startedAt: r.started_at ? Number(r.started_at) : undefined,
    completedAt: r.completed_at ? Number(r.completed_at) : undefined,
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

function mapService(r: any): AutoCareService {
  if (!r) return {} as AutoCareService;
  return {
    id: r.id || '',
    tenantId: r.tenant_id || '',
    name: r.name || '',
    description: r.description || undefined,
    laborRate: Number(r.labor_rate || 0),
    estimatedHours: Number(r.estimated_hours || 0),
    category: r.category || 'general',
    isActive: r.is_active === 1,
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

function mapVehicle(r: any): Vehicle {
  if (!r) return {} as Vehicle;
  return {
    id: r.id || '',
    tenantId: r.tenant_id || '',
    customerId: r.customer_id || undefined,
    customerName: r.customer_name || undefined,
    make: r.make || '',
    model: r.model || '',
    year: Number(r.year || 0),
    licensePlate: r.license_plate || '',
    vin: r.vin || undefined,
    color: r.color || undefined,
    mileage: r.mileage != null ? Number(r.mileage) : undefined,
    notes: r.notes || undefined,
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

function mapInvoice(r: any): AutoCareInvoice {
  if (!r) return {} as AutoCareInvoice;
  return {
    id: r.id || '',
    tenantId: r.tenant_id || '',
    invoiceNumber: r.invoice_number || '',
    jobId: r.job_id || undefined,
    jobNumber: r.job_number || undefined,
    customerId: r.customer_id || undefined,
    customerName: r.customer_name || '',
    vehicleSummary: r.vehicle_summary || undefined,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    tax: Number(r.tax || 0),
    total: Number(r.total || 0),
    paymentMethod: r.payment_method || 'cash',
    status: r.status || 'paid',
    notes: r.notes || undefined,
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

// ─── POS Order types ──────────────────────────────────────────────────────────
export type POSOrderStatus = 'ONGOING' | 'PAID' | 'CANCELLED';

export interface POSOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  type: 'product' | 'service';
  subtotal: number;
}

export interface POSOrder {
  id: string;
  tenantId: string;
  orderNumber: number;
  status: POSOrderStatus;
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
  if (!r) return {} as POSOrder;
  return {
    id: r.id || '',
    tenantId: r.tenant_id || '',
    orderNumber: Number(r.order_number || 0),
    status: (r.status as POSOrderStatus) || 'ONGOING',
    customerName: r.customer_name ?? undefined,
    customerId: r.customer_id ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    subtotal: Number(r.subtotal || 0),
    tax: Number(r.tax || 0),
    total: Number(r.total || 0),
    paidAmount: r.paid_amount != null ? Number(r.paid_amount) : undefined,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
    notes: r.notes ?? undefined,
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

// ── POS Order Repository ──────────────────────────────────────────────────────
export const posOrderRepo = {
  /** Get next sequential order number (DB-side atomic using MAX) */
  async nextOrderNumber(tenantId = getCurrentTenantId()): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT COALESCE(MAX(order_number), 0) as max_num FROM pos_orders WHERE tenant_id = ?',
      [tenantId]
    );
    return (Number(rows[0]?.max_num) || 0) + 1;
  },

  async findAll(tenantId = getCurrentTenantId()): Promise<POSOrder[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM pos_orders WHERE tenant_id = ? ORDER BY order_number DESC',
      [tenantId]
    );
    return rows.map(mapPOSOrder);
  },

  async findById(id: string, tenantId = getCurrentTenantId()): Promise<POSOrder | null> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM pos_orders WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    return rows.length ? mapPOSOrder(rows[0]) : null;
  },

  /** Save a new ONGOING order (called when + button is pressed) */
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
    const now = Date.now();
    const id = crypto.randomUUID();
    const orderNumber = await this.nextOrderNumber(tenantId);

    const order: POSOrder = {
      id,
      tenantId,
      orderNumber,
      status: 'ONGOING',
      customerName: input.customerName,
      customerId: input.customerId,
      paymentMethod: undefined,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      paidAmount: undefined,
      items: input.items,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO pos_orders (id, tenant_id, order_number, status, customer_name, customer_id, payment_method, subtotal, tax, total, paid_amount, items, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        order.id, order.tenantId, order.orderNumber, order.status,
        order.customerName ?? null, order.customerId ?? null, null,
        order.subtotal, order.tax, order.total, null,
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
    /** If provided, this ONGOING order is updated to PAID instead of creating new */
    existingOrderId?: string;
  }): Promise<POSOrder> {
    const tenantId = input.tenantId ?? getCurrentTenantId();
    const now = Date.now();
    const db = await getDatabase();
    const deviceId = await getDeviceId();

    let finalOrder: POSOrder | null = null;

    await db.transaction(async (tx) => {
      // 1. Deduct stock atomically and write stock movements for all product items
      for (const item of input.items) {
        if (item.type !== 'service' && item.quantity > 0) {
          const rows = await tx.select<any[]>(
            'SELECT stock, name FROM products WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
            [item.id, tenantId]
          );
          const existing = rows[0];
          if (existing) {
            if (existing.stock < item.quantity) {
              throw new Error(
                `Insufficient stock for "${existing.name}". Available: ${existing.stock}, Requested: ${item.quantity}`
              );
            }
            await tx.execute(
              'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
              [item.quantity, now, item.id, tenantId]
            );

            // Record stock movement
            await stockMovementRepo.insert(
              {
                id: crypto.randomUUID(),
                tenantId,
                productId: item.id,
                quantityDelta: -item.quantity,
                movementType: 'SALE',
                referenceType: 'pos_order',
                referenceId: input.existingOrderId ?? 'pending-order',
                deviceId,
                notes: `Auto care sale of ${item.name}`,
                createdAt: now,
              },
              tx
            );
          }
        }
      }

      // 2. If an ongoing order exists, update it to PAID
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

      // 3. If no existing order or not found, create new PAID order
      if (!finalOrder) {
        const id = crypto.randomUUID();
        const maxRows = await tx.select<any[]>(
          'SELECT COALESCE(MAX(order_number), 0) as max_num FROM pos_orders WHERE tenant_id = ?',
          [tenantId]
        );
        const orderNumber = (Number(maxRows[0]?.max_num) || 0) + 1;

        finalOrder = {
          id,
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

      // 4. Atomically insert outbox mutation for future cloud synchronization
      if (finalOrder) {
        const idempotencyKey = `pos_order:${tenantId}:${finalOrder.id}`;
        await tx.execute(
          `INSERT INTO outbox (id, tenant_id, entity_type, entity_id, operation, payload, status, device_id, idempotency_key, version, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 1, ?)`,
          [
            crypto.randomUUID(),
            tenantId,
            'pos_order',
            (finalOrder as POSOrder).id,
            'create',
            JSON.stringify(finalOrder),
            deviceId,
            idempotencyKey,
            now,
          ]
        );
      }
    });

    if (!finalOrder) {
      throw new Error('Failed to create or finalize paid order');
    }

    return finalOrder;
  },

  /** Soft-delete: set status to CANCELLED (never physically delete PAID orders) */
  async cancel(id: string, tenantId = getCurrentTenantId()): Promise<void> {
    const now = Date.now();
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
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
    return rows.map(mapJob);
  },

  async findByStatus(status: string, tenantId = getCurrentTenantId()): Promise<ServiceJob[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC', [tenantId, status]);
    return rows.map(mapJob);
  },

  async findById(id: string, tenantId = getCurrentTenantId()): Promise<ServiceJob | null> {
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM service_jobs WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return rows.length ? mapJob(rows[0]) : null;
  },

  async create(job: Omit<ServiceJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceJob> {
    const db = await getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();
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
    return (await this.findById(id, job.tenantId))!;
  },

  async updateStatus(id: string, status: ServiceJob['status'], extras: Partial<{ actualHours: number; startedAt: number; completedAt: number }> = {}, tenantId = getCurrentTenantId()): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET status = ?, actual_hours = COALESCE(?, actual_hours), started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at), updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [status, extras.actualHours ?? null, extras.startedAt ?? null, extras.completedAt ?? null, Date.now(), id, tenantId]
    );
  },

  async update(id: string, data: Partial<ServiceJob>, tenantId = getCurrentTenantId()): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET customer_name = COALESCE(?, customer_name), vehicle_summary = COALESCE(?, vehicle_summary), status = COALESCE(?, status), priority = COALESCE(?, priority), mechanic_name = COALESCE(?, mechanic_name), estimated_hours = COALESCE(?, estimated_hours), notes = COALESCE(?, notes), updated_at = ? WHERE id = ? AND tenant_id = ?`,
      [data.customerName ?? null, data.vehicleSummary ?? null, data.status ?? null,
       data.priority ?? null, data.mechanicName ?? null, data.estimatedHours ?? null,
       data.notes ?? null, Date.now(), id, tenantId]
    );
  },

  async nextJobNumber(tenantId = getCurrentTenantId()): Promise<string> {
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT COUNT(*) as count FROM service_jobs WHERE tenant_id = ?', [tenantId]);
    const n = (rows[0]?.count || 0) + 1;
    return `JOB-${String(n).padStart(3, '0')}`;
  },

  async getStats(tenantId = getCurrentTenantId()): Promise<{ active: number; pending: number; completedToday: number; revenue: number }> {
    const db = await getDatabase();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
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
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM auto_care_services WHERE tenant_id = ? AND is_active = 1 ORDER BY category, name', [tenantId]);
    return rows.map(mapService);
  },
};

export const vehicleRepo = {
  async findAll(tenantId = getCurrentTenantId()): Promise<Vehicle[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY make, model', [tenantId]);
    return rows.map(mapVehicle);
  },

  async create(v: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    const db = await getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO vehicles (id, tenant_id, customer_id, customer_name, make, model, year, license_plate, vin, color, mileage, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, v.tenantId, v.customerId||null, v.customerName||null, v.make, v.model, v.year, v.licensePlate, v.vin||null, v.color||null, v.mileage||null, v.notes||null, now, now]
    );
    try {
      const rows = await db.select<any[]>('SELECT * FROM vehicles WHERE id = ? AND tenant_id = ?', [id, v.tenantId]);
      if (rows && rows[0]) {
        return mapVehicle(rows[0]);
      }
    } catch {
      // fallback
    }
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
    const db = await getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.execute(
      `INSERT INTO auto_care_invoices (id, tenant_id, invoice_number, job_id, job_number, customer_id, customer_name, vehicle_summary, items, subtotal, discount, tax, total, payment_method, status, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, inv.tenantId, inv.invoiceNumber, inv.jobId||null, inv.jobNumber||null,
       inv.customerId||null, inv.customerName, inv.vehicleSummary||null,
       JSON.stringify(inv.items), inv.subtotal, inv.discount, inv.tax, inv.total,
       inv.paymentMethod, inv.status, inv.notes||null, now, now]
    );
    try {
      const rows = await db.select<any[]>('SELECT * FROM auto_care_invoices WHERE id = ? AND tenant_id = ?', [id, inv.tenantId]);
      if (rows && rows[0]) {
        return mapInvoice(rows[0]);
      }
    } catch {
      // fallback
    }
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
    const db = await getDatabase();
    const rows = await db.select<any[]>('SELECT COUNT(*) as count FROM auto_care_invoices WHERE tenant_id = ?', [tenantId]);
    const n = (rows[0]?.count || 0) + 1;
    return `INV-${String(n).padStart(4, '0')}`;
  },

  async findAll(tenantId = getCurrentTenantId()): Promise<AutoCareInvoice[]> {
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

  const invoiceItems: ServiceJobItem[] = input.items.map((item, i) => ({
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
