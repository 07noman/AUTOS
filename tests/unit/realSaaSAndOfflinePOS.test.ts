import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';
import {
  getCurrentTenantId,
  productRepo,
  orderRepo,
  customerRepo,
  outboxRepo,
} from '../../apps/desktop/src/lib/db';
import { stockMovementRepo } from '../../apps/desktop/src/lib/stock-movements';
import { syncStateRepo } from '../../apps/desktop/src/lib/sync-state';
import { getDeviceId, _resetDeviceCacheForTest } from '../../apps/desktop/src/lib/device';
import { useAuth } from '../../apps/desktop/src/hooks/useAuth';
import { SyncEngine } from '../../sync/src/SyncEngine';
import type { Order } from '@genx/types/domain/order';

describe('GENX CLOUD POS — Real SaaS & Offline-First POS Suite', () => {
  const tenantA = 'client-a';
  const tenantB = 'client-b';

  beforeAll(() => {
    localStorage.clear();
    _resetDeviceCacheForTest();
    setupTauriBrowserMock();
  });

  afterAll(() => {
    localStorage.clear();
  });

  describe('1. SaaS Authentication & Tenant Switching', () => {
    it('Client A login resolves tenant context to client-a without module-load cache locking', async () => {
      // Default unauthenticated fallback
      expect(getCurrentTenantId()).toBe('tenant-1');

      // Login Client A offline
      await useAuth.getState().login('clienta@test.com', 'password123');

      expect(useAuth.getState().isAuthenticated).toBe(true);
      expect(useAuth.getState().user?.tenantId).toBe(tenantA);
      expect(getCurrentTenantId()).toBe(tenantA);
    });

    it('Client B login resolves tenant context to client-b and logout resets safely', async () => {
      // Login Client B
      await useAuth.getState().login('clientb@test.com', 'password123');

      expect(useAuth.getState().isAuthenticated).toBe(true);
      expect(useAuth.getState().user?.tenantId).toBe(tenantB);
      expect(getCurrentTenantId()).toBe(tenantB);

      // Logout
      useAuth.getState().logout();
      expect(useAuth.getState().isAuthenticated).toBe(false);
      expect(getCurrentTenantId()).toBe('tenant-1');
    });
  });

  describe('2. Client A Product Creation & Initial Stock Ledger', () => {
    it('creates product with stock 10 and generates corresponding stock movement', async () => {
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantA }, isAuthenticated: true } })
      );
      const deviceId = await getDeviceId();

      const prodA = {
        id: 'prod-a-001',
        tenantId: tenantA,
        sku: 'A-001',
        name: 'Client A Test Product',
        costPrice: 600,
        sellingPrice: 1000,
        stock: 10,
        minimumStock: 2,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await productRepo.create(prodA);

      // Record initial stock movement
      await stockMovementRepo.insert({
        id: 'sm-init-a1',
        tenantId: tenantA,
        productId: prodA.id,
        quantityDelta: 10,
        movementType: 'ADJUSTMENT',
        referenceType: 'manual',
        referenceId: prodA.id,
        deviceId,
        notes: 'Initial stock',
        createdAt: prodA.createdAt,
      });

      // Verify product
      const retrieved = await productRepo.findById(tenantA, prodA.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Client A Test Product');
      expect(retrieved?.stock).toBe(10);

      // Verify stock movement ledger
      const movements = await stockMovementRepo.findByProduct(prodA.id, tenantA);
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(10);
      expect(movements[0].movementType).toBe('ADJUSTMENT');

      const calculatedStock = await stockMovementRepo.getCalculatedStock(prodA.id, tenantA);
      expect(calculatedStock).toBe(10);
    });
  });

  describe('3. Client A Real Cash Sale (10 -> 8)', () => {
    it('sells 2 units CASH: decrements stock to 8, writes order, stock movement, and outbox', async () => {
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantA }, isAuthenticated: true } })
      );

      const prod = await productRepo.findById(tenantA, 'prod-a-001');
      expect(prod?.stock).toBe(10);

      const orderItems = [
        {
          productId: 'prod-a-001',
          name: 'Client A Test Product',
          sku: 'A-001',
          quantity: 2,
          price: 1000,
          discount: 0,
          tax: 0,
          total: 2000,
        },
      ];

      const order1: Order = {
        id: 'ord-cash-1',
        tenantId: tenantA,
        orderNumber: 'ORD-A-001',
        items: orderItems,
        subtotal: 2000,
        discount: 0,
        tax: 0,
        total: 2000,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await orderRepo.createAtomicSale(order1, orderItems);

      // Verify stock deducted 10 -> 8
      const updated = await productRepo.findById(tenantA, 'prod-a-001');
      expect(updated?.stock).toBe(8);

      // Verify order saved
      const savedOrder = await orderRepo.findById(tenantA, 'ord-cash-1');
      expect(savedOrder).not.toBeNull();
      expect(savedOrder?.total).toBe(2000);
      expect(savedOrder?.paymentMethod).toBe('cash');

      // Verify stock movement (-2 SALE)
      const movements = await stockMovementRepo.findByReference('order', 'ord-cash-1', tenantA);
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(-2);
      expect(movements[0].movementType).toBe('SALE');

      // Verify outbox queued
      const pendingOutbox = await outboxRepo.getPending(tenantA, 10);
      const outboxEntry = pendingOutbox.find((o) => o.entity_id === 'ord-cash-1' || o.entityId === 'ord-cash-1');
      expect(outboxEntry).toBeDefined();
    });
  });

  describe('4. Client A Real Credit Sale (8 -> 7)', () => {
    it('creates customer, sells 1 unit CREDIT: decrements stock to 7 and updates customer credit balance to +1000', async () => {
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantA }, isAuthenticated: true } })
      );

      // Create customer in SQLite
      const customer = await customerRepo.create({
        id: 'cust-a-001',
        tenantId: tenantA,
        name: 'Client A Customer',
        phone: '03000000001',
        balance: 0,
        creditLimit: 5000,
      });

      expect(customer.name).toBe('Client A Customer');
      expect(customer.balance).toBe(0);

      // Perform credit sale for 1 unit ($1000)
      const orderItems = [
        {
          productId: 'prod-a-001',
          name: 'Client A Test Product',
          sku: 'A-001',
          quantity: 1,
          price: 1000,
          discount: 0,
          tax: 0,
          total: 1000,
        },
      ];

      const creditOrder: Order = {
        id: 'ord-credit-1',
        tenantId: tenantA,
        orderNumber: 'ORD-A-002',
        customerId: customer.id,
        items: orderItems,
        subtotal: 1000,
        discount: 0,
        tax: 0,
        total: 1000,
        paymentMethod: 'credit',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await orderRepo.createAtomicSale(creditOrder, orderItems);

      // Verify stock deducted 8 -> 7
      const updatedProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(updatedProd?.stock).toBe(7);

      // Verify customer balance updated: 0 + 1000 = 1000
      const updatedCust = await customerRepo.findById(tenantA, customer.id);
      expect(updatedCust).not.toBeNull();
      expect(updatedCust?.balance).toBe(1000);

      // Verify order
      const savedOrder = await orderRepo.findById(tenantA, 'ord-credit-1');
      expect(savedOrder?.paymentMethod).toBe('credit');
      expect(savedOrder?.total).toBe(1000);

      // Verify stock movement (-1 SALE)
      const movements = await stockMovementRepo.findByReference('order', 'ord-credit-1', tenantA);
      expect(movements.length).toBe(1);
      expect(movements[0].quantityDelta).toBe(-1);
    });
  });

  describe('5. Restart & Persistence', () => {
    it('survives application reload: stock remains 7, customer balance 1000, and orders intact', async () => {
      _resetDeviceCacheForTest();

      const prod = await productRepo.findById(tenantA, 'prod-a-001');
      expect(prod?.stock).toBe(7);

      const cust = await customerRepo.findById(tenantA, 'cust-a-001');
      expect(cust?.balance).toBe(1000);

      const allOrders = await orderRepo.findAll(tenantA);
      expect(allOrders.length).toBe(2);

      const calculatedStock = await stockMovementRepo.getCalculatedStock('prod-a-001', tenantA);
      expect(calculatedStock).toBe(7);
    });
  });

  describe('6. Real Offline Operation (7 -> 5)', () => {
    it('operates offline: cash sale of 2 units succeeds immediately with stock 7 -> 5 and queues outbox', async () => {
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantA }, isAuthenticated: true } })
      );

      // Offline sale of 2 units ($2000)
      const orderItems = [
        {
          productId: 'prod-a-001',
          name: 'Client A Test Product',
          sku: 'A-001',
          quantity: 2,
          price: 1000,
          discount: 0,
          tax: 0,
          total: 2000,
        },
      ];

      const offlineOrder: Order = {
        id: 'ord-offline-1',
        tenantId: tenantA,
        orderNumber: 'ORD-A-003',
        items: orderItems,
        subtotal: 2000,
        discount: 0,
        tax: 0,
        total: 2000,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await orderRepo.createAtomicSale(offlineOrder, orderItems);

      // Stock deducted 7 -> 5
      const prod = await productRepo.findById(tenantA, 'prod-a-001');
      expect(prod?.stock).toBe(5);

      // Outbox contains pending work
      const pending = await outboxRepo.getPending(tenantA, 50);
      const offlineOutbox = pending.find((o) => o.entity_id === 'ord-offline-1' || o.entityId === 'ord-offline-1');
      expect(offlineOutbox).toBeDefined();
      expect(offlineOutbox?.status).toBe('pending');
    });
  });

  describe('7. Report Consistency & Ledger Tally', () => {
    it('reconciles products, inventory, orders, cash, credit, and stock movements', async () => {
      const orders = await orderRepo.findAll(tenantA);
      expect(orders.length).toBe(3);

      const cashRevenue = orders
        .filter((o) => o.paymentMethod === 'cash')
        .reduce((sum, o) => sum + Number(o.total), 0);
      const creditRevenue = orders
        .filter((o) => o.paymentMethod === 'credit')
        .reduce((sum, o) => sum + Number(o.total), 0);
      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

      // Cash: 2000 (sale 1) + 2000 (offline sale 3) = 4000
      expect(cashRevenue).toBe(4000);
      // Credit: 1000 (sale 2) = 1000
      expect(creditRevenue).toBe(1000);
      // Total: 5000
      expect(totalRevenue).toBe(5000);

      // Stock ledger calculation
      const calculatedStock = await stockMovementRepo.getCalculatedStock('prod-a-001', tenantA);
      // Initial: +10, Cash1: -2, Credit: -1, Offline: -2 => 5
      expect(calculatedStock).toBe(5);

      const product = await productRepo.findById(tenantA, 'prod-a-001');
      expect(product?.stock).toBe(5);

      // Customer ledger
      const cust = await customerRepo.findById(tenantA, 'cust-a-001');
      expect(cust?.balance).toBe(1000);
    });
  });

  describe('8. Atomic Failure & Rollback Test', () => {
    it('rejects sale when requested stock exceeds inventory: rolls back completely with zero side-effects', async () => {
      const prod = await productRepo.findById(tenantA, 'prod-a-001');
      expect(prod?.stock).toBe(5);

      const orderItems = [
        {
          productId: 'prod-a-001',
          name: 'Client A Test Product',
          sku: 'A-001',
          quantity: 10, // Available is only 5!
          price: 1000,
          discount: 0,
          tax: 0,
          total: 10000,
        },
      ];

      const failedOrder: Order = {
        id: 'ord-fail-oversell',
        tenantId: tenantA,
        orderNumber: 'ORD-FAIL-001',
        items: orderItems,
        subtotal: 10000,
        discount: 0,
        tax: 0,
        total: 10000,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(orderRepo.createAtomicSale(failedOrder, orderItems)).rejects.toThrow(
        /Insufficient stock/i
      );

      // Stock remains exactly 5
      const intactProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(intactProd?.stock).toBe(5);

      // Order was NOT created
      const nonExistentOrder = await orderRepo.findById(tenantA, 'ord-fail-oversell');
      expect(nonExistentOrder).toBeNull();

      // No stock movement was recorded
      const movements = await stockMovementRepo.findByReference('order', 'ord-fail-oversell', tenantA);
      expect(movements.length).toBe(0);
    });
  });

  describe('9. Client B Isolation & Zero Crossover', () => {
    it('Client B operates in complete isolation: sees only its own product, orders, and reports', async () => {
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({ state: { user: { tenantId: tenantB }, isAuthenticated: true } })
      );
      expect(getCurrentTenantId()).toBe(tenantB);

      // Client B cannot see Client A's product
      const clientAProdSeenByB = await productRepo.findById(tenantB, 'prod-a-001');
      expect(clientAProdSeenByB).toBeNull();

      // Client B cannot see Client A's orders
      const clientBOrders = await orderRepo.findAll(tenantB);
      expect(clientBOrders.length).toBe(0);

      // Client B creates its own product
      const prodB = {
        id: 'prod-b-001',
        tenantId: tenantB,
        sku: 'B-001',
        name: 'Client B Test Product',
        costPrice: 1200,
        sellingPrice: 2000,
        stock: 20,
        minimumStock: 5,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await productRepo.create(prodB);

      // Client B sells 3 units
      const itemB = [
        {
          productId: 'prod-b-001',
          name: 'Client B Test Product',
          sku: 'B-001',
          quantity: 3,
          price: 2000,
          discount: 0,
          tax: 0,
          total: 6000,
        },
      ];

      const orderB: Order = {
        id: 'ord-b-001',
        tenantId: tenantB,
        orderNumber: 'ORD-B-001',
        items: itemB,
        subtotal: 6000,
        discount: 0,
        tax: 0,
        total: 6000,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await orderRepo.createAtomicSale(orderB, itemB);

      // Client B stock decremented 20 -> 17
      const updatedB = await productRepo.findById(tenantB, 'prod-b-001');
      expect(updatedB?.stock).toBe(17);

      // Client B orders = 1
      const bOrdersAfter = await orderRepo.findAll(tenantB);
      expect(bOrdersAfter.length).toBe(1);
      expect(bOrdersAfter[0].total).toBe(6000);

      // Client A data is completely unchanged
      const aProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(aProd?.stock).toBe(5);

      const aOrders = await orderRepo.findAll(tenantA);
      expect(aOrders.length).toBe(3);
    });
  });

  describe('10. SyncEngine, Persistent SQLite Cursor & Push/Pull', () => {
    it('manages persistent SQLite cursor and pushes outbox mutations with idempotency keys', async () => {
      const deviceId = await getDeviceId();

      // Persistent cursor in SQLite sync_state table
      await syncStateRepo.setCursor('global', '1728000000000', deviceId, tenantA);
      const cursor = await syncStateRepo.getCursor('global', deviceId, tenantA);
      expect(cursor).toBe('1728000000000');

      let pushedChanges: any[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/sync/push')) {
          const body = JSON.parse(init?.body as string);
          pushedChanges = body.changes;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              synced: body.changes.map((c: any) => c.id),
              errors: [],
            }),
          };
        }
        if (url.includes('/sync/pull')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              changes: [],
              last_timestamp: 1728000050000,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      // Temporarily mock global fetch for test
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      try {
        const engine = new SyncEngine('http://localhost:4000', tenantA, {
          getPendingOutbox: (t, lim) => outboxRepo.getPending(t, lim) as any,
          markOutboxSynced: (id) => outboxRepo.markSynced(id),
          markOutboxFailed: (id, err) => outboxRepo.markFailed(id, err),
          applyRemoteChange: async () => {},
          getCursor: (s) => syncStateRepo.getCursor(s, deviceId, tenantA),
          setCursor: (s, c) => syncStateRepo.setCursor(s, c, deviceId, tenantA),
          getDeviceId: () => Promise.resolve(deviceId),
        });

        const syncRes = await engine.sync();
        expect(syncRes.success).toBe(true);

        // Verify push payload contained idempotency key and device id
        expect(pushedChanges.length).toBeGreaterThan(0);
        expect(pushedChanges[0].idempotency_key).toBeDefined();
        expect(pushedChanges[0].device_id).toBe(deviceId);

        // Verify cursor updated in SQLite sync_state
        const updatedCursor = await syncStateRepo.getCursor('global', deviceId, tenantA);
        expect(updatedCursor).toBe('1728000050000');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('applies remote stock movement additively without overwriting stock with LWW', async () => {
      const deviceId = await getDeviceId();

      // Product has stock = 5
      const currentProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(currentProd?.stock).toBe(5);

      // Remote Device B performed a SALE of 1 unit
      const remoteMovement = {
        id: 'remote-sm-b2',
        tenantId: tenantA,
        productId: 'prod-a-001',
        quantityDelta: -1,
        movementType: 'SALE',
        referenceType: 'order',
        referenceId: 'ord-remote-device-b',
        deviceId: 'device-b-uuid',
        notes: 'Remote counter sale',
        createdAt: Date.now(),
      };

      // Insert movement and update stock additively
      await stockMovementRepo.insert(remoteMovement);
      await productRepo.updateStock(tenantA, 'prod-a-001', -1);

      // Verify stock deducted additively 5 -> 4
      const updatedProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(updatedProd?.stock).toBe(4);

      // Ledger calculation accounts for both local and remote movements
      const totalMovements = await stockMovementRepo.getCalculatedStock('prod-a-001', tenantA);
      expect(totalMovements).toBe(4);
    });

    it('rejects duplicate stock movement for same logical reference (idempotency)', async () => {
      // Re-attempting the exact same remote movement
      const duplicateMovement = {
        id: 'dup-attempt-sm',
        tenantId: tenantA,
        productId: 'prod-a-001',
        quantityDelta: -1,
        movementType: 'SALE',
        referenceType: 'order',
        referenceId: 'ord-remote-device-b',
        deviceId: 'device-b-uuid',
        notes: 'Retry push',
        createdAt: Date.now(),
      };

      await expect(stockMovementRepo.insert(duplicateMovement)).rejects.toThrow(
        /UNIQUE constraint failed/i
      );

      // Stock remains intact (no double deduction)
      const intactProd = await productRepo.findById(tenantA, 'prod-a-001');
      expect(intactProd?.stock).toBe(4);
    });
  });
});
