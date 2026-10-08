import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@genx/types';

// ─── Local Offline Credential Store ──────────────────────────────────────────
// When the API server is unreachable, we store credentials locally so the user
// can log back in after logout without needing the server.
const OFFLINE_CREDS_KEY = 'genx:offline-creds';

interface OfflineCred {
  email: string;
  passwordHash: string; // simple obfuscation — NOT real security, just prevents plaintext
  user: User;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

const DEFAULT_TEST_CREDS: Record<string, OfflineCred> = {
  'clienta@test.com': {
    email: 'clienta@test.com',
    passwordHash: simpleHash('password123'),
    user: {
      id: 'user-client-a',
      email: 'clienta@test.com',
      name: 'Client A Admin',
      role: 'owner',
      tenantId: 'client-a',
    },
  },
  'clientb@test.com': {
    email: 'clientb@test.com',
    passwordHash: simpleHash('password123'),
    user: {
      id: 'user-client-b',
      email: 'clientb@test.com',
      name: 'Client B Admin',
      role: 'owner',
      tenantId: 'client-b',
    },
  },
  'demo@genx.com': {
    email: 'demo@genx.com',
    passwordHash: simpleHash('password'),
    user: {
      id: 'user-1',
      email: 'demo@genx.com',
      name: 'Demo User',
      role: 'owner',
      tenantId: 'tenant-1',
    },
  },
};

function saveOfflineCred(email: string, password: string, user: User) {
  const all = getOfflineCreds();
  all[email.toLowerCase()] = { email, passwordHash: simpleHash(password), user };
  localStorage.setItem(OFFLINE_CREDS_KEY, JSON.stringify(all));
}

function getOfflineCreds(): Record<string, OfflineCred> {
  try {
    const custom = JSON.parse(localStorage.getItem(OFFLINE_CREDS_KEY) || '{}');
    return { ...DEFAULT_TEST_CREDS, ...custom };
  } catch {
    return { ...DEFAULT_TEST_CREDS };
  }
}

function verifyOfflineCred(email: string, password: string): User | null {
  const cred = getOfflineCreds()[email.toLowerCase()];
  if (!cred) return null;
  if (cred.passwordHash !== simpleHash(password)) return null;
  return cred.user;
}

// ─── Auth State ───────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerStore: (data: {
    storeName: string;
    storeCode: string;
    businessType?: string;
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const res = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal: AbortSignal.timeout(5000),
          });

          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error || `Login failed (${res.status})`);
          }

          const data = (await res.json()) as { user: User; token: string };
          localStorage.setItem('genx:authToken', data.token);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false, error: null });

        } catch (err: unknown) {
          // ── Offline fallback ──────────────────────────────────────────
          // Check locally saved offline credentials when network/server is unreachable
          const offlineUser = verifyOfflineCred(email, password);
          if (offlineUser) {
            localStorage.setItem('genx:authToken', 'offline-dev');
            set({ user: offlineUser, token: 'offline-dev', isAuthenticated: true, isLoading: false, error: null });
            return;
          }

          const message = err instanceof Error ? err.message : 'Login failed';
          set({ isLoading: false, error: message, isAuthenticated: false });
          throw err;
        }
      },

      registerStore: async (inputData) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData),
          });

          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error || `Registration failed (${res.status})`);
          }

          const data = (await res.json()) as { user: User; token: string };
          localStorage.setItem('genx:authToken', data.token);
          // Also save offline creds for dev offline support
          saveOfflineCred(inputData.email, inputData.password, data.user);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false, error: null });

        } catch (err: unknown) {
          // ── Offline registration fallback (Development Only) ────────────
          const isDev = import.meta.env.DEV;
          const isNetworkError = err instanceof Error &&
            (err.message.includes('Failed to fetch') || err.message.includes('fetch') || err.message.includes('NetworkError'));

          if (isDev && isNetworkError) {
            const tenantId = `tenant-${(inputData.storeCode || inputData.storeName).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const offlineUser: User = {
              id: crypto.randomUUID(),
              email: inputData.email,
              name: inputData.name,
              role: 'owner',
              tenantId,
            };
            // Save credentials locally so login works in dev
            saveOfflineCred(inputData.email, inputData.password, offlineUser);
            localStorage.setItem('genx:authToken', 'offline-dev');
            set({ user: offlineUser, token: 'offline-dev', isAuthenticated: true, isLoading: false, error: null });
            return;
          }

          const message = err instanceof Error ? err.message : 'Registration failed';
          set({ isLoading: false, error: message, isAuthenticated: false });
          throw err;
        }
      },

      logout: () => {
        // Clear authentication tokens and tenant credentials
        localStorage.removeItem('genx:authToken');
        localStorage.removeItem('genx:selectedModule');
        localStorage.removeItem('genx:lastSyncTimestamp');

        // Clear transient UI state
        set({ user: null, token: null, isAuthenticated: false, error: null });

        // Purge client-side cached product and customer stores from previous tenant
        try {
          import('@/services/offlineDB').then(({ clearStore, OFFLINE_STORES }) => {
            void clearStore(OFFLINE_STORES.products);
            void clearStore(OFFLINE_STORES.categories);
            void clearStore(OFFLINE_STORES.inventory);
          }).catch(() => {});
        } catch {
          // ignore
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'genx-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
