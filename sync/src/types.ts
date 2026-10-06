export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncChange {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  client_timestamp: number;
}

export interface OutboxEntry {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  created_at: number;
}

export interface Conflict {
  entityType: string;
  entityId: string;
  local: Record<string, unknown>;
  remote: Record<string, unknown>;
}

export interface ConflictResolution {
  conflictId: string;
  merged: Record<string, unknown>;
}
