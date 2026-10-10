import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@genx/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
  validateSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail || !password) {
          const err = 'Please enter both email and password.';
          set({ isLoading: false, error: err });
          throw new Error(err);
        }

        // ── Direct Real Supabase Auth (Single Source of Truth) ─────────────────────
        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: trimmedEmail,
              password,
            });

            if (error) {
              const errMsg = (error.message || '').toLowerCase();

              // Clean up any stale tokens immediately
              localStorage.removeItem('genx:authToken');
              localStorage.removeItem('genx:offline-creds');

              if (errMsg.includes('banned') || errMsg.includes('disabled') || (error as any).error_code === 'user_banned') {
                const message = 'This account has been banned by the administrator. Login denied.';
                set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: message });
                throw new Error(message);
              }

              if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid_grant')) {
                const message = 'Invalid email or password. If this user was deleted, please create a new business account.';
                set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: message });
                throw new Error(message);
              }

              if (errMsg.includes('email not confirmed')) {
                const message = 'Email is not confirmed. Please click "Confirm User" in Supabase dashboard or check your verification email.';
                set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: message });
                throw new Error(message);
              }

              const message = error.message || 'Login failed. Please check your credentials.';
              set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: message });
              throw new Error(message);
            }

            if (data?.user && data?.session) {
              const meta = data.user.user_metadata || {};
              // Isolate each tenant by their configured store tenant_id or user id
              const tenantId = meta.tenant_id || data.user.id;
              const user: User = {
                id: data.user.id,
                email: data.user.email || trimmedEmail,
                name: meta.full_name || meta.name || trimmedEmail.split('@')[0],
                role: (meta.role as User['role']) || 'owner',
                tenantId,
              };

              localStorage.setItem('genx:authToken', data.session.access_token);
              set({
                user,
                token: data.session.access_token,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });

              // Ensure tenant row exists in Supabase tenants table
              Promise.resolve(
                supabase
                  .from('tenants')
                  .upsert(
                    {
                      id: tenantId,
                      name: meta.store_name || user.name,
                      code: meta.store_code || tenantId,
                      business_type: meta.business_type || 'general',
                      email: user.email,
                    },
                    { onConflict: 'id' }
                  )
              ).catch(() => {});

              return;
            }
          } catch (err: unknown) {
            set({ isLoading: false });
            throw err;
          }
        }

        const message = 'Supabase credentials not configured. Please check your environment variables.';
        set({ isLoading: false, error: message, isAuthenticated: false });
        throw new Error(message);
      },

      registerStore: async (inputData) => {
        set({ isLoading: true, error: null });
        const trimmedEmail = inputData.email.trim().toLowerCase();
        const tenantId = `tenant-${(inputData.storeCode || inputData.storeName).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

        if (!isSupabaseConfigured()) {
          const err = 'Supabase is not configured.';
          set({ isLoading: false, error: err });
          throw new Error(err);
        }

        try {
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: inputData.password,
            options: {
              data: {
                name: inputData.name,
                store_name: inputData.storeName,
                store_code: inputData.storeCode,
                tenant_id: tenantId,
                role: 'owner',
                phone: inputData.phone,
                business_type: inputData.businessType || 'general',
              },
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            throw new Error(error.message);
          }

          // Register tenant in database table
          await supabase.from('tenants').upsert(
            {
              id: tenantId,
              name: inputData.storeName,
              code: inputData.storeCode,
              business_type: inputData.businessType || 'general',
              email: trimmedEmail,
              phone: inputData.phone || null,
            },
            { onConflict: 'id' }
          );

          if (data?.session && data?.user) {
            const user: User = {
              id: data.user.id,
              email: data.user.email || trimmedEmail,
              name: inputData.name,
              role: 'owner',
              tenantId,
            };

            localStorage.setItem('genx:authToken', data.session.access_token);
            set({
              user,
              token: data.session.access_token,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }

          // If Supabase has email confirmation enabled
          set({
            isLoading: false,
            error:
              'Registration successful! Please check your email or confirm this user in the Supabase Dashboard before signing in.',
          });
        } catch (err: unknown) {
          set({ isLoading: false });
          throw err;
        }
      },

      validateSession: async () => {
        if (!isSupabaseConfigured()) return true;

        try {
          const { data, error } = await supabase.auth.getUser();
          if (error || !data?.user) {
            // User was deleted or banned in Supabase! Kick out immediately.
            console.warn('[auth] Session invalid or user deleted/banned in Supabase. Logging out.');
            await get().logout();
            return false;
          }
          return true;
        } catch {
          return true; // network transient error, allow offline
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        localStorage.removeItem('genx:authToken');
        localStorage.removeItem('genx:selectedModule');
        localStorage.removeItem('genx:lastSyncTimestamp');
        localStorage.removeItem('genx:offline-creds');

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
    }
  )
);
