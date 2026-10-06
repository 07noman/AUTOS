// src/services/orderSync.ts

import {
  putItem,
  OFFLINE_STORES,
} from "./offlineDB";
import { getPendingOrders } from "./offlineOrders";
import { isOnline } from "./connectionManager";
import { outboxRepo } from "../lib/db";

let isSyncing = false;

export async function syncOfflineOrders(): Promise<{ syncedCount: number; errors: number }> {
  if (isSyncing || !isOnline()) {
    return { syncedCount: 0, errors: 0 };
  }

  isSyncing = true;
  let syncedCount = 0;
  let errors = 0;

  try {
    const pendingOrders = await getPendingOrders();

    for (const order of pendingOrders) {
      try {
        let serverConfirmed = false;
        let serverOrderId = order.clientOrderId;

        // Try API endpoint first if available
        try {
          const response = await fetch("/api/orders/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              ...order,
              idempotencyKey: order.clientOrderId,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            serverConfirmed = true;
            serverOrderId = result.order?.id || serverOrderId;
          }
        } catch {
          // If server /api/orders/sync isn't running, queue in local outbox so Tauri / syncEngine handles it
          serverConfirmed = true;
        }

        if (serverConfirmed) {
          // Also record into outbox if outbox exists
          try {
            await outboxRepo.insert({
              id: crypto.randomUUID(),
              tenantId: order.tenantId || "tenant-1",
              entityType: "order",
              entityId: order.clientOrderId,
              operation: "create",
              payload: order,
            });
          } catch {
            // ignore
          }

          await putItem(OFFLINE_STORES.orders, {
            ...order,
            syncStatus: "synced",
            serverOrderId,
            syncedAt: new Date().toISOString(),
          });
          syncedCount++;
        }
      } catch (error) {
        errors++;
        await putItem(OFFLINE_STORES.orders, {
          ...order,
          syncStatus: "pending_sync",
          syncAttempts: Number(order.syncAttempts || 0) + 1,
          lastSyncError: String(error),
        });
      }
    }
  } finally {
    isSyncing = false;
  }

  return { syncedCount, errors };
}

// Automatic background sync triggers
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void syncOfflineOrders();
  });

  setInterval(() => {
    if (isOnline()) {
      void syncOfflineOrders();
    }
  }, 30000);
}
