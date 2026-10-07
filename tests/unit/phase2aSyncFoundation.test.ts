import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';
import {
  getDatabase,
  getCurrentTenantId,
  productRepo,
  orderRepo,
  outboxRepo,
} from '../../apps/desktop/src/lib/db';
import { runMigrations, migrations } from '../../apps/desktop/src/lib/migrations';
import { getDeviceId, _resetDeviceCacheForTest } from '../../apps/desktop/src/lib/device';
import { syncStateRepo } from '../../apps/desktop/src/lib/sync-state';
import { stockMovementRepo } from '../../apps/desktop/src/lib/stock-movements';
import { posOrderRepo } from '../../apps/desktop/src/lib/auto-care-db';
import { Order } from '@genx/types/domain/order';

describe('Phase 2A: Offline-First Sync Foundation Tests', () => {
  const tenantA = 'tenant-alpha-01';
  const tenantB = 'tenant-bravo-02';

  beforeEach(async () => {
    localStorage.clear();
    _resetDeviceCacheForTest();
    setupTauriBrowserMock();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('1. Tenant Context Resolution', () => {
    it('resolves tenant context dynamically per operation without module-load cache locking', () => {
      // Unauthenticated state
      expect(getCurrentTenantId()).toBe('tenant-1');

      // User logs in as Tenant A
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantA }, isAuthenticated: true } })
      );
      expect(getCurrentTenantId()).toBe(tenantA);

      // User switches or logs in as Tenant B
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantB }, isAuthenticated: true } })
      );
      expect(getCurrentTenantId()).toBe(tenantB);
    });
  });

  describe('2. Persistent Device Identity', () => {
    it('generates a stable device ID and persists across restarts', async () => {
      const devId1 = await getDeviceId();
      expect(devId1).toBeDefined();
      expect(typeof devId1).toBe('string');
      expect(devId1.length).toBeGreaterThan(10);

      // Simulate app restart by clearing memory cache
      _resetDeviceCacheForTest();

      const devId2 = await getDeviceId();
      expect(devId2).toBe(devId1);
    });
  });

  describe('3. Local SQLite Sync State (Persistent Cursors)', () => {
    it('stores and retrieves sync cursor per tenant, device, and scope in SQLite', async () => {
      const deviceId = await getDeviceId();

      await syncStateRepo.setCursor('products', '1728000000', deviceId, tenantA);
      await syncStateRepo.setCursor('orders', '1728000500', deviceId, tenantA);

      const prodCursor = await syncStateRepo.getCursor('products', deviceId, tenantA);
      const orderCursor = await syncStateRepo.getCursor('orders', deviceId, tenantA);

      expect(prodCursor).toBe('1728000000');
      expect(orderCursor).toBe('1728000500');

      // Tenant B has independent sync state (isolated)
      const tenantBCursor = await syncStateRepo.getCursor('products', deviceId, tenantB);
      expect(tenantBCursor).toBeNull();
    });
  });

  describe('4. Upgraded Outbox Metadata', () => {
    it('records device_id, idempotency_key, and version in outbox mutations', async () => {
      const deviceId = await getDeviceId();
      const idempotencyKey = `custom:mutation:${tenantA}:1001`;

      await outboxRepo.insert({
        id: 'outbox-meta-1',
        tenantId: tenantA,
        entityType: 'product',
        entityId: 'prod-meta-1',
        operation: 'create',
        payload: { name: 'Synthetic Oil' },
        deviceId,
        idempotencyKey,
        version: 1,
      });

      const pending = await outboxRepo.getPending(tenantA, 10);
      const entry = pending.find((p) => p.id === 'outbox-meta-1');
      expect(entry).toBeDefined();
      expect(entry?.deviceId).toBe(deviceId);
      expect(entry?.idempotencyKey).toBe(idempotencyKey);
      expect(entry?.version).toBe(1);
    });
  });

  describe('5. Migration System', () => {
    it('applies versioned migrations sequentially exactly once', async () => {
      const db = await getDatabase();
      const result1 = await runMigrations(db);
      expect(result1.appliedCount).toBe(migrations.length);
      expect(result1.currentVersion).toBe(migrations[migrations.length - 1].version);

      // Second invocation on existing database must be a safe no-op (0 applied)
      const result2 = await runMigrations(db);
      expect(result2.appliedCount).toBe(0);
      expect(result2.currentVersion).toBe(migrations[migrations.length - 1].version);
    });
  });

  describe('6. Inventory Movement Ledger & Atomicity', () => {
    it('creates immutable stock movement on atomic retail sale', async () => {
      const prod = {
        id: 'prod-mov-1',
        tenantId: tenantA,
        sku: 'SKU-MOV-01',
        name: 'Oil Filter Standard',
        costPrice: 5,
        sellingPrice: 15,
        stock: 50,
        minimumStock: 5,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await productRepo.create(prod);

      const orderId = 'order-mov-1';
      const saleItem = {
        productId: 'prod-mov-1',
        name: 'Oil Filter Standard',
        sku: 'SKU-MOV-01',
        quantity: 3,
        price: 15,
        discount: 0,
        tax: 0,
        total: 45,
      };

      const order: Order = {
        id: orderId,
        tenantId: tenantA,
        orderNumber: 'ORD-MOV-001',
        items: [saleItem],
        subtotal: 45,
        discount: 0,
        tax: 0,
        total: 45,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await orderRepo.createAtomicSale(order, [saleItem]);

      // 1. Stock count decremented
      const updated = await productRepo.findById(tenantA, 'prod-mov-1');
      expect(updated?.stock).toBe(47);

      // 2. Stock movement record created in ledger
      const movements = await stockMovementRepo.findByProduct('prod-mov-1', tenantA);
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(-3);
      expect(movements[0].movementType).toBe('SALE');
      expect(movements[0].referenceType).toBe('order');
      expect(movements[0].referenceId).toBe(orderId);
      expect(movements[0].deviceId).toBeDefined();
    });

    it('rolls back stock, order, and movements together if inventory check fails', async () => {
      const prod = {
        id: 'prod-insufficient-1',
        tenantId: tenantA,
        sku: 'SKU-INSUF-01',
        name: 'Premium Clutch Kit',
        costPrice: 100,
        sellingPrice: 200,
        stock: 1,
        minimumStock: 1,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await productRepo.create(prod);

      const order: Order = {
        id: 'order-insuf-1',
        tenantId: tenantA,
        orderNumber: 'ORD-INSUF-001',
        items: [],
        subtotal: 400,
        discount: 0,
        tax: 0,
        total: 400,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const excessiveItem = {
        productId: 'prod-insufficient-1',
        name: 'Premium Clutch Kit',
        sku: 'SKU-INSUF-01',
        quantity: 5, // Exceeds available stock of 1
        price: 200,
        discount: 0,
        tax: 0,
        total: 1000,
      };

      await expect(orderRepo.createAtomicSale(order, [excessiveItem])).rejects.toThrow(
        /Insufficient stock/i
      );

      // Stock intact
      const intact = await productRepo.findById(tenantA, 'prod-insufficient-1');
      expect(intact?.stock).toBe(1);

      // No movement ledger inserted
      const movements = await stockMovementRepo.findByProduct('prod-insufficient-1', tenantA);
      expect(movements.length).toBe(0);

      // No order created
      const missingOrder = await orderRepo.findById(tenantA, 'order-insuf-1');
      expect(missingOrder).toBeNull();
    });
  });

  describe('7. Auto Care POS Movement Integration', () => {
    it('creates stock movement on posOrderRepo.createPaid for parts', async () => {
      const part = {
        id: 'part-ac-1',
        tenantId: tenantA,
        sku: 'PART-AC-01',
        name: 'Brake Disc Rotor',
        costPrice: 40,
        sellingPrice: 75,
        stock: 15,
        minimumStock: 2,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await productRepo.create(part);

      const paidOrder = await posOrderRepo.createPaid({
        tenantId: tenantA,
        items: [
          {
            id: 'part-ac-1',
            name: 'Brake Disc Rotor',
            price: 75,
            quantity: 2,
            type: 'product',
            subtotal: 150,
          },
          {
            id: 'svc-labor-1',
            name: 'Rotor Replacement Labor',
            price: 80,
            quantity: 1,
            type: 'service',
            subtotal: 80,
          },
        ],
        subtotal: 230,
        tax: 11.5,
        total: 241.5,
        paidAmount: 241.5,
        paymentMethod: 'card',
        customerName: 'Alice Johnson',
      });

      expect(paidOrder.status).toBe('PAID');

      // Product stock reduced
      const updatedPart = await productRepo.findById(tenantA, 'part-ac-1');
      expect(updatedPart?.stock).toBe(13);

      // Stock movement created
      const movements = await stockMovementRepo.findByProduct('part-ac-1', tenantA);
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(-2);
      expect(movements[0].movementType).toBe('SALE');
      expect(movements[0].referenceType).toBe('pos_order');
    });
  });

  describe('8. Tenant Isolation on Sync & Ledger Tables', () => {
    it('guarantees Tenant A cannot see Tenant B stock movements, sync state, or outbox', async () => {
      const devId = await getDeviceId();

      // Tenant A data
      await stockMovementRepo.insert({
        tenantId: tenantA,
        productId: 'prod-A',
        quantityDelta: -1,
        movementType: 'SALE',
        referenceType: 'order',
        referenceId: 'order-A',
        deviceId: devId,
      });
      await syncStateRepo.setCursor('products', 'cursor-A', devId, tenantA);
      await outboxRepo.insert({
        id: 'outbox-A',
        tenantId: tenantA,
        entityType: 'order',
        entityId: 'ord-A',
        operation: 'create',
        payload: {},
        deviceId: devId,
      });

      // Tenant B data
      await stockMovementRepo.insert({
        tenantId: tenantB,
        productId: 'prod-B',
        quantityDelta: -2,
        movementType: 'SALE',
        referenceType: 'order',
        referenceId: 'order-B',
        deviceId: devId,
      });
      await syncStateRepo.setCursor('products', 'cursor-B', devId, tenantB);
      await outboxRepo.insert({
        id: 'outbox-B',
        tenantId: tenantB,
        entityType: 'order',
        entityId: 'ord-B',
        operation: 'create',
        payload: {},
        deviceId: devId,
      });

      // Verification for Tenant A
      const movA = await stockMovementRepo.findAll(tenantA);
      expect(movA.length).toBe(1);
      expect(movA[0].productId).toBe('prod-A');

      const cursorA = await syncStateRepo.getCursor('products', devId, tenantA);
      expect(cursorA).toBe('cursor-A');

      const outboxA = await outboxRepo.getPending(tenantA);
      expect(outboxA.length).toBe(1);
      expect(outboxA[0].id).toBe('outbox-A');

      // Verification for Tenant B
      const movB = await stockMovementRepo.findAll(tenantB);
      expect(movB.length).toBe(1);
      expect(movB[0].productId).toBe('prod-B');

      const cursorB = await syncStateRepo.getCursor('products', devId, tenantB);
      expect(cursorB).toBe('cursor-B');

      const outboxB = await outboxRepo.getPending(tenantB);
      expect(outboxB.length).toBe(1);
      expect(outboxB[0].id).toBe('outbox-B');
    });

    it('rejects duplicate stock movement insertion for same logical operation (idempotency)', async () => {
      const devId = await getDeviceId();

      await stockMovementRepo.insert({
        tenantId: tenantA,
        productId: 'prod-idem-1',
        quantityDelta: -1,
        movementType: 'SALE',
        referenceType: 'order',
        referenceId: 'order-same-op',
        deviceId: devId,
      });

      // Second attempt to insert identical (tenantId, referenceType, referenceId, productId)
      await expect(
        stockMovementRepo.insert({
          tenantId: tenantA,
          productId: 'prod-idem-1',
          quantityDelta: -1,
          movementType: 'SALE',
          referenceType: 'order',
          referenceId: 'order-same-op',
          deviceId: devId,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });
  });
});
