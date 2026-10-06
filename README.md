# GENX

Offline-first POS + ERP for small and medium businesses.

## Quick start

```bash
pnpm install
pnpm dev:desktop    # http://localhost:3000
pnpm dev:api        # http://localhost:4000
```

**Login:** `demo@genx.com` / `password`

## Structure

Full tree: see `PROJECT_STRUCTURE.txt` in the repo root.

- `apps/desktop` — React + Vite POS (IndexedDB/Dexie locally; Tauri/SQLite ready to add)
- `apps/api` — Fastify sync & auth API
- `packages/ui` — GENX design system components
- `packages/types`, `packages/validation`, `packages/business-core`
- `sync`, `hardware` — Shared libraries
- `docs/` — Architecture and deployment notes
- `scripts/` — Setup, migrate, seed helpers
- `tests/` — Unit, integration, and Playwright E2E

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Turbo dev (desktop + api) |
| `pnpm build` | Build all apps |
| `pnpm test:unit` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E |

See `docs/development.md` and `docs/DEPLOYMENT.md` for more.
