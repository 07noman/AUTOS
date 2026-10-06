import { orderRepo, productRepo, outboxRepo, getCurrentTenantId } from '@/lib/db';
import { Order } from '@genx/types/domain/order';
import { recordOrderChange } from '@/lib/sync';
import { reduceStock } from '@/services/offlineInventory';
import { saveOfflineOrder } from '@/services/offlineOrders';

export async function createOrder(
  tenantId: string,
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    price: number;
    discount: number;
  }>,
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit',
  customerId?: string,
  notes?: string
): Promise<Order> {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const taxableAmount = subtotal - discount;
  const tax = taxableAmount * 0.05; // 5% tax
  const total = taxableAmount + tax;

  const dbItems = items.map(item => ({
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    price: item.price,
    discount: item.discount,
    tax: 0,
    total: item.price * item.quantity - item.discount,
  }));

  const order: Order = {
    id: crypto.randomUUID(),
    tenantId,
    orderNumber: `ORD-${Date.now()}`,
    items: dbItems,
    customerId,
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    status: 'completed',
    notes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Create order in database
  await orderRepo.create(order, dbItems);

  // Update product stock in both SQLite and IndexedDB
  for (const item of items) {
    try {
      await productRepo.updateStock(tenantId, item.productId, -item.quantity);
    } catch (e) {
      console.warn('SQLite stock update error:', e);
    }
    try {
      await reduceStock(item.productId, item.quantity);
    } catch (e) {
      console.warn('IndexedDB stock update error:', e);
    }
  }

  // Mirror to offline DB
  try {
    await saveOfflineOrder({
      ...order,
      clientOrderId: order.orderNumber,
      syncStatus: 'synced',
    });
  } catch (e) {
    console.warn('Could not mirror order to offline DB:', e);
  }

  // Record in outbox for sync
  await outboxRepo.insert({
    id: crypto.randomUUID(),
    tenantId,
    entityType: 'order',
    entityId: order.id,
    operation: 'create',
    payload: order,
  });

  // Trigger sync
  recordOrderChange('create', order);

  return order;
}

export async function completeSale(input: {
  items: Array<{ productId: string; name: string; sku: string; quantity: number; price: number }>;
  customerId?: string | null;
  paymentMethod: Order['paymentMethod'];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
}): Promise<Order> {
  return createOrder(
    getCurrentTenantId(),
    input.items.map((i) => ({ ...i, discount: 0 })),
    input.paymentMethod,
    input.customerId || undefined,
    input.notes
  );
}

export async function printOrderReceipt(order: Order): Promise<void> {
  try {
    const { PrinterService } = await import('@genx/hardware');
    const printer = new PrinterService();
    await printer.printReceipt({
      businessName: 'GENX POS',
      orderNumber: order.orderNumber,
      date: new Date(order.createdAt).toLocaleString(),
      items: (order.items || []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        total: i.total,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      paymentMethod: order.paymentMethod,
    });
  } catch (err) {
    console.warn('Printer error:', err);
  }
}
