import { describe, it, expect, beforeAll } from 'vitest';
import { SyncEngine } from '../../sync/src/SyncEngine';

// Minimal in-memory stubs for dependency injection
const makeStubs = () => ({
  getPendingOutbox: async (_tenantId: string, _limit: number) => [],
  markOutboxSynced: async (_id: string) => {},
  markOutboxFailed: async (_id: string, _error: string) => {},
  applyRemoteChange: async (_change: unknown) => {},
});

describe('Sync Engine', () => {
  let syncEngine: SyncEngine;

  beforeAll(() => {
    syncEngine = new SyncEngine('http://localhost:4000', 'tenant-1', makeStubs());
  });

  it('should instantiate correctly', () => {
    expect(syncEngine).toBeDefined();
  });

  it('should handle offline mode gracefully', async () => {
    // Simulate offline
    Object.defineProperty(global, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    });

    const result = await syncEngine.sync();

    // Should not throw, should return a result
    expect(result).toBeDefined();
  });

  it('should sync with empty outbox (no-op)', async () => {
    Object.defineProperty(global, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });

    // No pending entries → push pushes 0 items; pull skips if API is down
    const result = await syncEngine.sync();
    expect(result).toBeDefined();
  });
});
