import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const jsonPath = path.join(rootDir, 'backups', 'backup_auto_parts_2026_05_13.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

let sql = '-- =========================================================================\n';
sql += '-- GENX CLOUD POS — FULL DATA & SCHEMA BACKUP\n';
sql += '-- Backup Date: 2026-05-13 / ' + new Date().toISOString() + '\n';
sql += '-- Target Supabase Project: amamuotcgihisqibisee / tstuqwqktkjgxnopytmz\n';
sql += '-- Purpose: Complete snapshot of live auto parts data before business template expansion\n';
sql += '-- =========================================================================\n\n';

for (const [table, rows] of Object.entries(data)) {
  sql += '-- -------------------------------------------------------------------------\n';
  sql += '-- Table: ' + table + ' (' + (Array.isArray(rows) ? rows.length : 0) + ' records)\n';
  sql += '-- -------------------------------------------------------------------------\n';
  if (Array.isArray(rows) && rows.length > 0) {
    for (const r of rows) {
      const cols = Object.keys(r);
      const vals = Object.values(r).map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number' || typeof v === 'boolean') return v;
        if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
      sql += 'INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + vals.join(', ') + ') ON CONFLICT (id) DO NOTHING;\n';
    }
  } else {
    sql += '-- No rows found for ' + table + '\n';
  }
  sql += '\n';
}

const sqlPath = path.join(rootDir, 'backups', 'backup_auto_parts_2026_05_13.sql');
fs.writeFileSync(sqlPath, sql);
console.log('Successfully written full SQL backup to', sqlPath, 'Size:', sql.length, 'bytes');
