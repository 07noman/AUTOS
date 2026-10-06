import { getDatabase, TENANT_ID, getCurrentTenantId } from './db';
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

  // Seed demo services if empty
  const svcCount = await db.select<any[]>('SELECT COUNT(*) as count FROM auto_care_services WHERE tenant_id = ?', [TENANT_ID]);
  if ((svcCount[0]?.count || 0) === 0) {
    const now = Date.now();
    const services = [
      { id: 'svc-1', name: 'Oil Change', desc: 'Engine oil and filter replacement', rate: 80, hours: 0.5, cat: 'maintenance' },
      { id: 'svc-2', name: 'Brake Repair', desc: 'Brake pad/rotor inspection and replacement', rate: 100, hours: 2.5, cat: 'brakes' },
      { id: 'svc-3', name: 'AC Repair', desc: 'Air conditioning system diagnosis and repair', rate: 90, hours: 3, cat: 'electrical' },
      { id: 'svc-4', name: 'Tire Rotation', desc: 'Rotate and balance all four tires', rate: 70, hours: 0.5, cat: 'tires' },
      { id: 'svc-5', name: 'Engine Diagnostics', desc: 'Full engine computer diagnostic scan', rate: 85, hours: 1, cat: 'diagnostics' },
      { id: 'svc-6', name: 'Wheel Alignment', desc: 'Four-wheel alignment adjustment', rate: 80, hours: 1, cat: 'tires' },
      { id: 'svc-7', name: 'Battery Replacement', desc: 'Battery test and replacement', rate: 70, hours: 0.5, cat: 'electrical' },
      { id: 'svc-8', name: 'Transmission Service', desc: 'Transmission fluid change and filter', rate: 110, hours: 2, cat: 'transmission' },
    ];
    for (const s of services) {
      await db.execute(
        `INSERT INTO auto_care_services (id, tenant_id, name, description, labor_rate, estimated_hours, category, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)`,
        [s.id, TENANT_ID, s.name, s.desc, s.rate, s.hours, s.cat, now, now]
      );
    }
  }

  // Seed demo jobs if empty
  const jobCount = await db.select<any[]>('SELECT COUNT(*) as count FROM service_jobs WHERE tenant_id = ?', [TENANT_ID]);
  if ((jobCount[0]?.count || 0) === 0) {
    const now = Date.now();
    const jobs = [
      { id: 'job-1', num: 'JOB-001', cust: 'John Smith', veh: '2020 Toyota Camry', status: 'in_progress', pri: 'high', mech: 'Mike Johnson', est: 2, act: 1.5 },
      { id: 'job-2', num: 'JOB-002', cust: 'Sarah Williams', veh: '2019 Honda Civic', status: 'pending', pri: 'high', mech: null, est: 3, act: null },
      { id: 'job-3', num: 'JOB-003', cust: 'Bob Martinez', veh: '2018 Ford F-150', status: 'waiting_parts', pri: 'normal', mech: 'Alex Chen', est: 4, act: null },
      { id: 'job-4', num: 'JOB-004', cust: 'Lisa Johnson', veh: '2021 Chevrolet Malibu', status: 'completed', pri: 'low', mech: 'Mike Johnson', est: 1, act: 0.75 },
    ];
    for (const j of jobs) {
      await db.execute(
        `INSERT INTO service_jobs (id, tenant_id, job_number, customer_name, vehicle_summary, status, priority, mechanic_name, estimated_hours, actual_hours, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [j.id, TENANT_ID, j.num, j.cust, j.veh, j.status, j.pri, j.mech, j.est, j.act, now, now]
      );
    }
  }

  // Seed demo vehicles if empty
  const vehCount = await db.select<any[]>('SELECT COUNT(*) as count FROM vehicles WHERE tenant_id = ?', [TENANT_ID]);
  if ((vehCount[0]?.count || 0) === 0) {
    const now = Date.now();
    const vehicles = [
      { id: 'veh-1', make: 'Toyota', model: 'Camry', year: 2020, plate: 'ABC-1234', cust: 'John Smith', color: 'Silver', mileage: 45000 },
      { id: 'veh-2', make: 'Honda', model: 'Civic', year: 2019, plate: 'XYZ-5678', cust: 'Sarah Williams', color: 'Blue', mileage: 62000 },
      { id: 'veh-3', make: 'Ford', model: 'F-150', year: 2018, plate: 'LMN-9012', cust: 'Bob Martinez', color: 'Black', mileage: 89000 },
    ];
    for (const v of vehicles) {
      await db.execute(
        `INSERT INTO vehicles (id, tenant_id, customer_name, make, model, year, license_plate, color, mileage, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [v.id, TENANT_ID, v.cust, v.make, v.model, v.year, v.plate, v.color, v.mileage, now, now]
      );
    }
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapJob(r: any): ServiceJob {
  return {
    id: r.id, tenantId: r.tenant_id, jobNumber: r.job_number,
    customerId: r.customer_id, customerName: r.customer_name,
    vehicleId: r.vehicle_id, vehicleSummary: r.vehicle_summary,
    status: r.status, priority: r.priority,
    mechanicId: r.mechanic_id, mechanicName: r.mechanic_name,
    estimatedHours: r.estimated_hours, actualHours: r.actual_hours,
    notes: r.notes, startedAt: r.started_at, completedAt: r.completed_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapService(r: any): AutoCareService {
  return {
    id: r.id, tenantId: r.tenant_id, name: r.name, description: r.description,
    laborRate: r.labor_rate, estimatedHours: r.estimated_hours,
    category: r.category, isActive: r.is_active === 1,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapVehicle(r: any): Vehicle {
  return {
    id: r.id, tenantId: r.tenant_id, customerId: r.customer_id,
    customerName: r.customer_name, make: r.make, model: r.model,
    year: r.year, licensePlate: r.license_plate, vin: r.vin,
    color: r.color, mileage: r.mileage, notes: r.notes,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapInvoice(r: any): AutoCareInvoice {
  return {
    id: r.id, tenantId: r.tenant_id, invoiceNumber: r.invoice_number,
    jobId: r.job_id, jobNumber: r.job_number,
    customerId: r.customer_id, customerName: r.customer_name,
    vehicleSummary: r.vehicle_summary,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
    subtotal: r.subtotal, discount: r.discount, tax: r.tax, total: r.total,
    paymentMethod: r.payment_method, status: r.status, notes: r.notes,
    createdAt: r.created_at, updatedAt: r.updated_at,
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
  return {
    id: r.id,
    tenantId: r.tenant_id,
    orderNumber: Number(r.order_number),
    status: r.status as POSOrderStatus,
    customerName: r.customer_name ?? undefined,
    customerId: r.customer_id ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    total: Number(r.total),
    paidAmount: r.paid_amount != null ? Number(r.paid_amount) : undefined,
    items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
    notes: r.notes ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
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
    const tenantId = input.tenantId ?? TENANT_ID;
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
    const tenantId = input.tenantId ?? TENANT_ID;
    const now = Date.now();
    const db = await getDatabase();

    // If an ongoing order exists, update it
    if (input.existingOrderId) {
      await db.execute(
        `UPDATE pos_orders SET status='PAID', payment_method=?, paid_amount=?, subtotal=?, tax=?, total=?, items=?, customer_name=?, customer_id=?, updated_at=? WHERE id=? AND tenant_id=?`,
        [
          input.paymentMethod, input.paidAmount,
          input.subtotal, input.tax, input.total,
          JSON.stringify(input.items),
          input.customerName ?? null, input.customerId ?? null,
          now, input.existingOrderId, tenantId,
        ]
      );
      const updated = await this.findById(input.existingOrderId, tenantId);
      if (updated) return updated;
    }

    // Create new PAID order
    const id = crypto.randomUUID();
    const orderNumber = await this.nextOrderNumber(tenantId);

    const order: POSOrder = {
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

    await db.execute(
      `INSERT INTO pos_orders (id, tenant_id, order_number, status, customer_name, customer_id, payment_method, subtotal, tax, total, paid_amount, items, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        order.id, order.tenantId, order.orderNumber, order.status,
        order.customerName ?? null, order.customerId ?? null, order.paymentMethod,
        order.subtotal, order.tax, order.total, order.paidAmount,
        JSON.stringify(order.items), order.notes ?? null,
        order.createdAt, order.updatedAt,
      ]
    );

    return order;
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

  async findByStatus(tenantId = TENANT_ID, status: string): Promise<ServiceJob[]> {
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
      [id, job.tenantId, job.jobNumber, job.customerId || null, job.customerName,
       job.vehicleId || null, job.vehicleSummary, job.status, job.priority,
       job.mechanicId || null, job.mechanicName || null, job.estimatedHours || null,
       job.notes || null, now, now]
    );
    return (await this.findById(id))!;
  },

  async updateStatus(id: string, status: ServiceJob['status'], extras: Partial<{ actualHours: number; startedAt: number; completedAt: number }> = {}): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET status = ?, actual_hours = COALESCE(?, actual_hours), started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at), updated_at = ? WHERE id = ?`,
      [status, extras.actualHours ?? null, extras.startedAt ?? null, extras.completedAt ?? null, Date.now(), id]
    );
  },

  async update(id: string, data: Partial<ServiceJob>): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE service_jobs SET customer_name = COALESCE(?, customer_name), vehicle_summary = COALESCE(?, vehicle_summary), status = COALESCE(?, status), priority = COALESCE(?, priority), mechanic_name = COALESCE(?, mechanic_name), estimated_hours = COALESCE(?, estimated_hours), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`,
      [data.customerName ?? null, data.vehicleSummary ?? null, data.status ?? null,
       data.priority ?? null, data.mechanicName ?? null, data.estimatedHours ?? null,
       data.notes ?? null, Date.now(), id]
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
    const rows = await db.select<any[]>('SELECT * FROM vehicles WHERE id = ?', [id]);
    return mapVehicle(rows[0]);
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
    const rows = await db.select<any[]>('SELECT * FROM auto_care_invoices WHERE id = ?', [id]);
    return mapInvoice(rows[0]);
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
interface POSSaleInput {
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

  const now = Date.now();
  const id = crypto.randomUUID();

  // ── Browser/dev fallback ─────────────────────────────────────────────────
  const buildSyntheticInvoice = (invNumber: string): AutoCareInvoice => {
    const invoiceItems: ServiceJobItem[] = input.items.map((item, i) => ({
      id: `item-${i}`,
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

    return {
      id,
      tenantId: TENANT_ID,
      invoiceNumber: invNumber,
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
      status: input.paymentMethod === 'credit' ? ('credit' as AutoCareInvoice['status']) : 'paid',
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
  };

  // ── Try real DB (Tauri) ──────────────────────────────────────────────────
  try {
    const invoiceNumber = await invoiceRepo.nextInvoiceNumber(TENANT_ID);

    const invoiceItems = input.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
    }));

    const status: AutoCareInvoice['status'] =
      input.paymentMethod === 'credit'
        ? ('credit' as AutoCareInvoice['status'])
        : 'paid';

    return await invoiceRepo.create({
      tenantId: TENANT_ID,
      invoiceNumber,
      jobId: undefined,
      jobNumber: undefined,
      customerId: input.customerId,
      customerName: input.customerName ?? 'Walk-in Customer',
      vehicleSummary: undefined,
      items: invoiceItems as any,
      subtotal: input.subtotal,
      discount: 0,
      tax: input.tax,
      total: input.total,
      paymentMethod: input.paymentMethod,
      status,
      notes: input.notes,
    });
  } catch (dbErr) {
    // DB not available (browser/dev mode without Tauri) — return in-memory invoice
    console.warn('[Auto-Care] DB unavailable, using in-memory invoice:', dbErr);
    const n = Math.floor(Math.random() * 9000) + 1000;
    return buildSyntheticInvoice(`INV-${n}`);
  }
}
