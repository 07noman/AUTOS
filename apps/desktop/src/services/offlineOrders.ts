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
  const clientOrderId = order.clientOrderId || createClientOrderId();

  const offlineOrder = {
    ...order,
    clientOrderId,
    syncStatus: "pending_sync",
    createdOfflineAt: new Date().toISOString(),
    syncAttempts: 0,
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
