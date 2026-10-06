/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@tauri-apps/plugin-sql' {
  export interface QueryResult {
    rowsAffected: number;
    lastInsertId?: number;
  }
  export default class Database {
    path: string;
    constructor(path: string);
    static load(path: string): Promise<Database>;
    static get(path: string): Database;
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
    select<T>(query: string, bindValues?: unknown[]): Promise<T>;
    close(db?: string): Promise<boolean>;
    transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  }
  export { Database };
}
