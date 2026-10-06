// src/services/connectionManager.ts

type ConnectionListener = (online: boolean) => void;

let listeners: ConnectionListener[] = [];
let currentOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

export function isOnline(): boolean {
  return currentOnline;
}

export function subscribeConnection(listener: ConnectionListener): () => void {
  listeners.push(listener);
  listener(currentOnline);

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function updateConnection(online: boolean): void {
  if (currentOnline === online) {
    return;
  }

  currentOnline = online;

  listeners.forEach((listener) => {
    try {
      listener(online);
    } catch (e) {
      console.error("Connection listener error:", e);
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    updateConnection(true);
    void verifyServerConnection();
  });

  window.addEventListener("offline", () => {
    updateConnection(false);
  });
}

/*
 * navigator.onLine alone is not enough.
 * Check actual backend/network connectivity.
 */
export async function verifyServerConnection(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    updateConnection(false);
    return false;
  }

  try {
    // Attempt lightweight ping or static asset fetch with cache bust
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    }).catch(async () => {
      // If /api/health endpoint doesn't exist (e.g. static dev server), check if we can reach origin
      return await fetch(`/index.html?_t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
    });

    clearTimeout(timeoutId);

    const online = response.ok || response.status < 500;
    updateConnection(online);
    return online;
  } catch {
    // If fetch failed due to offline/network failure
    const online = typeof navigator !== "undefined" ? navigator.onLine : false;
    updateConnection(online);
    return online;
  }
}
