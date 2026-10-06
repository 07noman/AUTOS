import SyncEngine from '@genx/sync/SyncEngine';
import { outboxRepo, productRepo, orderRepo, getCurrentTenantId } from './db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const syncEngine = new SyncEngine(
  API_URL,
  getCurrentTenantId(),
  {
    getPendingOutbox: (tenantId, limit) => {
      const activeTenant = getCurrentTenantId();
      return outboxRepo.getPending(activeTenant, limit);
    },
    markOutboxSynced: (id) => outboxRepo.markSynced(id),
    markOutboxFailed: (id, error) => outboxRepo.markFailed(id, error),
    applyRemoteChange: async (change) => {
      // Phase 0: Validate change belongs to active tenant
      const activeTenant = getCurrentTenantId();
      if (change.tenant_id && change.tenant_id !== activeTenant) {
        console.warn('Sync rejected remote change belonging to another tenant:', change.tenant_id);
        return;
      }
      // TODO: Full bidirectional sync implementation deferred to Phase 2
      console.log('Applying remote change:', change);
    },
  }
);

export function initializeSync(): void {
  syncEngine.setTenantId(getCurrentTenantId());
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
