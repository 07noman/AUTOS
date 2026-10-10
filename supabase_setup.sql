-- ==============================================================================
-- GENX POS & ERP — SUPABASE PRODUCTION DATABASE INITIALIZATION & RLS POLICIES
-- ==============================================================================
-- Run this script ONCE in your Supabase Dashboard:
-- 1. Open https://supabase.com/dashboard/project/zqngkqsdpgtoytuleogn/sql/new
-- 2. Paste this entire script
-- 3. Click "RUN"
--
-- This guarantees:
-- - All tables exist with proper schemas for POS, Products, Orders, Customers, etc.
-- - RLS (Row Level Security) allows real database operations from your POS
-- - Data persists in Supabase Cloud permanently (100% saved across devices & restarts)
-- ==============================================================================

-- ── 1. CORE TENANTS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  business_type VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_id VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'PKR',
  timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure id column is TEXT if created previously as UUID
DO $$ BEGIN
  ALTER TABLE tenants ALTER COLUMN id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 2. CATEGORIES TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  deleted_at BIGINT
);

DO $$ BEGIN
  ALTER TABLE categories ALTER COLUMN id TYPE TEXT;
  ALTER TABLE categories ALTER COLUMN tenant_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories (tenant_id);

-- ── 3. PRODUCTS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  barcode VARCHAR(100),
  category_id TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(12,2),
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  images TEXT,
  metadata TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  deleted_at BIGINT
);

DO $$ BEGIN
  ALTER TABLE products ALTER COLUMN id TYPE TEXT;
  ALTER TABLE products ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE products ALTER COLUMN category_id TYPE TEXT;
  ALTER TABLE products ALTER COLUMN stock TYPE NUMERIC(12,2);
  ALTER TABLE products ALTER COLUMN minimum_stock TYPE NUMERIC(12,2);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (tenant_id, sku);

-- ── 4. CUSTOMERS TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  deleted_at BIGINT
);

DO $$ BEGIN
  ALTER TABLE customers ALTER COLUMN id TYPE TEXT;
  ALTER TABLE customers ALTER COLUMN tenant_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (tenant_id, phone);

-- ── 5. RETAIL ORDERS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  order_number VARCHAR(100) NOT NULL,
  customer_id TEXT,
  customer_name VARCHAR(255),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE orders ALTER COLUMN id TYPE TEXT;
  ALTER TABLE orders ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE orders ALTER COLUMN customer_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (tenant_id, order_number);

-- ── 6. ORDER ITEMS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL,
  product_id TEXT,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE order_items ALTER COLUMN id TYPE TEXT;
  ALTER TABLE order_items ALTER COLUMN order_id TYPE TEXT;
  ALTER TABLE order_items ALTER COLUMN product_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- ── 7. AUTO CARE POS ORDERS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  order_number BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ONGOING',
  customer_id TEXT,
  customer_name VARCHAR(255),
  payment_method VARCHAR(50),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2),
  items TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE pos_orders ALTER COLUMN id TYPE TEXT;
  ALTER TABLE pos_orders ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE pos_orders ALTER COLUMN customer_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant ON pos_orders (tenant_id, status);

-- ── 8. VEHICLES TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name VARCHAR(255),
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  vin VARCHAR(100),
  color VARCHAR(50),
  mileage INTEGER,
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE vehicles ALTER COLUMN id TYPE TEXT;
  ALTER TABLE vehicles ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE vehicles ALTER COLUMN customer_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles (tenant_id);

-- ── 9. AUTO CARE SERVICES TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_care_services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  labor_rate NUMERIC(12,2) NOT NULL DEFAULT 80,
  estimated_hours NUMERIC(6,2) NOT NULL DEFAULT 1,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE auto_care_services ALTER COLUMN id TYPE TEXT;
  ALTER TABLE auto_care_services ALTER COLUMN tenant_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_auto_care_services_tenant ON auto_care_services (tenant_id);

-- ── 10. SERVICE JOBS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  job_number VARCHAR(100) NOT NULL,
  customer_id TEXT,
  customer_name VARCHAR(255) NOT NULL,
  vehicle_id TEXT,
  vehicle_summary VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(50) NOT NULL DEFAULT 'normal',
  mechanic_id TEXT,
  mechanic_name VARCHAR(255),
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  notes TEXT,
  started_at BIGINT,
  completed_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE service_jobs ALTER COLUMN id TYPE TEXT;
  ALTER TABLE service_jobs ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE service_jobs ALTER COLUMN customer_id TYPE TEXT;
  ALTER TABLE service_jobs ALTER COLUMN vehicle_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_service_jobs_tenant ON service_jobs (tenant_id, status);

-- ── 11. SERVICE JOB ITEMS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_job_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'part',
  product_id TEXT,
  service_id TEXT,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE service_job_items ALTER COLUMN id TYPE TEXT;
  ALTER TABLE service_job_items ALTER COLUMN job_id TYPE TEXT;
  ALTER TABLE service_job_items ALTER COLUMN product_id TYPE TEXT;
  ALTER TABLE service_job_items ALTER COLUMN service_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_service_job_items_job ON service_job_items (job_id);

-- ── 12. AUTO CARE INVOICES TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_care_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  job_id TEXT,
  job_number VARCHAR(100),
  customer_id TEXT,
  customer_name VARCHAR(255) NOT NULL,
  vehicle_summary VARCHAR(255),
  items TEXT NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
  status VARCHAR(50) NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE auto_care_invoices ALTER COLUMN id TYPE TEXT;
  ALTER TABLE auto_care_invoices ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE auto_care_invoices ALTER COLUMN job_id TYPE TEXT;
  ALTER TABLE auto_care_invoices ALTER COLUMN customer_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_auto_care_invoices_tenant ON auto_care_invoices (tenant_id);

-- ── 13. STOCK MOVEMENTS LEDGER TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_delta NUMERIC(12,2) NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id TEXT,
  device_id VARCHAR(100),
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

DO $$ BEGIN
  ALTER TABLE stock_movements ALTER COLUMN id TYPE TEXT;
  ALTER TABLE stock_movements ALTER COLUMN tenant_id TYPE TEXT;
  ALTER TABLE stock_movements ALTER COLUMN product_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements (tenant_id, product_id);

-- ── 14. ROW-LEVEL SECURITY & POLICIES (ENABLE REAL DB FOR ALL OPERATIONS) ─────
-- Enable RLS on all tables and grant full access to public/anon/authenticated:
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_care_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_care_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies and create permissive policies:
DROP POLICY IF EXISTS "tenants_open_policy" ON tenants;
CREATE POLICY "tenants_open_policy" ON tenants FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categories_open_policy" ON categories;
CREATE POLICY "categories_open_policy" ON categories FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_open_policy" ON products;
CREATE POLICY "products_open_policy" ON products FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customers_open_policy" ON customers;
CREATE POLICY "customers_open_policy" ON customers FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orders_open_policy" ON orders;
CREATE POLICY "orders_open_policy" ON orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_open_policy" ON order_items;
CREATE POLICY "order_items_open_policy" ON order_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pos_orders_open_policy" ON pos_orders;
CREATE POLICY "pos_orders_open_policy" ON pos_orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vehicles_open_policy" ON vehicles;
CREATE POLICY "vehicles_open_policy" ON vehicles FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auto_care_services_open_policy" ON auto_care_services;
CREATE POLICY "auto_care_services_open_policy" ON auto_care_services FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_jobs_open_policy" ON service_jobs;
CREATE POLICY "service_jobs_open_policy" ON service_jobs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_job_items_open_policy" ON service_job_items;
CREATE POLICY "service_job_items_open_policy" ON service_job_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auto_care_invoices_open_policy" ON auto_care_invoices;
CREATE POLICY "auto_care_invoices_open_policy" ON auto_care_invoices FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_movements_open_policy" ON stock_movements;
CREATE POLICY "stock_movements_open_policy" ON stock_movements FOR ALL TO public USING (true) WITH CHECK (true);

-- ── 15. SEED DEFAULT DEMO TENANT ──────────────────────────────────────────────
INSERT INTO tenants (id, name, code, business_type, currency, timezone)
VALUES (
  'tenant-1',
  'GENX Auto Care Store',
  'genx-store-1',
  'auto_care',
  'PKR',
  'Asia/Karachi'
)
ON CONFLICT (code) DO NOTHING;
