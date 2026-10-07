import { getDatabase, getCurrentTenantId } from './db';
import type { SyncState } from '@genx/types/sync';

export const syncStateRepo = {
  /**
   * Retrieves persistent sync cursor for a given tenant, device, and scope.
   */
  async getCursor(
    scope: string,
    deviceId: string,
    tenantId: string = getCurrentTenantId()
  ): Promise<string | null> {
    const db = await getDatabase();
    const rows = await db.select<{ cursor: string }[]>(
      'SELECT cursor FROM sync_state WHERE tenant_id = ? AND device_id = ? AND scope = ?',
      [tenantId, deviceId, scope]
    );
    return rows.length > 0 ? rows[0].cursor : null;
  },

  /**
   * Saves or updates persistent sync cursor for a given tenant, device, and scope.
   */
  async setCursor(
    scope: string,
    cursor: string,
    deviceId: string,
    tenantId: string = getCurrentTenantId()
  ): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    const existing = await db.select<{ id: string }[]>(
      'SELECT id FROM sync_state WHERE tenant_id = ? AND device_id = ? AND scope = ?',
      [tenantId, deviceId, scope]
    );

    if (existing.length > 0) {
      await db.execute(
        'UPDATE sync_state SET cursor = ?, updated_at = ? WHERE tenant_id = ? AND device_id = ? AND scope = ?',
        [cursor, now, tenantId, deviceId, scope]
      );
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO sync_state (id, tenant_id, device_id, scope, cursor, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, tenantId, deviceId, scope, cursor, now]
      );
    }
  },

  /**
   * Gets all sync state entries for current tenant.
   */
  async getAllForTenant(tenantId: string = getCurrentTenantId()): Promise<SyncState[]> {
    const db = await getDatabase();
    const rows = await db.select<any[]>(
      'SELECT * FROM sync_state WHERE tenant_id = ?',
      [tenantId]
    );
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      deviceId: r.device_id,
      scope: r.scope,
      cursor: r.cursor,
      updatedAt: r.updated_at,
    }));
  },
};
