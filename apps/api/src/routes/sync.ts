import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  products, orders, orderItems, customers,
  vehicles, autoCareServices, serviceJobs, serviceJobItems, autoCareInvoices,
  outbox,
} from '../../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ─── Schema ───────────────────────────────────────────────────────────────────

const pushSchema = z.object({
  changes: z.array(
    z.object({
      id: z.string(),
      entity_type: z.string(),
      entity_id: z.string(),
      operation: z.enum(['create', 'update', 'delete']),
      payload: z.record(z.unknown()),
      client_timestamp: z.number(),
    })
  ),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  // Allow dev bypass (never enabled in production)
  if (process.env.NODE_ENV !== 'production' && auth === 'Bearer offline-dev') {
    (request as any).tenantId = process.env.DEV_TENANT_ID || 'dev-tenant';
    return;
  }
  try {
    await request.jwtVerify();
    const user = request.user as { tenant_id: string };
    (request as any).tenantId = user.tenant_id;
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// ─── Apply a single change to PostgreSQL ─────────────────────────────────────

async function applyChange(
  tenantId: string,
  entityType: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  switch (entityType) {
    // ── Products ──────────────────────────────────────────────────────────────
    case 'product': {
      if (operation === 'delete') {
        await db.update(products)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(products.id, entityId), eq(products.tenantId, tenantId)));
        break;
      }
      const p = payload as any;
      const productData = {
        id: entityId,
        tenantId,
        sku: p.sku,
        name: p.name,
        description: p.description ?? null,
        barcode: p.barcode ?? null,
        categoryId: p.categoryId ?? p.category_id ?? null,
        costPrice: String(p.costPrice ?? p.cost_price ?? 0),
        sellingPrice: String(p.sellingPrice ?? p.selling_price ?? 0),
        wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : null,
        stock: Number(p.stock ?? 0),
        minimumStock: Number(p.minimumStock ?? p.minimum_stock ?? 0),
        status: (p.status ?? 'active') as 'active' | 'inactive' | 'archived',
        images: p.images ? JSON.stringify(p.images) : null,
        metadata: p.metadata ? JSON.stringify(p.metadata) : null,
        updatedAt: new Date(),
      };
      await db.insert(products).values(productData)
        .onConflictDoUpdate({ target: products.id, set: { ...productData, createdAt: undefined } });
      break;
    }

    // ── Orders ────────────────────────────────────────────────────────────────
    case 'order': {
      if (operation === 'delete') break; // Orders are never deleted
      const o = payload as any;
      const orderData = {
        id: entityId,
        tenantId,
        orderNumber: o.orderNumber ?? o.order_number ?? entityId.substring(0, 8),
        customerId: o.customerId ?? o.customer_id ?? null,
        subtotal: String(o.subtotal ?? 0),
        discount: String(o.discount ?? 0),
        tax: String(o.tax ?? 0),
        total: String(o.total ?? 0),
        paymentMethod: (o.paymentMethod ?? o.payment_method ?? 'cash') as 'cash' | 'card' | 'mobile' | 'credit',
        status: (o.status ?? 'completed') as 'completed' | 'held' | 'suspended' | 'refunded',
        notes: o.notes ?? null,
        updatedAt: new Date(),
      };
      await db.insert(orders).values(orderData)
        .onConflictDoUpdate({ target: orders.id, set: { ...orderData, createdAt: undefined } });
      break;
    }

    // ── Vehicles ──────────────────────────────────────────────────────────────
    case 'vehicle': {
      if (operation === 'delete') break;
      const v = payload as any;
      const vehicleData = {
        id: entityId,
        tenantId,
        customerId: v.customerId ?? v.customer_id ?? null,
        customerName: v.customerName ?? v.customer_name ?? null,
        make: v.make,
        model: v.model,
        year: Number(v.year),
        licensePlate: v.licensePlate ?? v.license_plate,
        vin: v.vin ?? null,
        color: v.color ?? null,
        mileage: v.mileage != null ? Number(v.mileage) : null,
        notes: v.notes ?? null,
        updatedAt: new Date(),
      };
      await db.insert(vehicles).values(vehicleData)
        .onConflictDoUpdate({ target: vehicles.id, set: { ...vehicleData, createdAt: undefined } });
      break;
    }

    // ── Service Jobs ──────────────────────────────────────────────────────────
    case 'service_job': {
      if (operation === 'delete') break;
      const j = payload as any;
      const jobData = {
        id: entityId,
        tenantId,
        jobNumber: j.jobNumber ?? j.job_number,
        customerId: j.customerId ?? j.customer_id ?? null,
        customerName: j.customerName ?? j.customer_name,
        vehicleId: j.vehicleId ?? j.vehicle_id ?? null,
        vehicleSummary: j.vehicleSummary ?? j.vehicle_summary,
        status: j.status ?? 'pending',
        priority: j.priority ?? 'normal',
        mechanicId: j.mechanicId ?? j.mechanic_id ?? null,
        mechanicName: j.mechanicName ?? j.mechanic_name ?? null,
        estimatedHours: j.estimatedHours != null ? String(j.estimatedHours) : null,
        actualHours: j.actualHours != null ? String(j.actualHours) : null,
        notes: j.notes ?? null,
        startedAt: j.startedAt ? new Date(j.startedAt) : null,
        completedAt: j.completedAt ? new Date(j.completedAt) : null,
        updatedAt: new Date(),
      };
      await db.insert(serviceJobs).values(jobData)
        .onConflictDoUpdate({ target: serviceJobs.id, set: { ...jobData, createdAt: undefined } });
      break;
    }

    // ── Auto Care Invoices ────────────────────────────────────────────────────
    case 'auto_care_invoice': {
      if (operation === 'delete') break;
      const i = payload as any;
      const invData = {
        id: entityId,
        tenantId,
        invoiceNumber: i.invoiceNumber ?? i.invoice_number,
        jobId: i.jobId ?? i.job_id ?? null,
        jobNumber: i.jobNumber ?? i.job_number ?? null,
        customerId: i.customerId ?? i.customer_id ?? null,
        customerName: i.customerName ?? i.customer_name,
        vehicleSummary: i.vehicleSummary ?? i.vehicle_summary ?? null,
        items: typeof i.items === 'string' ? i.items : JSON.stringify(i.items ?? []),
        subtotal: String(i.subtotal ?? 0),
        discount: String(i.discount ?? 0),
        tax: String(i.tax ?? 0),
        total: String(i.total ?? 0),
        paymentMethod: i.paymentMethod ?? i.payment_method ?? 'cash',
        status: i.status ?? 'paid',
        notes: i.notes ?? null,
        updatedAt: new Date(),
      };
      await db.insert(autoCareInvoices).values(invData)
        .onConflictDoUpdate({ target: autoCareInvoices.id, set: { ...invData, createdAt: undefined } });
      break;
    }

    // ── Auto Care Services ────────────────────────────────────────────────────
    case 'auto_care_service': {
      if (operation === 'delete') break;
      const s = payload as any;
      const svcData = {
        id: entityId,
        tenantId,
        name: s.name,
        description: s.description ?? null,
        laborRate: String(s.laborRate ?? s.labor_rate ?? 80),
        estimatedHours: String(s.estimatedHours ?? s.estimated_hours ?? 1),
        category: s.category ?? 'general',
        isActive: s.isActive ?? s.is_active ?? 1,
        updatedAt: new Date(),
      };
      await db.insert(autoCareServices).values(svcData)
        .onConflictDoUpdate({ target: autoCareServices.id, set: { ...svcData, createdAt: undefined } });
      break;
    }

    // ── Customers ─────────────────────────────────────────────────────────────
    case 'customer': {
      if (operation === 'delete') break;
      const c = payload as any;
      const custData = {
        id: entityId,
        tenantId,
        name: c.name,
        phone: c.phone ?? null,
        email: c.email ?? null,
        address: c.address ?? null,
        balance: String(c.balance ?? 0),
        creditLimit: String(c.creditLimit ?? c.credit_limit ?? 0),
        updatedAt: new Date(),
      };
      await db.insert(customers).values(custData)
        .onConflictDoUpdate({ target: customers.id, set: { ...custData, createdAt: undefined } });
      break;
    }

    default:
      // Unknown entity type — log and skip (don't fail the whole batch)
      console.warn(`[sync] Unknown entity_type: ${entityType}`);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function syncRoutes(server: FastifyInstance) {
  /**
   * POST /api/v1/sync/push
   * Desktop sends pending outbox entries. Server writes them to PostgreSQL.
   */
  server.post(
    '/sync/push',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = pushSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
      }

      const tenantId = (request as any).tenantId as string;
      const synced: string[] = [];
      const errors: { id: string; error: string }[] = [];

      for (const change of parsed.data.changes) {
        try {
          await applyChange(
            tenantId,
            change.entity_type,
            change.entity_id,
            change.operation,
            change.payload as Record<string, unknown>
          );
          synced.push(change.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[sync] Failed to apply change ${change.id} (${change.entity_type}/${change.entity_id}):`, msg);
          errors.push({ id: change.id, error: msg });
        }
      }

      return reply.send({ synced, conflicts: [], errors });
    }
  );

  /**
   * GET /api/v1/sync/pull
   * Desktop pulls any changes from the server since last sync.
   * (Full implementation with timestamp-based delta requires a server-side outbox.)
   */
  server.get(
    '/sync/pull',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const sinceParam = (request.query as any)?.since;
      const since = sinceParam ? new Date(Number(sinceParam)) : new Date(0);

      // Return any outbox entries the server has queued for this tenant
      const pending = await db.select().from(outbox)
        .where(
          and(
            eq(outbox.tenantId, tenantId),
            eq(outbox.status, 'pending')
          )
        )
        .limit(200);

      return reply.send({
        changes: pending.map(e => ({
          id: e.id,
          entity_type: e.entityType,
          entity_id: e.entityId,
          operation: e.operation,
          payload: JSON.parse(e.payload),
          server_timestamp: e.createdAt?.getTime() ?? Date.now(),
        })),
        deletes: [],
        last_timestamp: Date.now(),
      });
    }
  );
}
