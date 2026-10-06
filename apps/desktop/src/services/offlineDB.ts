// src/services/offlineDB.ts

const DB_NAME = "genx_cloud_pos";
const DB_VERSION = 1;

export const OFFLINE_STORES = {
  products: "products",
  categories: "categories",
  taxes: "taxes",
  inventory: "inventory",
  orders: "offline_orders",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_STORES.products)) {
        db.createObjectStore(OFFLINE_STORES.products, {
          keyPath: "id",
        });
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORES.categories)) {
        db.createObjectStore(OFFLINE_STORES.categories, {
          keyPath: "id",
        });
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORES.taxes)) {
        db.createObjectStore(OFFLINE_STORES.taxes, {
          keyPath: "id",
        });
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORES.inventory)) {
        db.createObjectStore(OFFLINE_STORES.inventory, {
          keyPath: "productId",
        });
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORES.orders)) {
        const store = db.createObjectStore(OFFLINE_STORES.orders, {
          keyPath: "clientOrderId",
        });

        store.createIndex("syncStatus", "syncStatus", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function putItem(storeName: string, item: any): Promise<void> {
  const db = await openOfflineDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(item);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putMany(storeName: string, items: any[]): Promise<void> {
  const db = await openOfflineDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    items.forEach((item) => {
      store.put(item);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllItems(storeName: string): Promise<any[]> {
  const db = await openOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getItem(storeName: string, key: IDBValidKey): Promise<any> {
  const db = await openOfflineDB();

  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteItem(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openOfflineDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore in environments without indexedDB
  }
}

