import SyncEngine from '@genx/sync/SyncEngine';
import { outboxRepo, productRepo, orderRepo } from './db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const syncEngine = new SyncEngine(
  API_URL,
  'tenant-1',
  {
    getPendingOutbox: (tenantId, limit) => outboxRepo.getPending(tenantId, limit),
    markOutboxSynced: (id) => outboxRepo.markSynced(id),
    markOutboxFailed: (id, error) => outboxRepo.markFailed(id, error),
    applyRemoteChange: async (change) => {
      // TODO: Implement based on entity type
      console.log('Applying remote change:', change);
    },
  }
);

export function initializeSync(): void {
  syncEngine.start(30000); // Sync every 30 seconds
}

export async function recordProductChange(
  operation: 'create' | 'update' | 'delete',
  product: any
): Promise<void> {
  // Already recorded in useProducts hook
  // Trigger sync if online
  void syncEngine.sync();
}

export async function recordOrderChange(
  operation: 'create' | 'update' | 'delete',
  order: any
): Promise<void> {
  // Already recorded in OrderService
  // Trigger sync if online
  void syncEngine.sync();
}
