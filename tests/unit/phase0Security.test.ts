import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCurrentTenantId } from '../../apps/desktop/src/lib/db';
import { useAuth } from '../../apps/desktop/src/hooks/useAuth';

describe('Phase 0 Security & Tenant Hardening Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Tenant Context Isolation', () => {
    it('getCurrentTenantId() returns tenant from authenticated user session', () => {
      const mockAuthState = {
        state: {
          user: {
            id: 'user-abc',
            email: 'owner@tenant-alpha.com',
            name: 'Alpha Owner',
            role: 'owner',
            tenantId: 'tenant-alpha-99',
          },
          token: 'mock-jwt-token-alpha',
          isAuthenticated: true,
        },
      };

      localStorage.setItem('genx-auth', JSON.stringify(mockAuthState));
      expect(getCurrentTenantId()).toBe('tenant-alpha-99');
    });

    it('getCurrentTenantId() falls back safely to tenant-1 only when unauthenticated', () => {
      localStorage.removeItem('genx-auth');
      expect(getCurrentTenantId()).toBe('tenant-1');
    });

    it('prevents tenant crossover when session changes', () => {
      // First session: Tenant 100
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({
          state: { user: { tenantId: 'tenant-100' }, isAuthenticated: true },
        })
      );
      expect(getCurrentTenantId()).toBe('tenant-100');

      // Logout / switch to Tenant 200
      localStorage.setItem(
        'genx-auth',
        JSON.stringify({
          state: { user: { tenantId: 'tenant-200' }, isAuthenticated: true },
        })
      );
      expect(getCurrentTenantId()).toBe('tenant-200');
      expect(getCurrentTenantId()).not.toBe('tenant-100');
    });
  });

  describe('Session & Cache Isolation on Logout', () => {
    it('logout removes authentication token and transient sync keys', () => {
      localStorage.setItem('genx:authToken', 'sample-jwt-token-xyz');
      localStorage.setItem('genx:selectedModule', 'auto_care');
      localStorage.setItem('genx:lastSyncTimestamp', '1728000000');

      useAuth.getState().logout();

      expect(localStorage.getItem('genx:authToken')).toBeNull();
      expect(localStorage.getItem('genx:selectedModule')).toBeNull();
      expect(localStorage.getItem('genx:lastSyncTimestamp')).toBeNull();
      expect(useAuth.getState().isAuthenticated).toBe(false);
      expect(useAuth.getState().user).toBeNull();
    });
  });

  describe('Environment Secret Hardening Rule', () => {
    it('rejects empty or missing JWT secret in production mode simulation', () => {
      const checkProductionJwtSecret = (envNodeEnv: string, secret?: string) => {
        const isProd = envNodeEnv === 'production';
        if (isProd && !secret) {
          throw new Error('JWT_SECRET missing in production');
        }
        return secret || 'dev-default-secret';
      };

      expect(() => checkProductionJwtSecret('production', '')).toThrow('JWT_SECRET missing in production');
      expect(() => checkProductionJwtSecret('production', undefined)).toThrow('JWT_SECRET missing in production');
      expect(checkProductionJwtSecret('production', 'valid-production-secret-min-32-chars')).toBe(
        'valid-production-secret-min-32-chars'
      );
      expect(checkProductionJwtSecret('development', undefined)).toBe('dev-default-secret');
    });
  });

  describe('Cross-Tenant Data Isolation Simulation', () => {
    interface MockProduct {
      id: string;
      tenantId: string;
      name: string;
      price: number;
    }

    const mockDatabase: MockProduct[] = [
      { id: 'p1', tenantId: 'tenant-A', name: 'Tenant A Oil Filter', price: 25 },
      { id: 'p2', tenantId: 'tenant-B', name: 'Tenant B Brake Pad', price: 45 },
    ];

    const getProductsForTenant = (authenticatedTenantId: string): MockProduct[] => {
      // Simulates Drizzle/SQL eq(products.tenantId, authenticatedTenantId)
      return mockDatabase.filter((p) => p.tenantId === authenticatedTenantId);
    };

    const modifyProduct = (
      authenticatedTenantId: string,
      productId: string,
      newPrice: number
    ): boolean => {
      // Server-side ownership rule: MUST match both id AND authenticated tenantId
      const target = mockDatabase.find(
        (p) => p.id === productId && p.tenantId === authenticatedTenantId
      );
      if (!target) return false;
      target.price = newPrice;
      return true;
    };

    it('Tenant A can read its own products but cannot see Tenant B products', () => {
      const tenantAProducts = getProductsForTenant('tenant-A');
      expect(tenantAProducts).toHaveLength(1);
      expect(tenantAProducts[0].name).toBe('Tenant A Oil Filter');

      const containsTenantBData = tenantAProducts.some((p) => p.tenantId === 'tenant-B');
      expect(containsTenantBData).toBe(false);
    });

    it('Tenant B cannot modify Tenant A products even if productId is known', () => {
      // Attacker from Tenant B attempts to modify Tenant A's product 'p1'
      const modified = modifyProduct('tenant-B', 'p1', 999);
      expect(modified).toBe(false);

      // Verify Tenant A's product was not altered
      const originalProduct = mockDatabase.find((p) => p.id === 'p1');
      expect(originalProduct?.price).toBe(25);
    });
  });
});
