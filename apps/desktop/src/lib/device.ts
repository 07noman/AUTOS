import { getDatabase } from './db';

const DEVICE_KEY = 'device_id';
let cachedDeviceId: string | null = null;

/**
 * Gets or creates the persistent logical Device ID stored in SQLite app_metadata table.
 * Persists across application restart and updates.
 * Cryptographically random UUID.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const db = await getDatabase();
  try {
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM app_metadata WHERE key = ?',
      [DEVICE_KEY]
    );

    if (rows.length > 0 && rows[0].value) {
      cachedDeviceId = rows[0].value;
      return cachedDeviceId;
    }

    // Generate stable random UUID
    const newId = crypto.randomUUID();
    const now = Date.now();
    await db.execute(
      'INSERT INTO app_metadata (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [DEVICE_KEY, newId, now, now]
    );

    cachedDeviceId = newId;
    return cachedDeviceId;
  } catch (err) {
    // If running in minimal mock without metadata table, fallback to persistent localStorage mock
    if (typeof window !== 'undefined' && window.localStorage) {
      const local = window.localStorage.getItem(`genx:${DEVICE_KEY}`);
      if (local) {
        cachedDeviceId = local;
        return cachedDeviceId;
      }
      const newId = crypto.randomUUID();
      window.localStorage.setItem(`genx:${DEVICE_KEY}`, newId);
      cachedDeviceId = newId;
      return cachedDeviceId;
    }
    return crypto.randomUUID();
  }
}

/** Resets in-memory cached device ID (used in unit testing) */
export function _resetDeviceCacheForTest(): void {
  cachedDeviceId = null;
}
