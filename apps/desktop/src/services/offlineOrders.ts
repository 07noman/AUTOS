// src/services/offlineOrders.ts

import {
  putItem,
  getAllItems,
  clearStore,
  OFFLINE_STORES,
} from "./offlineDB";
import { savePendingOrder } from "./pendingOrders";

export async function clearOfflineOrdersQueue(): Promise<void> {
  try {
    await clearStore(OFFLINE_STORES.orders);
    console.log('[offlineOrders] Offline orders queue cleared to prevent duplicate retries');
  } catch (err) {
    console.warn('[offlineOrders] Could not clear offline orders queue:', err);
  }
}

export function createClientOrderId(): string {
  return (
    "OFF-" +
    Date.now() +
    "-" +
    crypto.randomUUID().slice(0, 8)
  );
}

export async function saveOfflineOrder(order: any): Promise<any> {
  const clientOrderId = order.clientOrderId || order.id || createClientOrderId();

  const offlineOrder = {
    ...order,
    id: order.id || clientOrderId,
    clientOrderId,
    syncStatus: order.syncStatus || "pending_sync",
    createdOfflineAt: order.createdOfflineAt || new Date().toISOString(),
    syncAttempts: order.syncAttempts || 0,
  };

  await putItem(OFFLINE_STORES.orders, offlineOrder);

  // If offline or pending, ensure it is in pending_orders store as required
  const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
  if (isOffline || offlineOrder.syncStatus === "pending_sync" || offlineOrder.status === "pending") {
    try {
      await savePendingOrder({
        ...offlineOrder,
        id: offlineOrder.id,
        timestamp: Date.now(),
        status: "pending",
      });
    } catch (e) {
      console.warn('[offlineOrders] savePendingOrder mirror failed:', e);
    }
  }

  return offlineOrder;
}

export async function getPendingOrders(): Promise<any[]> {
  const orders = await getAllItems(OFFLINE_STORES.orders);

  return orders.filter(
    (order) => order && order.syncStatus === "pending_sync"
  );
}
