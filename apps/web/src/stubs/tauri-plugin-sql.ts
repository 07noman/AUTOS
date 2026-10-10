/**
 * Browser stub for @tauri-apps/plugin-sql
 *
 * When building apps/web, Vite resolves imports from apps/desktop/src.
 * db.ts imports `Database` from '@tauri-apps/plugin-sql'.
 * In the browser, the Tauri mock (tauri-mock.ts) intercepts all SQL commands
 * via window.__TAURI_INTERNALS__, so we just need a stub class that
 * routes through the same internal invoke API that the real plugin uses.
 *
 * This stub is ONLY used by the web build (via vite.config.ts alias).
 * The desktop build uses the real @tauri-apps/plugin-sql Rust plugin.
 */

// The real plugin works by calling window.__TAURI_INTERNALS__.invoke('plugin:sql|...')
// Our tauri-mock.ts sets up window.__TAURI_INTERNALS__ to intercept these calls
// with localStorage-backed storage. So we just need to replicate the plugin's
// public API surface using the same invoke pattern.

const invoke = (cmd: string, args?: Record<string, unknown>) => {
  const w = window as any;
  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  return Promise.reject(new Error(`Tauri not available: ${cmd}`));
};

class Database {
  private _path: string;

  private constructor(path: string) {
    this._path = path;
  }

  static async load(path: string): Promise<Database> {
    await invoke('plugin:sql|load', { db: path });
    return new Database(path);
  }

  async execute(
    query: string,
    values: unknown[] = []
  ): Promise<{ rowsAffected: number; lastInsertId: number }> {
    const result = await invoke('plugin:sql|execute', {
      db: this._path,
      query,
      values,
    }) as [number, number];
    return { rowsAffected: result[0] ?? 0, lastInsertId: result[1] ?? 0 };
  }

  async select<T = unknown>(query: string, values: unknown[] = []): Promise<T[]> {
    const result = await invoke('plugin:sql|select', {
      db: this._path,
      query,
      values,
    });
    return (result as T[]) ?? [];
  }

  async close(): Promise<void> {
    await invoke('plugin:sql|close', { db: this._path });
  }
}

export default Database;
