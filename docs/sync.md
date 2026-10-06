# Sync

Push: `POST /api/v1/sync/push` with JWT and `X-Tenant-ID`.

Pull: `GET /api/v1/sync/pull?since=<timestamp>`.

Implementation: `sync/src/SyncEngine.ts` and `apps/desktop/src/lib/sync.ts`.
