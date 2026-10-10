import type Database from '@tauri-apps/plugin-sql';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db: Database) => {
      // 1. Products
      await db.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          sku TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          barcode TEXT,
          category_id TEXT,
          cost_price REAL NOT NULL,
          selling_price REAL NOT NULL,
          wholesale_price REAL,
          stock INTEGER NOT NULL DEFAULT 0,
          minimum_stock INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          images TEXT,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          UNIQUE(tenant_id, sku)
        )
      `);

      // 2. Orders
      await db.execute(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          order_number TEXT NOT NULL UNIQUE,
          customer_id TEXT,
          subtotal REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 3. Order Items
      await db.execute(`
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        )
      `);

      // 4. Outbox (baseline)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at INTEGER,
          synced_at INTEGER,
          error TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      // 5. Customers
      await db.execute(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          balance REAL NOT NULL DEFAULT 0,
          credit_limit REAL NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 6. Auto Care tables
      await db.execute(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          make TEXT NOT NULL,
          model TEXT NOT NULL,
          year INTEGER NOT NULL,
          license_plate TEXT NOT NULL,
          vin TEXT,
          color TEXT,
          mileage INTEGER,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS auto_care_services (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          labor_rate REAL NOT NULL DEFAULT 80,
          estimated_hours REAL NOT NULL DEFAULT 1,
          category TEXT NOT NULL DEFAULT 'general',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS service_jobs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          job_number TEXT NOT NULL UNIQUE,
          customer_id TEXT,
          customer_name TEXT NOT NULL,
          vehicle_id TEXT,
          vehicle_summary TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'normal',
          mechanic_id TEXT,
          mechanic_name TEXT,
          estimated_hours REAL,
          actual_hours REAL,
          notes TEXT,
          started_at INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS service_job_items (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'part',
          product_id TEXT,
          service_id TEXT,
          name TEXT NOT NULL,
          sku TEXT,
          quantity REAL NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (job_id) REFERENCES service_jobs(id)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS auto_care_invoices (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          invoice_number TEXT NOT NULL UNIQUE,
          job_id TEXT,
          job_number TEXT,
          customer_id TEXT,
          customer_name TEXT NOT NULL,
          vehicle_summary TEXT,
          items TEXT NOT NULL DEFAULT '[]',
          subtotal REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          status TEXT NOT NULL DEFAULT 'paid',
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS pos_orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          order_number INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'ONGOING',
          customer_name TEXT,
          customer_id TEXT,
          payment_method TEXT,
          subtotal REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          paid_amount REAL,
          items TEXT NOT NULL DEFAULT '[]',
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // Indexes
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant ON pos_orders(tenant_id, status)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_pos_orders_number ON pos_orders(tenant_id, order_number)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON service_jobs(tenant_id, status)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_number ON service_jobs(job_number)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id)`);
    },
  },
  {
    version: 2,
    name: 'phase_2a_sync_and_inventory_foundation',
    up: async (db: Database) => {
      // 1. App metadata / device identity storage
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // 2. Sync State (persistent cursors)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sync_state (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          scope TEXT NOT NULL,
          cursor TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(tenant_id, device_id, scope)
        )
      `);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_sync_state_tenant ON sync_state(tenant_id, scope)`);

      // 3. Stock Movements (immutable inventory ledger)
      await db.execute(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          quantity_delta REAL NOT NULL,
          movement_type TEXT NOT NULL,
          reference_type TEXT NOT NULL,
          reference_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          UNIQUE(tenant_id, reference_type, reference_id, product_id)
        )
      `);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(tenant_id, product_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(tenant_id, reference_type, reference_id)`);

      // 4. Upgrade Outbox table with device_id, idempotency_key, version, sequence_number
      // Safe non-destructive column additions
      const alterSafe = async (stmt: string) => {
        try {
          await db.execute(stmt);
        } catch {
          // Column likely already exists
        }
      };

      await alterSafe('ALTER TABLE outbox ADD COLUMN device_id TEXT');
      await alterSafe('ALTER TABLE outbox ADD COLUMN idempotency_key TEXT');
      await alterSafe('ALTER TABLE outbox ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
      await alterSafe('ALTER TABLE outbox ADD COLUMN sequence_number INTEGER');

      await db.execute(`CREATE INDEX IF NOT EXISTS idx_outbox_idempotency ON outbox(tenant_id, idempotency_key)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_outbox_device ON outbox(tenant_id, device_id)`);
    },
  },
  {
    version: 3,
    name: 'add_categories_table',
    up: async (db: Database) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          parent_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id)`);
    },
  },
];

export async function runMigrations(db: Database): Promise<{ appliedCount: number; currentVersion: number }> {
  // Ensure schema_migrations table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  // Query already applied versions
  const rows = await db.select<{ version: number }[]>('SELECT version FROM schema_migrations ORDER BY version ASC');
  const appliedSet = new Set(rows.map((r) => r.version));

  let appliedCount = 0;
  for (const m of migrations) {
    if (!appliedSet.has(m.version)) {
      // Execute migration inside an atomic transaction
      await db.transaction(async (tx) => {
        await m.up(tx);
        await tx.execute(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [m.version, m.name, Date.now()]
        );
      });
      appliedSet.add(m.version);
      appliedCount++;
    }
  }

  const latestVersion = rows.length > 0 ? Math.max(...rows.map((r) => r.version), ...Array.from(appliedSet)) : appliedSet.size > 0 ? Math.max(...Array.from(appliedSet)) : 0;
  return { appliedCount, currentVersion: latestVersion };
}
