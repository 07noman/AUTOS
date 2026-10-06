import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { products, auditLog } from '../../drizzle/schema.js';

// Inline Product type (mirrors @genx/types to avoid workspace dep resolution issues)
type Product = {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  stock: number;
  minimumStock: number;
  status: 'active' | 'inactive' | 'archived';
  images?: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export const productService = {
  async findAll(tenantId: string, options?: {
    search?: string;
    categoryId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Product[]> {
    const conditions = [eq(products.tenantId, tenantId)];

    if (options?.search) {
      conditions.push(
        or(
          like(products.name, `%${options.search}%`),
          like(products.sku, `%${options.search}%`),
          like(products.barcode!, `%${options.search}%`)
        ) as any
      );
    }

    if (options?.categoryId) {
      conditions.push(eq(products.categoryId, options.categoryId));
    }

    if (options?.status) {
      conditions.push(eq(products.status, options.status as any));
    }

    const query = db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.name))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);

    const rows = await query;
    return rows.map(mapToProduct);
  },

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.tenantId, tenantId)
        )
      );

    return row ? mapToProduct(row) : null;
  },

  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const insertValues: any = {
      ...data,
      id: crypto.randomUUID(),
      costPrice: data.costPrice !== undefined ? String(data.costPrice) : undefined,
      sellingPrice: data.sellingPrice !== undefined ? String(data.sellingPrice) : undefined,
      wholesalePrice: data.wholesalePrice !== undefined ? String(data.wholesalePrice) : undefined,
      images: data.images ? JSON.stringify(data.images) : undefined,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [row] = await db
      .insert(products)
      .values(insertValues)
      .returning();

    // Record in audit log
    await this.logAudit(data.tenantId, 'create', row);

    return mapToProduct(row);
  },

  async update(tenantId: string, id: string, data: Partial<Product>): Promise<Product> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new Error('Product not found');
    }

    const updateValues: any = {
      ...data,
      costPrice: data.costPrice !== undefined ? String(data.costPrice) : undefined,
      sellingPrice: data.sellingPrice !== undefined ? String(data.sellingPrice) : undefined,
      wholesalePrice: data.wholesalePrice !== undefined ? String(data.wholesalePrice) : undefined,
      images: data.images ? JSON.stringify(data.images) : undefined,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      updatedAt: new Date(),
    };

    const [row] = await db
      .update(products)
      .set(updateValues)
      .where(
        and(
          eq(products.id, id),
          eq(products.tenantId, tenantId)
        )
      )
      .returning();

    // Record in audit log
    await this.logAudit(tenantId, 'update', row, existing);

    return mapToProduct(row);
  },

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new Error('Product not found');
    }

    await db
      .update(products)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, id),
          eq(products.tenantId, tenantId)
        )
      );

    // Record in audit log
    await this.logAudit(tenantId, 'delete', existing);
  },

  async updateStock(tenantId: string, productId: string, delta: number): Promise<Product> {
    const [row] = await db
      .update(products)
      .set({
        stock: sql`${products.stock} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .returning();

    if (!row) {
      throw new Error('Product not found');
    }

    return mapToProduct(row);
  },

  async getLowStock(tenantId: string): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          sql`${products.stock} <= ${products.minimumStock}`
        )
      )
      .orderBy(desc(products.stock));

    return rows.map(mapToProduct);
  },

  async logAudit(
    tenantId: string,
    action: string,
    after: any,
    before?: any
  ): Promise<void> {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      action,
      entityType: 'product',
      entityId: after.id,
      beforeValue: before ? JSON.stringify(before) : null,
      afterValue: JSON.stringify(after),
      createdAt: new Date(),
    });
  },
};

function mapToProduct(row: any): Product {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sku: row.sku,
    name: row.name,
    description: row.description,
    barcode: row.barcode,
    categoryId: row.categoryId,
    costPrice: parseFloat(row.costPrice),
    sellingPrice: parseFloat(row.sellingPrice),
    wholesalePrice: row.wholesalePrice ? parseFloat(row.wholesalePrice) : undefined,
    stock: row.stock,
    minimumStock: row.minimumStock,
    status: row.status,
    images: row.images ? JSON.parse(row.images) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt?.getTime(),
  };
}
