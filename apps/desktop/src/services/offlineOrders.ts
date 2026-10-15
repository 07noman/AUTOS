// src/services/offlineOrders.ts

import {
  putItem,
  getAllItems,
  OFFLINE_STORES,
} from "./offlineDB";

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

  return offlineOrder;
}

export async function getPendingOrders(): Promise<any[]> {
  const orders = await getAllItems(OFFLINE_STORES.orders);

  return orders.filter(
    (order) => order && order.syncStatus === "pending_sync"
  );
}
