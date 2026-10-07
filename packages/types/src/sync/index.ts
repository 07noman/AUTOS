export interface SyncState {
  id: string;
  tenantId: string;
  deviceId: string;
  scope: string; // e.g. 'products', 'orders', 'stock_movements'
  cursor: string; // e.g. timestamp or revision watermark
  updatedAt: number;
}

export interface OutboxEntry {
  id: string;
  tenantId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  idempotencyKey: string;
  version: number;
  sequenceNumber?: number;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  lastAttemptAt?: number | null;
  syncedAt?: number | null;
  error?: string | null;
  createdAt: number;
}

export interface DeviceInfo {
  deviceId: string;
  platform?: string;
  createdAt: number;
}
