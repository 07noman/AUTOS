import { create } from 'zustand';
import { outboxRepo } from '@/lib/db';
import { syncEngine } from '@/lib/sync';

type ConnectivityStatus = 'online' | 'offline';
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface ConnectivityState {
  status: ConnectivityStatus;
  syncStatus: SyncStatus;
  pendingCount: number;
  refreshPending: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

export const useConnectivity = create<ConnectivityState>((set) => ({
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  syncStatus: 'idle',
  pendingCount: 0,
  refreshPending: async () => {
    const pendingCount = await outboxRepo.pendingCount();
    set({ pendingCount });
  },
  triggerSync: async () => {
    set({ syncStatus: 'syncing' });
    const result = await syncEngine.sync();
    const pendingCount = await outboxRepo.pendingCount();
    set({
      syncStatus: result.success ? 'synced' : 'error',
      pendingCount,
    });
    if (result.success) {
      setTimeout(() => set({ syncStatus: 'idle' }), 3000);
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useConnectivity.setState({ status: 'online' });
    void useConnectivity.getState().triggerSync();
  });
  window.addEventListener('offline', () => {
    useConnectivity.setState({ status: 'offline', syncStatus: 'idle' });
  });
  setInterval(() => void useConnectivity.getState().refreshPending(), 5000);
}
