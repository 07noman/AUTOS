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

const LOCAL_STORAGE_KEY = 'genx:app_settings';
const UNLOCK_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const DEFAULT_SETTINGS: AppSettings = {
  master_passcode: null,
  is_passcode_enabled: false,
  hidden_modules: [],
};

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
 * Reads cached settings from localStorage
 */
function getCachedSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
    }
  } catch (err) {
    console.warn('[app-settings] Error reading cached settings:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Writes cached settings to localStorage
 */
function setCachedSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: settings }));
  } catch (err) {
    console.warn('[app-settings] Error caching settings:', err);
  }
}

/**
 * Fetches app settings from Supabase (falling back to localStorage)
 */
export async function getAppSettings(): Promise<AppSettings> {
  const cached = getCachedSettings();

  if (!isSupabaseConfigured()) {
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('id, user_id, master_passcode, is_passcode_enabled, hidden_modules, created_at, updated_at')
      .order('created_at', { ascending: true })
      .limit(1)
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
      setCachedSettings(merged);
      return merged;
    } else {
      // If table is completely empty, insert initial default row
      const initialRow = {
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
        setCachedSettings(created);
        return created;
      }
    }
  } catch (err) {
    console.warn('[app-settings] Network/DB error fetching app settings:', err);
  }

  return cached;
}

/**
 * Updates app settings in Supabase and syncs local storage
 */
export async function updateAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const nextSettings: AppSettings = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Immediate local update for responsive UI
  setCachedSettings(nextSettings);

  if (!isSupabaseConfigured()) {
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
        .select()
        .single();

      if (!error && data) {
        setCachedSettings(data);
        return data;
      }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({
          master_passcode: nextSettings.master_passcode,
          is_passcode_enabled: nextSettings.is_passcode_enabled,
          hidden_modules: nextSettings.hidden_modules,
        })
        .select()
        .single();

      if (!error && data) {
        setCachedSettings(data);
        return data;
      }
    }
  } catch (err) {
    console.error('[app-settings] Failed to persist updates to Supabase:', err);
  }

  return nextSettings;
}
