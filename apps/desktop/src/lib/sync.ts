import SyncEngine from '@genx/sync/SyncEngine';
import {
  outboxRepo,
  productRepo,
  orderRepo,
  customerRepo,
  getCurrentTenantId,
} from './db';
import { syncStateRepo } from './sync-state';
import { stockMovementRepo } from './stock-movements';
import { getDeviceId } from './device';
import type { Product } from '@genx/types/domain/product';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const syncEngine = new SyncEngine(
  API_URL,
  getCurrentTenantId(),
  {
    getPendingOutbox: (tenantId, limit) => {
      const activeTenant = getCurrentTenantId();
      return outboxRepo.getPending(activeTenant, limit) as any;
    },
    markOutboxSynced: (id) => outboxRepo.markSynced(id),
    markOutboxFailed: (id, error) => outboxRepo.markFailed(id, error),
    getDeviceId: () => getDeviceId(),
    getCursor: async (scope: string) => {
      const activeTenant = getCurrentTenantId();
      const deviceId = await getDeviceId();
      return syncStateRepo.getCursor(scope, deviceId, activeTenant);
    },
    setCursor: async (scope: string, cursor: string) => {
      const activeTenant = getCurrentTenantId();
      const deviceId = await getDeviceId();
      return syncStateRepo.setCursor(scope, cursor, deviceId, activeTenant);
    },
    applyRemoteChange: async (change) => {
      const activeTenant = getCurrentTenantId();
      const changeTenant = change.tenant_id || change.tenantId;

      // Rule: Tenant Isolation — Reject changes belonging to any other tenant
      if (changeTenant && changeTenant !== activeTenant) {
        console.warn('Sync rejected remote change belonging to another tenant:', changeTenant);
        return;
      }

      const entityType = change.entity_type || change.entityType;
      const entityId = change.entity_id || change.entityId;
      const operation = change.operation;
      const payload = typeof change.payload === 'string' ? JSON.parse(change.payload) : (change.payload || {});
      const deviceId = await getDeviceId();

      switch (entityType) {
        // ── Product: update catalog without overwriting stock directly ───
        case 'product': {
          if (operation === 'delete') {
            await productRepo.delete(activeTenant, entityId);
          } else {
            const existing = await productRepo.findById(activeTenant, entityId);
            if (!existing) {
              await productRepo.create({
                id: entityId,
                tenantId: activeTenant,
                sku: payload.sku,
                name: payload.name,
                description: payload.description,
                barcode: payload.barcode,
                categoryId: payload.categoryId,
                costPrice: Number(payload.costPrice ?? payload.cost_price ?? 0),
                sellingPrice: Number(payload.sellingPrice ?? payload.selling_price ?? 0),
                wholesalePrice: payload.wholesalePrice != null ? Number(payload.wholesalePrice) : undefined,
                stock: Number(payload.stock ?? 0),
                minimumStock: Number(payload.minimumStock ?? payload.minimum_stock ?? 0),
                status: payload.status || 'active',
                images: payload.images,
                metadata: payload.metadata,
                createdAt: Number(payload.createdAt ?? payload.created_at ?? Date.now()),
                updatedAt: Number(payload.updatedAt ?? payload.updated_at ?? Date.now()),
              });
            } else {
              // Update catalog details safely, never override local stock with absolute remote stock
              await productRepo.update({
                id: entityId,
                tenantId: activeTenant,
                sku: payload.sku ?? existing.sku,
                name: payload.name ?? existing.name,
                description: payload.description ?? existing.description,
                barcode: payload.barcode ?? existing.barcode,
                categoryId: payload.categoryId ?? existing.categoryId,
                costPrice: payload.costPrice != null ? Number(payload.costPrice) : existing.costPrice,
                sellingPrice: payload.sellingPrice != null ? Number(payload.sellingPrice) : existing.sellingPrice,
                wholesalePrice: payload.wholesalePrice != null ? Number(payload.wholesalePrice) : existing.wholesalePrice,
                minimumStock: payload.minimumStock != null ? Number(payload.minimumStock) : existing.minimumStock,
                status: payload.status ?? existing.status,
              });
            }
          }
          break;
        }

        // ── Stock Movement: Additive movement ledger (no LWW overwrite!) ──
        case 'stock_movement': {
          const refType = payload.referenceType || payload.reference_type;
          const refId = payload.referenceId || payload.reference_id;
          const prodId = payload.productId || payload.product_id;
          const qtyDelta = Number(payload.quantityDelta ?? payload.quantity_delta ?? 0);

          if (!refType || !refId || !prodId || qtyDelta === 0) break;

          // Check for duplicate movement to guarantee idempotency
          const existingMovements = await stockMovementRepo.findByReference(refType, refId, activeTenant);
          const alreadyProcessed = existingMovements.some((m) => m.productId === prodId);
          if (alreadyProcessed) break;

          // Insert into local SQLite stock_movements ledger
          await stockMovementRepo.insert({
            id: entityId || crypto.randomUUID(),
            tenantId: activeTenant,
            productId: prodId,
            quantityDelta: qtyDelta,
            movementType: payload.movementType || payload.movement_type || 'ADJUSTMENT',
            referenceType: refType,
            referenceId: refId,
            deviceId: payload.deviceId || payload.device_id || deviceId,
            notes: payload.notes,
            createdAt: Number(payload.createdAt ?? payload.created_at ?? Date.now()),
          });

          // Additively adjust stock in SQLite
          await productRepo.updateStock(activeTenant, prodId, qtyDelta);
          break;
        }

        // ── Customer: directory and balance ──────────────────────────────
        case 'customer': {
          const existing = await customerRepo.findById(activeTenant, entityId);
          if (!existing) {
            await customerRepo.create({
              id: entityId,
              tenantId: activeTenant,
              name: payload.name,
              phone: payload.phone,
              email: payload.email,
              address: payload.address,
              balance: Number(payload.balance ?? 0),
              creditLimit: Number(payload.creditLimit ?? payload.credit_limit ?? 0),
              createdAt: Number(payload.createdAt ?? payload.created_at ?? Date.now()),
              updatedAt: Number(payload.updatedAt ?? payload.updated_at ?? Date.now()),
            });
          }
          break;
        }

        // ── Order: remote retail orders ───────────────────────────────────
        case 'order': {
          const existing = await orderRepo.findById(activeTenant, entityId);
          if (!existing) {
            await orderRepo.create(
              {
                id: entityId,
                tenantId: activeTenant,
                orderNumber: payload.orderNumber ?? payload.order_number,
                items: payload.items || [],
                customerId: payload.customerId ?? payload.customer_id,
                subtotal: Number(payload.subtotal ?? 0),
                discount: Number(payload.discount ?? 0),
                tax: Number(payload.tax ?? 0),
                total: Number(payload.total ?? 0),
                paymentMethod: payload.paymentMethod ?? payload.payment_method ?? 'cash',
                status: payload.status || 'completed',
                notes: payload.notes,
                createdAt: Number(payload.createdAt ?? payload.created_at ?? Date.now()),
                updatedAt: Number(payload.updatedAt ?? payload.updated_at ?? Date.now()),
              },
              payload.items || []
            );
          }
          break;
        }
      }

      // Notify UI via CustomEvent so React Query can refresh active views
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('genx:sync-change-applied', { detail: change }));
      }
    },
  }
);

export function initializeSync(): void {
  syncEngine.setTenantId(getCurrentTenantId());
  syncEngine.start(15000); // Check sync every 15s when online
}

export async function recordProductChange(
  _operation: 'create' | 'update' | 'delete',
  _product: any
): Promise<void> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    void syncEngine.sync();
  }
}

export async function recordOrderChange(
  _operation: 'create' | 'update' | 'delete',
  _order: any
): Promise<void> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    void syncEngine.sync();
  }
}
