import { supabase, isSupabaseConfigured } from './supabase';

export interface AppSettings {
  id?: string;
  user_id?: string | null;
  master_passcode?: string | null;
  is_passcode_enabled: boolean;
  hidden_modules: string[];
  created_at?: string;
  updated_at?: string;
}

// NOTE: LOCAL_STORAGE_KEY is intentionally a function so each user gets
// their own isolated cache. Never use a bare constant key.
const getLocalStorageKey = (userId: string): string => `genx:app_settings:${userId}`;
const UNLOCK_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const DEFAULT_SETTINGS: AppSettings = {
  master_passcode: null,
  is_passcode_enabled: false,
  hidden_modules: [],
};

/**
 * Returns the currently authenticated Supabase user ID, or null if not logged in.
 */
async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Computes a secure SHA-256 hash with salt for a 4-digit passcode
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`genx_autocare_salt_${passcode}_v1`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies if an entered 4-digit passcode matches the hashed master passcode
 */
export async function verifyPasscode(
  enteredPasscode: string,
  hashedPasscode: string | null | undefined
): Promise<boolean> {
  if (!enteredPasscode || !hashedPasscode) return false;
  const hash = await hashPasscode(enteredPasscode.trim());
  return hash === hashedPasscode;
}

/**
 * Checks if a module is unlocked in the current session (valid for 30 minutes)
 */
export function isModuleUnlocked(moduleName: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(`unlocked_${moduleName}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.unlocked && parsed.timestamp) {
      const isStillValid = Date.now() - parsed.timestamp < UNLOCK_EXPIRY_MS;
      if (!isStillValid) {
        sessionStorage.removeItem(`unlocked_${moduleName}`);
        return false;
      }
      return true;
    }
  } catch {
    // If stored as legacy raw boolean string
    if (sessionStorage.getItem(`unlocked_${moduleName}`) === 'true') {
      return true;
    }
  }
  return false;
}

/**
 * Stores unlocked state for a module in sessionStorage with 30-min expiry
 */
export function unlockModule(moduleName: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    `unlocked_${moduleName}`,
    JSON.stringify({
      unlocked: true,
      timestamp: Date.now(),
    })
  );
}

/**
 * Locks a specific module by removing its unlock token
 */
export function lockModule(moduleName: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`unlocked_${moduleName}`);
}

/**
 * Locks all modules
 */
export function lockAllModules(): void {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('unlocked_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Synchronously reads only hidden_modules from localStorage for the given user.
 * Used to initialize state BEFORE first render to prevent FOUC.
 * Falls back to empty array if nothing cached yet.
 */
export function getHiddenModulesSync(userId: string | null | undefined): string[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(getLocalStorageKey(userId));
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<AppSettings>;
      return Array.isArray(parsed.hidden_modules) ? parsed.hidden_modules : [];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Reads cached settings from localStorage, scoped to the given user ID.
 */
function getCachedSettings(userId: string): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const cached = localStorage.getItem(getLocalStorageKey(userId));
    if (cached) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    }
  } catch (err) {
    console.warn('[app-settings] Error reading cached settings:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Writes cached settings to localStorage, scoped to the given user ID.
 */
function setCachedSettings(userId: string, settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: settings }));
  } catch (err) {
    console.warn('[app-settings] Error caching settings:', err);
  }
}

/**
 * Fetches app settings from Supabase for the currently authenticated user,
 * falling back to localStorage. Each user has their own isolated settings row.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const userId = await getCurrentUserId();

  // If not logged in or Supabase not configured, use local cache (or default)
  if (!userId || !isSupabaseConfigured()) {
    return userId ? getCachedSettings(userId) : DEFAULT_SETTINGS;
  }

  const cached = getCachedSettings(userId);

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('id, user_id, master_passcode, is_passcode_enabled, hidden_modules, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[app-settings] Supabase select error:', error.message);
      return cached;
    }

    if (data) {
      const merged: AppSettings = {
        id: data.id,
        user_id: data.user_id,
        master_passcode: data.master_passcode,
        is_passcode_enabled: Boolean(data.is_passcode_enabled),
        hidden_modules: Array.isArray(data.hidden_modules) ? data.hidden_modules : [],
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setCachedSettings(userId, merged);
      return merged;
    } else {
      // No settings row for this user yet — insert a fresh default row
      const initialRow = {
        user_id: userId,
        is_passcode_enabled: false,
        master_passcode: null,
        hidden_modules: [],
      };
      const { data: created, error: insertErr } = await supabase
        .from('app_settings')
        .insert(initialRow)
        .select()
        .single();

      if (!insertErr && created) {
        setCachedSettings(userId, created);
        return created;
      }
    }
  } catch (err) {
    console.warn('[app-settings] Network/DB error fetching app settings:', err);
  }

  return cached;
}

/**
 * Updates app settings in Supabase for the current user and syncs local storage.
 * Each user's settings are completely independent.
 */
export async function updateAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const userId = await getCurrentUserId();
  const current = await getAppSettings();
  const nextSettings: AppSettings = {
    ...current,
    ...updates,
    user_id: userId ?? current.user_id,
    updated_at: new Date().toISOString(),
  };

  // Immediate local update for responsive UI
  if (userId) setCachedSettings(userId, nextSettings);

  if (!isSupabaseConfigured() || !userId) {
    return nextSettings;
  }

  try {
    if (current.id) {
      const { data, error } = await supabase
        .from('app_settings')
        .update({
          master_passcode: nextSettings.master_passcode,
          is_passcode_enabled: nextSettings.is_passcode_enabled,
          hidden_modules: nextSettings.hidden_modules,
          updated_at: nextSettings.updated_at,
        })
        .eq('id', current.id)
        .eq('user_id', userId)   // Safety: only update rows owned by this user
        .select()
        .single();

      if (!error && data) {
        setCachedSettings(userId, data);
        return data;
      }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({
          user_id: userId,
          master_passcode: nextSettings.master_passcode,
          is_passcode_enabled: nextSettings.is_passcode_enabled,
          hidden_modules: nextSettings.hidden_modules,
        })
        .select()
        .single();

      if (!error && data) {
        setCachedSettings(userId, data);
        return data;
      }
    }
  } catch (err) {
    console.error('[app-settings] Failed to persist updates to Supabase:', err);
  }

  return nextSettings;
}
