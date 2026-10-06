import { OutboxEntry, SyncResult, SyncStatus, SyncChange } from './types';

export class SyncEngine {
  private apiBaseUrl: string;
  private tenantId: string;
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private getPendingOutbox: (tenantId: string, limit: number) => Promise<OutboxEntry[]>;
  private markOutboxSynced: (id: string) => Promise<void>;
  private markOutboxFailed: (id: string, error: string) => Promise<void>;
  private applyRemoteChange: (change: any) => Promise<void>;

  constructor(
    apiBaseUrl: string,
    tenantId: string,
    dependencies: {
      getPendingOutbox: (tenantId: string, limit: number) => Promise<OutboxEntry[]>;
      markOutboxSynced: (id: string) => Promise<void>;
      markOutboxFailed: (id: string, error: string) => Promise<void>;
      applyRemoteChange: (change: any) => Promise<void>;
    }
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.tenantId = tenantId;
    this.getPendingOutbox = dependencies.getPendingOutbox;
    this.markOutboxSynced = dependencies.markOutboxSynced;
    this.markOutboxFailed = dependencies.markOutboxFailed;
    this.applyRemoteChange = dependencies.applyRemoteChange;
  }

  start(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline && !this.isSyncing) {
        await this.sync();
      }
    }, intervalMs);

    // Initial sync
    void this.sync();
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: ['Sync in progress'] };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      const pushResult = await this.pushChanges();
      result.syncedCount += pushResult.synced;
      result.failedCount += pushResult.failed;
      result.errors.push(...pushResult.errors);

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isOnline) {
        const pullResult = await this.pullChanges();
        result.syncedCount += pullResult.synced;
      }

      if (result.failedCount > 0) {
        result.success = false;
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async pushChanges(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const result = { synced: 0, failed: 0, errors: [] as string[] };

    const pendingEntries = await this.getPendingOutbox(this.tenantId, 100);

    if (pendingEntries.length === 0) {
      return result;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'X-Tenant-ID': this.tenantId,
        },
        body: JSON.stringify({
          changes: pendingEntries.map(entry => ({
            id: entry.id,
            entity_type: entry.entity_type,
            entity_id: entry.entity_id,
            operation: entry.operation,
            payload: typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload,
            client_timestamp: entry.created_at,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const syncResponse = await response.json();

      for (const id of syncResponse.synced || []) {
        await this.markOutboxSynced(id);
        result.synced++;
      }

      for (const error of syncResponse.errors || []) {
        await this.markOutboxFailed(error.id, error.message);
        result.failed++;
        result.errors.push(error.message);
      }
    } catch (error) {
      // Network error - mark all as failed
      for (const entry of pendingEntries) {
        await this.markOutboxFailed(entry.id, error instanceof Error ? error.message : 'Network error');
        result.failed++;
      }
      result.errors.push('Network error');
    }

    return result;
  }

  private async pullChanges(): Promise<{ synced: number }> {
    const lastSyncTimestamp = await this.getLastSyncTimestamp();

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/sync/pull?since=${lastSyncTimestamp}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await this.getAuthToken()}`,
            'X-Tenant-ID': this.tenantId,
          },
        }
      );

      if (!response.ok) {
        return { synced: 0 };
      }

      const syncResponse = await response.json();

      for (const change of syncResponse.changes || []) {
        await this.applyRemoteChange(change);
      }

      await this.setLastSyncTimestamp(syncResponse.last_timestamp);

      return { synced: syncResponse.changes?.length || 0 };
    } catch (error) {
      console.error('Pull failed:', error);
      return { synced: 0 };
    }
  }

  private async getLastSyncTimestamp(): Promise<number> {
    if (typeof localStorage === 'undefined') return 0;
    const stored = localStorage.getItem('genx:lastSyncTimestamp');
    return stored ? parseInt(stored, 10) : 0;
  }

  private async setLastSyncTimestamp(timestamp: number): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('genx:lastSyncTimestamp', timestamp.toString());
  }

  private async getAuthToken(): Promise<string> {
    if (typeof localStorage === 'undefined') return '';
    const stored = localStorage.getItem('genx:authToken');
    return stored || '';
  }
}

export default SyncEngine;
