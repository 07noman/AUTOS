/**
 * Standalone Backfill Script:
 * Backfills phone numbers for old vehicle records using past POS orders and customer records.
 * 
 * Rules:
 * - Only additive updates.
 * - Does not overwrite existing vehicle phone if already set.
 * - Does not create duplicate vehicles.
 * - Logs the count of updated records.
 */

// Polyfill WebSocket in Node environment before Supabase client initializes
if (typeof (globalThis as any).WebSocket === 'undefined') {
  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 3;
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

import { backfillVehiclePhoneFromOrders, vehicleRepo } from '../apps/desktop/src/lib/auto-care-db';
import { getCurrentTenantId } from '../apps/desktop/src/lib/db';

(async () => {
  const tenantId = getCurrentTenantId();
  console.log(`[Backfill] Starting phone backfill for tenant: ${tenantId}...`);

  const result = await backfillVehiclePhoneFromOrders(tenantId);
  console.log(`[Backfill] Finished! Successfully updated ${result.updatedCount} vehicle(s) with phone numbers.`);

  const allVehicles = await vehicleRepo.findAll(tenantId);
  const withPhone = allVehicles.filter(v => v.phone);
  console.log(`[Backfill] Total vehicles: ${allVehicles.length}, vehicles with phone: ${withPhone.length}`);
})();
