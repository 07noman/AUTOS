# Phase 1 Changelog: SQLite Authority & Inventory Integrity

## Overview
Phase 1 focuses on making local SQLite database the sole source of truth for the desktop application, introducing ACID transactions for checkout, eliminating dual-write race conditions with IndexedDB, and ensuring negative inventory is strictly prevented.

## Changes by File

### 1. `apps/desktop/src/lib/db.ts`
- **SQLite Configuration**:
  - Added `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, and `PRAGMA foreign_keys = ON;` in `initializeDatabase()`.
- **Database Transaction Extension**:
  - Implemented `db.transaction()` method on `Database.prototype` using SQL transaction control (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`).
- **Stock Guard**:
  - Updated `productRepo.updateStock` to verify existing stock before subtracting, preventing negative inventory.
- **Atomic Sale Engine**:
  - Added `orderRepo.createAtomicSale`:
    - Validates product existence and stock sufficiency.
    - Decrements stock in `products` table.
    - Writes order in `orders` table.
    - Writes items in `order_items` table.
    - Writes outbox record in `outbox` table.
    - Wraps all operations in a single database transaction.

### 2. `apps/desktop/src/features/pos/OrderService.ts`
- **Atomic Checkout Migration**:
  - Rewrote `createOrder()` to invoke `orderRepo.createAtomicSale()`.
  - Removed duplicate stock deduction calls.
  - Restricted `saveOfflineOrder` (IndexedDB) to web browser environments (`!isTauri()`), eliminating dual-write in production.

### 3. `apps/desktop/src/lib/auto-care-db.ts`
- **Transactional Auto Care Checkout**:
  - Refactored `posOrderRepo.createPaid()` to run inside `db.transaction()`.
  - Atomically verifies and deducts inventory for parts in cart.
  - Updates/Inserts `pos_orders` and inserts `outbox` mutation records in the same transaction.

### 4. `apps/desktop/src/features/auto-care/AutoCarePOS.tsx`
- **Eliminated Redundant Stock Deduction**:
  - Removed secondary `reduceStock()` calls from `handlePOSPayment()` so inventory is only adjusted once via `posOrderRepo.createPaid()`.
  - Fixed `TENANT_ID` and tenant context propagation.

### 5. `apps/desktop/src/lib/tauri-mock.ts`
- **Browser/Test Mock Extensions**:
  - Added support for `UPDATE products SET stock = stock - ?`.
  - Added support for `SELECT * FROM outbox ...` queries with tenant isolation.
  - Fixed parameter unpacking for `INSERT INTO outbox` supporting both 7-parameter and 8-parameter SQL statements.

### 6. `tests/unit/phase1Persistence.test.ts`
- **Automated Regression Suite**:
  - Added unit test: SQLite as authoritative product/stock store.
  - Added unit test: Atomic sale execution with stock reduction and outbox creation.
  - Added unit test: Negative stock prevention and transaction rollback.
  - Added unit test: 100 consecutive sales simulation confirming zero data loss and exact inventory tally.
