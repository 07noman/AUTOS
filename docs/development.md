# Development

## Prerequisites

- Node.js 20+
- pnpm 8+

## Commands

```bash
pnpm install
pnpm dev:desktop
pnpm dev:api
pnpm typecheck
```

Desktop uses **Dexie (IndexedDB)** for offline storage in the browser. Production desktop builds can swap `src/lib/db.ts` for Tauri SQLite as described in `docs/database.md`.
