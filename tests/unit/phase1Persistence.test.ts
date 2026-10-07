import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';
import { productRepo, orderRepo, outboxRepo } from '../../apps/desktop/src/lib/db';
import { Order } from '@genx/types/domain/order';

describe('Phase 1: SQLite Authority & Atomic Checkout Tests', () => {
  const tenantId = 'tenant-test-p1';

  beforeEach(async () => {
    localStorage.clear();
    setupTauriBrowserMock();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('maintains SQLite as authoritative: creates product, persists stock, and retrieves it', async () => {
    const product = {
      id: 'prod-item-1',
      tenantId,
      sku: 'SKU-P1-001',
      name: 'Engine Synthetic Oil 5L',
      costPrice: 30,
      sellingPrice: 55,
      stock: 20,
      minimumStock: 5,
      status: 'active' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await productRepo.create(product);

    const loaded = await productRepo.findById(tenantId, 'prod-item-1');
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Engine Synthetic Oil 5L');
    expect(loaded?.stock).toBe(20);
  });

  it('executes atomic sale: decreases stock, writes order and outbox in 1 transaction', async () => {
    const product = {
      id: 'prod-item-2',
      tenantId,
      sku: 'SKU-P1-002',
      name: 'Ceramic Brake Pads',
      costPrice: 40,
      sellingPrice: 80,
      stock: 10,
      minimumStock: 2,
      status: 'active' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await productRepo.create(product);

    const orderId = 'order-atomic-1';
    const orderItems = [
      {
        productId: 'prod-item-2',
        name: 'Ceramic Brake Pads',
        sku: 'SKU-P1-002',
        quantity: 3,
        price: 80,
        discount: 0,
        tax: 0,
        total: 240,
      },
    ];

    const order: Order = {
      id: orderId,
      tenantId,
      orderNumber: 'ORD-ATOMIC-001',
      items: orderItems,
      subtotal: 240,
      discount: 0,
      tax: 0,
      total: 240,
      paymentMethod: 'cash',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await orderRepo.createAtomicSale(order, orderItems);

    // Verify stock is decreased in SQLite
    const updatedProd = await productRepo.findById(tenantId, 'prod-item-2');
    expect(updatedProd?.stock).toBe(7);

    // Verify order was created
    const createdOrder = await orderRepo.findById(tenantId, orderId);
    expect(createdOrder).toBeDefined();
    expect(createdOrder?.total).toBe(240);

    // Verify outbox entry exists for sync
    const pendingOutbox = await outboxRepo.getPending(tenantId, 10);
    const orderOutbox = pendingOutbox.find((o) => o.entityId === orderId || o.entity_id === orderId);
    expect(orderOutbox).toBeDefined();
    expect(orderOutbox?.operation).toBe('create');
  });

  it('prevents negative stock: rejects checkout when requested quantity exceeds inventory', async () => {
    const product = {
      id: 'prod-item-3',
      tenantId,
      sku: 'SKU-P1-003',
      name: 'Limited Edition Air Filter',
      costPrice: 15,
      sellingPrice: 30,
      stock: 2,
      minimumStock: 1,
      status: 'active' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await productRepo.create(product);

    const order: Order = {
      id: 'order-overflow-1',
      tenantId,
      orderNumber: 'ORD-OVERFLOW-001',
      items: [],
      subtotal: 150,
      discount: 0,
      tax: 0,
      total: 150,
      paymentMethod: 'cash',
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const requestedItems = [
      {
        productId: 'prod-item-3',
        name: 'Limited Edition Air Filter',
        sku: 'SKU-P1-003',
        quantity: 5, // exceeds available stock 2
        price: 30,
        discount: 0,
        tax: 0,
        total: 150,
      },
    ];

    // Transaction must throw and roll back
    await expect(orderRepo.createAtomicSale(order, requestedItems)).rejects.toThrow(
      /Insufficient stock/i
    );

    // Verify stock remained intact (did not decrease to -3)
    const intactProd = await productRepo.findById(tenantId, 'prod-item-3');
    expect(intactProd?.stock).toBe(2);

    // Verify order was NOT created (clean rollback)
    const rolledBackOrder = await orderRepo.findById(tenantId, 'order-overflow-1');
    expect(rolledBackOrder).toBeNull();
  });

  it('simulates 100 consecutive offline sales: zero data loss, exact inventory tally', async () => {
    const product = {
      id: 'prod-100-batch',
      tenantId,
      sku: 'SKU-BATCH-100',
      name: 'High-Volume Spark Plug',
      costPrice: 5,
      sellingPrice: 10,
      stock: 250,
      minimumStock: 10,
      status: 'active' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await productRepo.create(product);

    for (let i = 1; i <= 100; i++) {
      const orderId = `batch-order-${i}`;
      const item = {
        productId: 'prod-100-batch',
        name: 'High-Volume Spark Plug',
        sku: 'SKU-BATCH-100',
        quantity: 2,
        price: 10,
        discount: 0,
        tax: 0,
        total: 20,
      };

      const order: Order = {
        id: orderId,
        tenantId,
        orderNumber: `ORD-BATCH-${String(i).padStart(4, '0')}`,
        items: [item],
        subtotal: 20,
        discount: 0,
        tax: 0,
        total: 20,
        paymentMethod: 'cash',
        status: 'completed',
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i,
      };

      await orderRepo.createAtomicSale(order, [item]);
    }

    // 250 initial stock - (100 sales * 2 units) = exactly 50 remaining
    const finalProd = await productRepo.findById(tenantId, 'prod-100-batch');
    expect(finalProd?.stock).toBe(50);

    // Exactly 100 outbox records queued for cloud sync
    const allOutbox = await outboxRepo.getPending(tenantId, 200);
    expect(allOutbox.length).toBe(100);
  });
});
