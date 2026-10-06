import type { Conflict, ConflictResolution } from './types';

export class ConflictResolver {
  private manualQueue: Conflict[] = [];

  detect(local: Record<string, unknown>, remote: Record<string, unknown>): Conflict | null {
    const localUpdated = Number(local.updatedAt ?? local.updated_at ?? 0);
    const remoteUpdated = Number(remote.updatedAt ?? remote.updated_at ?? 0);
    if (localUpdated === remoteUpdated) return null;
    return {
      entityType: String(local.entityType ?? remote.entityType ?? 'unknown'),
      entityId: String(local.id ?? remote.id ?? ''),
      local,
      remote,
    };
  }

  resolveAuto(local: Record<string, unknown>, remote: Record<string, unknown>): Record<string, unknown> {
    const localUpdated = Number(local.updatedAt ?? local.updated_at ?? 0);
    const remoteUpdated = Number(remote.updatedAt ?? remote.updated_at ?? 0);
    return localUpdated >= remoteUpdated ? local : remote;
  }

  queueManual(conflict: Conflict): void {
    this.manualQueue.push(conflict);
  }

  getManualQueue(): Conflict[] {
    return [...this.manualQueue];
  }

  async applyManual(resolution: ConflictResolution): Promise<void> {
    this.manualQueue = this.manualQueue.filter(
      (c) => `${c.entityType}:${c.entityId}` !== resolution.conflictId
    );
  }
}

export default ConflictResolver;
