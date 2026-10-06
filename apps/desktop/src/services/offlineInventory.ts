// src/services/offlineInventory.ts

import {
  getItem,
  putItem,
  OFFLINE_STORES,
} from "./offlineDB";

export interface InventoryRecord {
  productId: string;
  currentStock: number;
  trackInventory?: boolean;
  updatedAt: string;
}

export async function getStock(productId: string): Promise<number | null> {
  try {
    const inventory = await getItem(OFFLINE_STORES.inventory, productId);
    if (inventory && typeof inventory.currentStock === "number") {
      return inventory.currentStock;
    }
    const product = await getItem(OFFLINE_STORES.products, productId);
    if (product && typeof product.stock === "number") {
      return product.stock;
    }
  } catch (e) {
    console.warn("Error getting stock from offline DB:", e);
  }
  return null;
}

export async function setStock(
  productId: string,
  stock: number,
  trackInventory = true
): Promise<InventoryRecord> {
  const record: InventoryRecord = {
    productId,
    currentStock: stock,
    trackInventory,
    updatedAt: new Date().toISOString(),
  };
  await putItem(OFFLINE_STORES.inventory, record);
  return record;
}

export async function reduceStock(
  productId: string,
  quantity: number
): Promise<InventoryRecord | null> {
  const inventory = await getItem(OFFLINE_STORES.inventory, productId);

  if (!inventory) {
    // Fallback: check products store
    const product = await getItem(OFFLINE_STORES.products, productId);
    if (product) {
      if (product.metadata?.trackInventory === false) {
        return null;
      }

      const currentStock = Number(product.stock ?? 0);
      const newStock = Math.max(0, currentStock - quantity);

      const updatedProduct = {
        ...product,
        stock: newStock,
        updatedAt: Date.now(),
      };
      await putItem(OFFLINE_STORES.products, updatedProduct);

      const invRecord: InventoryRecord = {
        productId,
        currentStock: newStock,
        trackInventory: true,
        updatedAt: new Date().toISOString(),
      };
      await putItem(OFFLINE_STORES.inventory, invRecord);
      return invRecord;
    }

    return null;
  }

  if (inventory.trackInventory === false) {
    return inventory;
  }

  const currentStock = Number(inventory.currentStock || 0);
  const newStock = Math.max(0, currentStock - quantity);

  const updated: InventoryRecord = {
    ...inventory,
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  };

  await putItem(OFFLINE_STORES.inventory, updated);

  // Sync to product store
  try {
    const product = await getItem(OFFLINE_STORES.products, productId);
    if (product) {
      await putItem(OFFLINE_STORES.products, {
        ...product,
        stock: newStock,
        updatedAt: Date.now(),
      });
    }
  } catch (e) {
    // ignore
  }

  return updated;
}
