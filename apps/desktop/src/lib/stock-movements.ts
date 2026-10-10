import { getDatabase, getCurrentTenantId } from './db';
import type { StockMovement, MovementType, ReferenceType } from '@genx/types/domain/inventory';
import { supabase, isSupabaseConfigured } from './supabase';

export const stockMovementRepo = {
  /**
   * Inserts an immutable stock movement record.
   * Can be executed within an existing transaction by passing tx.
   */
  async insert(
    movement: {
      id?: string;
      tenantId?: string;
      productId: string;
      quantityDelta: number;
      movementType: MovementType;
      referenceType: ReferenceType;
      referenceId: string;
      deviceId: string;
      notes?: string;
      createdAt?: number;
    },
    tx?: any
  ): Promise<StockMovement> {
    const db = tx ?? (await getDatabase());
    const id = movement.id ?? crypto.randomUUID();
    const tenantId = movement.tenantId ?? getCurrentTenantId();
    const now = movement.createdAt ?? Date.now();

    // Dual write to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('stock_movements').insert({
          id,
          tenant_id: tenantId,
          product_id: movement.productId,
          type: movement.movementType,
          quantity: movement.quantityDelta,
          reference_id: movement.referenceId,
          reference_type: movement.referenceType,
          notes: movement.notes ?? null,
          created_at: now,
        });
      } catch (err) {
        console.warn('[stockMovementRepo] Supabase insert error:', err);
      }
    }

    await db.execute(
      `INSERT INTO stock_movements (id, tenant_id, product_id, quantity_delta, movement_type, reference_type, reference_id, device_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tenantId,
        movement.productId,
        movement.quantityDelta,
        movement.movementType,
        movement.referenceType,
        movement.referenceId,
        movement.deviceId,
        movement.notes ?? null,
        now,
      ]
    );

    return {
      id,
      tenantId,
      productId: movement.productId,
      quantityDelta: movement.quantityDelta,
      movementType: movement.movementType,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      deviceId: movement.deviceId,
      notes: movement.notes,
      createdAt: now,
    };
  },

  /**
   * Retrieves all movements for a specific product under current tenant.
   */
  async findByProduct(
    productId: string,
    tenantId: string = getCurrentTenantId()
  ): Promise<StockMovement[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('product_id', productId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            id: String(r.id),
            tenantId: String(r.tenant_id),
            productId: String(r.product_id),
            quantityDelta: Number(r.quantity || 0),
            movementType: r.type,
            referenceType: r.reference_type,
            referenceId: r.reference_id,
            deviceId: '',
            notes: r.notes || undefined,
            createdAt: Number(r.created_at),
          }));
        }
      } catch (err) {
        console.warn('[stockMovementRepo] Supabase findByProduct error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM stock_movements WHERE tenant_id = ? AND product_id = ? ORDER BY created_at DESC`,
      [tenantId, productId]
    );
    return rows.map(mapMovement);
  },

  /**
   * Retrieves all movements for a reference (e.g. orderId).
   */
  async findByReference(
    referenceType: ReferenceType,
    referenceId: string,
    tenantId: string = getCurrentTenantId()
  ): Promise<StockMovement[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM stock_movements WHERE tenant_id = ? AND reference_type = ? AND reference_id = ? ORDER BY created_at ASC`,
      [tenantId, referenceType, referenceId]
    );
    return rows.map(mapMovement);
  },

  /**
   * Calculates total computed stock from movements for a product.
   */
  async getCalculatedStock(
    productId: string,
    tenantId: string = getCurrentTenantId()
  ): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ total: number }[]>(
      `SELECT COALESCE(SUM(quantity_delta), 0) as total FROM stock_movements WHERE tenant_id = ? AND product_id = ?`,
      [tenantId, productId]
    );
    return Number(rows[0]?.total || 0);
  },

  /**
   * Retrieves all stock movements for tenant.
   */
  async findAll(tenantId: string = getCurrentTenantId(), limit: number = 100): Promise<StockMovement[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            id: String(r.id),
            tenantId: String(r.tenant_id),
            productId: String(r.product_id),
            quantityDelta: Number(r.quantity || 0),
            movementType: r.type,
            referenceType: r.reference_type,
            referenceId: r.reference_id,
            deviceId: '',
            notes: r.notes || undefined,
            createdAt: Number(r.created_at),
          }));
        }
      } catch (err) {
        console.warn('[stockMovementRepo] Supabase findAll error:', err);
      }
    }

    const db = await getDatabase();
    const rows = await db.select<any[]>(
      `SELECT * FROM stock_movements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
      [tenantId, limit]
    );
    return rows.map(mapMovement);
  },
};

function mapMovement(r: any): StockMovement {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    productId: r.product_id,
    quantityDelta: Number(r.quantity_delta),
    movementType: r.movement_type,
    referenceType: r.reference_type,
    referenceId: r.reference_id,
    deviceId: r.device_id,
    notes: r.notes ?? undefined,
    createdAt: Number(r.created_at),
  };
}
