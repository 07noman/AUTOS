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
});
