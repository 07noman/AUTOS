# PHASE 0 — CHANGELOG

All changes implemented during Phase 0 Security & Tenant Hardening (October 7, 2026).

## Changed Files

### 1. `apps/api/src/index.ts`
- Added production environment check for `JWT_SECRET`; fails fast if missing in production.
- Replaced permissive CORS `origin: true` with strict environment-aware origin allowlist.
- Added startup log indicators for configuration presence (without logging raw secret values).

### 2. `apps/desktop/src/features/auto-care/AddProductModal.tsx`
- Replaced hardcoded `'tenant-1'` in duplicate barcode check with `getCurrentTenantId()`.
- Replaced hardcoded `'tenant-1'` in `createProduct.mutateAsync` with `activeTenantId`.

### 3. `apps/desktop/src/features/products/ProductForm.tsx`
- Imported `getCurrentTenantId` from `@/lib/db`.
- Replaced hardcoded `'tenant-1'` in form submission with `getCurrentTenantId()`.

### 4. `apps/desktop/src/features/pos/AdvancedPOS.tsx`
- Imported `getCurrentTenantId` from `@/lib/db`.
- Replaced `'tenant-1'` in `createOrder` call with `getCurrentTenantId()`.

### 5. `apps/desktop/src/features/pos/OrderService.ts`
- Imported `getCurrentTenantId` from `@/lib/db`.
- Replaced `'tenant-1'` in `completeSale` helper with `getCurrentTenantId()`.

### 6. `apps/desktop/src/features/dashboard/Dashboard.tsx`
- Replaced static `tenant-1` live query with dynamic `getCurrentTenantId()` dependency.

### 7. `apps/desktop/src/features/settings/SettingsPage.tsx`
- Removed `'tenant-1'` fallback in tenant display label; now displays `'N/A'` when unauthenticated.

### 8. `apps/desktop/src/lib/sync.ts`
- Initialized `syncEngine` with `getCurrentTenantId()` instead of hardcoded `'tenant-1'`.
- Updated pending outbox getter to pass current tenant ID.
- Added tenant validation check in `applyRemoteChange` to discard any remote changes not belonging to the current tenant.

### 9. `sync/src/SyncEngine.ts`
- Added `setTenantId(tenantId: string)` and `getTenantId()` methods to support dynamic tenant switching.

### 10. `apps/desktop/src/services/orderSync.ts`
- Replaced hardcoded fallback `'tenant-1'` in outbox creation with `getCurrentTenantId()`.

### 11. `apps/desktop/src/services/offlineDB.ts`
- Added `clearStore(storeName: string)` helper to support selective IndexedDB store purging on logout.

### 12. `apps/desktop/src/hooks/useAuth.ts`
- Updated `logout()` to remove `genx:selectedModule` and `genx:lastSyncTimestamp` alongside `genx:authToken`.
- Added automatic clearing of cached product/inventory stores on logout to prevent cross-tenant data leakage.

### 13. `vitest.config.ts`
- Configured `pool: 'forks'` for Windows compatibility.
- Added `tests/unit/**/*.test.ts` to test file pattern.

### 14. `tests/unit/phase0Security.test.ts` (New File)
- Added 5 unit regression tests covering tenant isolation, session logout cleanup, and production secret guards.
