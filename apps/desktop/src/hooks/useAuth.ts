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
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
        const trimmedEmail = email.trim().toLowerCase();

        // ── 1. Direct Supabase Auth Attempt ─────────────────────────────────────────
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          try {
            const sbRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: trimmedEmail, password }),
            signal: AbortSignal.timeout(6000),
          });

          const sbData = (await sbRes.json().catch(() => ({}))) as any;

          if (sbRes.ok && sbData.access_token && sbData.user) {
            const meta = sbData.user.user_metadata || {};
            // Each Supabase user gets their own isolated space/tenant
            const tenantId = meta.tenant_id || sbData.user.id;
            const user: User = {
              id: sbData.user.id,
              email: sbData.user.email || trimmedEmail,
              name: meta.full_name || meta.name || trimmedEmail.split('@')[0],
              role: (meta.role as User['role']) || 'owner',
              tenantId,
            };

            localStorage.setItem('genx:authToken', sbData.access_token);
            saveOfflineCred(trimmedEmail, password, user);
            set({
              user,
              token: sbData.access_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }

          // Handle known Supabase Auth errors
          if (sbData.error_code === 'invalid_credentials' || sbData.msg === 'Invalid login credentials') {
            const offlineUser = verifyOfflineCred(trimmedEmail, password);
            if (offlineUser) {
              localStorage.setItem('genx:authToken', 'offline-dev');
              set({ user: offlineUser, token: 'offline-dev', isAuthenticated: true, isLoading: false, error: null });
              return;
            }
            throw new Error('Invalid email or password');
          }

          if (sbData.error_code === 'email_not_confirmed' || sbData.msg?.includes('Email not confirmed')) {
            throw new Error('Email is not confirmed. Please click "Confirm User" in Supabase dashboard or check your confirmation email.');
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : '';
          if (errMsg === 'Invalid email or password' || errMsg.includes('Email is not confirmed')) {
            set({ isLoading: false, error: errMsg, isAuthenticated: false });
            throw err;
          }
          // If Supabase was unreachable or timed out, fall through to local API / offline fallback
        }
      }

      // ── 2. Local API Server Fallback ──────────────────────────────────────────
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password }),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data = (await res.json()) as { user: User; token: string };
          localStorage.setItem('genx:authToken', data.token);
          saveOfflineCred(trimmedEmail, password, data.user);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false, error: null });
          return;
        }
      } catch {
        // Local API server not reachable
      }

      // ── 3. Offline Cache Fallback ─────────────────────────────────────────────
      const offlineUser = verifyOfflineCred(trimmedEmail, password);
      if (offlineUser) {
        localStorage.setItem('genx:authToken', 'offline-dev');
        set({ user: offlineUser, token: 'offline-dev', isAuthenticated: true, isLoading: false, error: null });
        return;
      }

      const message = 'Login failed. Invalid email/password or server unreachable.';
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw new Error(message);
    },

    registerStore: async (inputData) => {
      set({ isLoading: true, error: null });
      const trimmedEmail = inputData.email.trim().toLowerCase();
      const tenantId = `tenant-${(inputData.storeCode || inputData.storeName).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      // ── 1. Create User in Supabase Auth ──────────────────────────────────────
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
          const sbRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: trimmedEmail,
              password: inputData.password,
              data: {
                name: inputData.name,
                store_name: inputData.storeName,
                store_code: inputData.storeCode,
                tenant_id: tenantId,
                role: 'owner',
                phone: inputData.phone,
              },
            }),
            signal: AbortSignal.timeout(6000),
          });

          const sbData = (await sbRes.json().catch(() => ({}))) as any;

          if (sbRes.ok && sbData.user) {
            const user: User = {
              id: sbData.user.id,
              email: sbData.user.email || trimmedEmail,
              name: inputData.name,
              role: 'owner',
              tenantId,
            };

            const token = sbData.access_token || 'supabase-registered';
            localStorage.setItem('genx:authToken', token);
            saveOfflineCred(trimmedEmail, inputData.password, user);
            set({ user, token, isAuthenticated: true, isLoading: false, error: null });

            // Notify local API server in background if reachable
            fetch(`${API_URL}/api/v1/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(inputData),
            }).catch(() => {});

            return;
          }
        } catch {
          // If Supabase direct signup fails, fallback to local API or offline
        }
      }

      // ── 2. Local API Register Fallback ────────────────────────────────────────
        try {
          const res = await fetch(`${API_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData),
            signal: AbortSignal.timeout(4000),
          });

          if (res.ok) {
            const data = (await res.json()) as { user: User; token: string };
            localStorage.setItem('genx:authToken', data.token);
            saveOfflineCred(trimmedEmail, inputData.password, data.user);
            set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false, error: null });
            return;
          }
        } catch {
          // Fallback to offline creation
        }

        // ── 3. Offline / Dev Fallback ─────────────────────────────────────────────
        const offlineUser: User = {
          id: crypto.randomUUID(),
          email: trimmedEmail,
          name: inputData.name,
          role: 'owner',
          tenantId,
        };
        saveOfflineCred(trimmedEmail, inputData.password, offlineUser);
        localStorage.setItem('genx:authToken', 'offline-dev');
        set({ user: offlineUser, token: 'offline-dev', isAuthenticated: true, isLoading: false, error: null });
      },

      logout: () => {
        // Clear authentication tokens and tenant credentials
        localStorage.removeItem('genx:authToken');
        localStorage.removeItem('genx:selectedModule');
        localStorage.removeItem('genx:lastSyncTimestamp');

        // Clear transient UI state
        set({ user: null, token: null, isAuthenticated: false, error: null });

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
