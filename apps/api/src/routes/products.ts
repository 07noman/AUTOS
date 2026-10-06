import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { products, categories } from '../../drizzle/schema.js';
import { eq, and, isNull, or, ilike, sql } from 'drizzle-orm';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const user = request.user as { tenant_id: string };
    (request as any).tenantId = user.tenant_id;
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  wholesalePrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(0),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  images: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProductSchema = createProductSchema.partial();

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function productsRoutes(server: FastifyInstance) {
  const preHandler = [authenticate];

  /**
   * GET /api/v1/products
   * List all active products for the authenticated tenant.
   */
  server.get(
    '/products',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const q = (request.query as any)?.q;

      let query = db
        .select()
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            isNull(products.deletedAt),
            q
              ? or(
                  ilike(products.name, `%${q}%`),
                  ilike(products.sku, `%${q}%`),
                  ilike(products.barcode, `%${q}%`)
                )
              : undefined
          )
        )
        .orderBy(products.name) as any;

      const rows = await query;
      return reply.send({ products: rows });
    }
  );

  /**
   * GET /api/v1/products/:id
   */
  server.get(
    '/products/:id',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const { id } = request.params as { id: string };
      const [product] = await db.select().from(products)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId), isNull(products.deletedAt)));
      if (!product) return reply.code(404).send({ error: 'Product not found' });
      return reply.send({ product });
    }
  );

  /**
   * POST /api/v1/products
   */
  server.post(
    '/products',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const parsed = createProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
      }
      const d = parsed.data;
      const [created] = await db.insert(products).values({
        tenantId,
        sku: d.sku,
        name: d.name,
        description: d.description ?? null,
        barcode: d.barcode ?? null,
        categoryId: d.categoryId ?? null,
        costPrice: String(d.costPrice),
        sellingPrice: String(d.sellingPrice),
        wholesalePrice: d.wholesalePrice != null ? String(d.wholesalePrice) : null,
        stock: d.stock,
        minimumStock: d.minimumStock,
        status: d.status,
        images: d.images ? JSON.stringify(d.images) : null,
        metadata: d.metadata ? JSON.stringify(d.metadata) : null,
      }).returning();
      return reply.code(201).send({ product: created });
    }
  );

  /**
   * PATCH /api/v1/products/:id
   */
  server.patch(
    '/products/:id',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const { id } = request.params as { id: string };
      const parsed = updateProductSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
      }
      const d = parsed.data;
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (d.name !== undefined) updates.name = d.name;
      if (d.sku !== undefined) updates.sku = d.sku;
      if (d.description !== undefined) updates.description = d.description;
      if (d.barcode !== undefined) updates.barcode = d.barcode;
      if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
      if (d.costPrice !== undefined) updates.costPrice = String(d.costPrice);
      if (d.sellingPrice !== undefined) updates.sellingPrice = String(d.sellingPrice);
      if (d.wholesalePrice !== undefined) updates.wholesalePrice = String(d.wholesalePrice);
      if (d.stock !== undefined) updates.stock = d.stock;
      if (d.minimumStock !== undefined) updates.minimumStock = d.minimumStock;
      if (d.status !== undefined) updates.status = d.status;
      if (d.images !== undefined) updates.images = JSON.stringify(d.images);
      if (d.metadata !== undefined) updates.metadata = JSON.stringify(d.metadata);

      const [updated] = await db.update(products).set(updates)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId), isNull(products.deletedAt)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'Product not found' });
      return reply.send({ product: updated });
    }
  );

  /**
   * DELETE /api/v1/products/:id (soft delete)
   */
  server.delete(
    '/products/:id',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const { id } = request.params as { id: string };
      await db.update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
      return reply.code(204).send();
    }
  );

  /**
   * GET /api/v1/products/low-stock
   * Products at or below minimumStock
   */
  server.get(
    '/products/low-stock',
    { preHandler } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = (request as any).tenantId as string;
      const rows = await db.select().from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            isNull(products.deletedAt),
            sql`${products.stock} <= ${products.minimumStock}`
          )
        )
        .orderBy(products.stock);
      return reply.send({ products: rows });
    }
  );
}
