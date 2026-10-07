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

  // Execute atomic sale in authoritative SQLite database:
  // Order + Items + Stock Deduction + Outbox event commit together in one transaction.
  await orderRepo.createAtomicSale(order, dbItems);

  // Optional: In non-Tauri browser development mode only, mirror to offline IndexedDB for testing
  if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__ && !(window as any).__TAURI__) {
    try {
      await saveOfflineOrder({
        ...order,
        clientOrderId: order.orderNumber,
        syncStatus: 'synced',
      });
    } catch {
      // browser mock ignore
    }
  }

  // Trigger sync notification
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
