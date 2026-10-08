import { OutboxEntry, SyncResult, SyncChange } from './types';

export interface SyncEngineDependencies {
  getPendingOutbox: (tenantId: string, limit: number) => Promise<OutboxEntry[]>;
  markOutboxSynced: (id: string) => Promise<void>;
  markOutboxFailed: (id: string, error: string) => Promise<void>;
  applyRemoteChange: (change: any) => Promise<void>;
  getCursor?: (scope: string) => Promise<string | null>;
  setCursor?: (scope: string, cursor: string) => Promise<void>;
  getDeviceId?: () => Promise<string>;
}

export class SyncEngine {
  private apiBaseUrl: string;
  private tenantId: string;
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private readonly baseBackoffMs = 1000;
  private readonly maxBackoffMs = 30000;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

  private getPendingOutbox: (tenantId: string, limit: number) => Promise<OutboxEntry[]>;
  private markOutboxSynced: (id: string) => Promise<void>;
  private markOutboxFailed: (id: string, error: string) => Promise<void>;
  private applyRemoteChange: (change: any) => Promise<void>;
  private getCursor?: (scope: string) => Promise<string | null>;
  private setCursor?: (scope: string, cursor: string) => Promise<void>;
  private getDeviceId?: () => Promise<string>;

  constructor(
    apiBaseUrl: string,
    tenantId: string,
    dependencies: SyncEngineDependencies
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.tenantId = tenantId;
    this.getPendingOutbox = dependencies.getPendingOutbox;
    this.markOutboxSynced = dependencies.markOutboxSynced;
    this.markOutboxFailed = dependencies.markOutboxFailed;
    this.applyRemoteChange = dependencies.applyRemoteChange;
    this.getCursor = dependencies.getCursor;
    this.setCursor = dependencies.setCursor;
    this.getDeviceId = dependencies.getDeviceId;

    // Listen for online events to resume sync immediately
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.retryCount = 0;
        void this.sync();
      });
    }
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

    // Immediate initial sync attempt
    void this.sync();
  }

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  getTenantId(): string {
    return this.tenantId;
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  calculateBackoff(): number {
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, this.retryCount));
    const jitter = exp * (0.8 + Math.random() * 0.4); // +/- 20% jitter
    return Math.floor(jitter);
  }

  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: ['Sync in progress'] };
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      return { success: true, syncedCount: 0, failedCount: 0, errors: ['Offline mode: operation deferred'] };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // 1. Push pending local outbox records to cloud
      const pushResult = await this.pushChanges();
      result.syncedCount += pushResult.synced;
      result.failedCount += pushResult.failed;
      result.errors.push(...pushResult.errors);

      // 2. Pull remote changes from cloud
      const pullResult = await this.pullChanges();
      result.syncedCount += pullResult.synced;

      if (result.failedCount === 0) {
        this.retryCount = 0; // Reset backoff on full success
      } else {
        result.success = false;
        this.scheduleRetry();
      }
    } catch (error) {
      result.success = false;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(msg);
      this.scheduleRetry();
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private scheduleRetry(): void {
    this.retryCount++;
    const delay = this.calculateBackoff();
    if (this.backoffTimer) clearTimeout(this.backoffTimer);
    this.backoffTimer = setTimeout(() => {
      void this.sync();
    }, delay);
  }

  async pushChanges(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const result = { synced: 0, failed: 0, errors: [] as string[] };

    const pendingEntries = await this.getPendingOutbox(this.tenantId, 100);
    if (!pendingEntries || pendingEntries.length === 0) {
      return result;
    }

    try {
      const deviceId = this.getDeviceId ? await this.getDeviceId() : 'unknown-device';

      const payload = {
        changes: pendingEntries.map((entry) => ({
          id: entry.id,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          operation: entry.operation,
          payload: typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload,
          idempotency_key: entry.idempotency_key || `${entry.entity_type}:${this.tenantId}:${entry.entity_id}`,
          device_id: entry.device_id || deviceId,
          version: entry.version || 1,
          sequence_number: entry.sequence_number,
          client_timestamp: entry.created_at,
        })),
      };

      const response = await fetch(`${this.apiBaseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
          'X-Tenant-ID': this.tenantId,
        },
        body: JSON.stringify(payload),
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
        await this.markOutboxFailed(error.id, error.error || error.message || 'Push rejected');
        result.failed++;
        result.errors.push(error.error || error.message || 'Push rejected');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      for (const entry of pendingEntries) {
        await this.markOutboxFailed(entry.id, msg);
        result.failed++;
      }
      result.errors.push(msg);
    }

    return result;
  }

  async pullChanges(): Promise<{ synced: number }> {
    try {
      const cursor = this.getCursor ? (await this.getCursor('global')) || '0' : '0';

      const response = await fetch(
        `${this.apiBaseUrl}/api/v1/sync/pull?since=${encodeURIComponent(cursor)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await this.getAuthToken()}`,
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

      const newCursor = syncResponse.last_timestamp || syncResponse.cursor;
      if (newCursor && this.setCursor) {
        await this.setCursor('global', String(newCursor));
      }

      return { synced: syncResponse.changes?.length || 0 };
    } catch (error) {
      console.warn('Pull failed:', error);
      return { synced: 0 };
    }
  }

  private async getAuthToken(): Promise<string> {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('genx:authToken') || 'offline-dev';
  }
}

export default SyncEngine;
