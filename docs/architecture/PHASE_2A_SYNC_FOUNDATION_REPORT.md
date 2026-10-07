# GENX CLOUD POS — PHASE 2A ARCHITECTURE REPORT
## Offline-First Sync Foundation & Inventory Movement Ledger

---

## 1. Executive Summary

Phase 2A establishes the local persistence and data integrity foundation required for multi-terminal offline operation and future cloud push/pull delta synchronization.

**Core Invariants Established:**
1. **Dynamic Tenant Context:** Statically captured tenant context (`export const TENANT_ID = getCurrentTenantId()`) evaluated at module-load time was completely removed. All database repositories now evaluate `getCurrentTenantId()` at query time. Hardcoded demo data seeding under `tenant-1` was eliminated.
2. **Versioned SQLite Migration Infrastructure:** Introduced `schema_migrations` table and sequential versioned migration runner (`v1_initial_schema`, `v2_phase_2a_sync_and_inventory_foundation`) ensuring databases upgrade safely and idempotently without data loss.
3. **Persistent Logical Device Identity:** Created stable UUID device identity stored in local SQLite `app_metadata` (`device_id`). Does not change across restarts or logins and does not expose hardware signatures.
4. **Local Sync State:** Created `sync_state` SQLite table for persistent sync cursors keyed by `(tenant_id, device_id, scope)`. Removed dependence on volatile browser `localStorage`.
5. **Upgraded Outbox Schema:** Extended `outbox` table with `device_id`, `idempotency_key`, `version`, and `sequence_number`.
6. **Immutable Inventory Movement Ledger:** Implemented `stock_movements` table (`SALE`, `PURCHASE`, `ADJUSTMENT`, `RETURN`, `TRANSFER`, `OPENING_BALANCE`). Sales transactions in both Retail POS (`orderRepo.createAtomicSale`) and Auto Care POS (`posOrderRepo.createPaid`) atomically decrement cached `products.stock` while appending an immutable movement record within a single SQLite transaction.

---

## 2. Migration Architecture

The SQLite layer previously relied on unversioned `CREATE TABLE IF NOT EXISTS` blocks. In Phase 2A, a single unified migration engine was established in `apps/desktop/src/lib/migrations.ts`:

- **Tracking Table:**
  ```sql
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  );
  ```
- **Migration v1 (`initial_schema`):** Creates baseline tables (`products`, `orders`, `order_items`, `outbox`, `customers`, `vehicles`, `auto_care_services`, `service_jobs`, `service_job_items`, `auto_care_invoices`, `pos_orders`) and core indexes.
- **Migration v2 (`phase_2a_sync_and_inventory_foundation`):**
  - Creates `app_metadata` for device identity and configuration key-values.
  - Creates `sync_state` with unique constraint `UNIQUE(tenant_id, device_id, scope)`.
  - Creates `stock_movements` ledger with unique constraint `UNIQUE(tenant_id, reference_type, reference_id, product_id)`.
  - Non-destructively alters `outbox` to add `device_id`, `idempotency_key`, `version`, `sequence_number`.

---

## 3. Dynamic Tenant Context Resolution

- **Problem in Phase 1:** `export const TENANT_ID = getCurrentTenantId()` was evaluated once when the JavaScript bundle loaded. If unauthenticated, it resolved to `'tenant-1'` and remained frozen in closures across user logins.
- **Phase 2A Solution:**
  - All repository method signatures default to `getCurrentTenantId()`.
  - All callers in `AutoCarePOS.tsx`, `NewJobForm.tsx`, `VehiclesView.tsx`, `POSOrdersPage.tsx`, and `useCustomers.ts` pass or dynamically resolve the active tenant ID.
  - Hardcoded seeding of sample products into `tenant-1` in `initializeDatabase()` was deleted.

---

## 4. Persistent Device Identity

- **Module:** `apps/desktop/src/lib/device.ts`
- **Method:** `getDeviceId(): Promise<string>`
- **Storage:** Persisted in SQLite `app_metadata` (`key = 'device_id'`).
- **Characteristics:** Cryptographically random UUID, generated exactly once, persistent across application updates and restarts, unlinked from hardware serial numbers.

---

## 5. Local Sync State

- **Module:** `apps/desktop/src/lib/sync-state.ts`
- **Table:** `sync_state`
- **Schema:**
  ```sql
  CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    cursor TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(tenant_id, device_id, scope)
  );
  ```
- Eliminates volatile `genx:lastSyncTimestamp` in `localStorage`.

---

## 6. Upgraded Outbox Specification

- **Module:** `apps/desktop/src/lib/db.ts` (`outboxRepo`)
- **Schema Expansion:**
  - `device_id TEXT NOT NULL`: Identifies originating terminal.
  - `idempotency_key TEXT NOT NULL`: Deterministic key (`${entityType}:${tenantId}:${entityId}`) preventing duplicate cloud mutations upon retry.
  - `version INTEGER NOT NULL DEFAULT 1`: Entity version counter.
  - `sequence_number INTEGER`: Monotonic stream sequence indicator.

---

## 7. Inventory Movement Ledger

- **Module:** `apps/desktop/src/lib/stock-movements.ts`
- **Types:** `@genx/types/domain/inventory` (`StockMovement`, `MovementType`, `ReferenceType`)
- **Schema:**
  ```sql
  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity_delta REAL NOT NULL,
    movement_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(tenant_id, reference_type, reference_id, product_id)
  );
  ```
- **Atomicity Invariant:**
  ```text
  BEGIN TRANSACTION
    1. Verify stock >= quantity
    2. UPDATE products SET stock = stock - delta
    3. INSERT INTO stock_movements (quantity_delta = -delta)
    4. INSERT INTO orders / pos_orders
    5. INSERT INTO order_items
    6. INSERT INTO outbox (with device_id & idempotency_key)
  COMMIT
  ```
  If any step fails, the entire transaction rolls back.

---

## 8. Verification & Test Suite

All 22 unit tests pass across 4 test suites:

```text
✓ tests/unit/phase2aSyncFoundation.test.ts  (10 tests)
✓ tests/unit/phase0Security.test.ts         (7 tests)
✓ tests/unit/phase1Persistence.test.ts      (4 tests)
✓ tests/unit/button.test.tsx                (1 test)

Total: 22 / 22 PASS
Typecheck: 0 errors across all 8 packages (turbo run typecheck)
```

---

## 9. Deferred Scope (Phase 2B & 2C)

The following capabilities are deliberately **not** implemented in Phase 2A:
1. **Cloud Push Engine:** Transmitting local outbox batches to cloud endpoints.
2. **Cloud Pull Engine:** Querying cloud delta APIs and applying remote entity changes to local SQLite.
3. **Conflict Resolution:** Resolving divergent records or concurrent offline transactions.
4. **Cloud Migration:** Adding matching server-side tables and delta changelogs to PostgreSQL.
5. **Register / Branch Management:** Full multi-lane hierarchy models.
