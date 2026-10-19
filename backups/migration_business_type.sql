-- =========================================================================
-- GENX CLOUD POS — MULTI-BUSINESS SAFE ADDITIVE MIGRATION
-- Project: amamuotcgihisqibisee / tstuqwqktkjgxnopytmz
-- Live Deployment Protection: ONLY ADDITIVE, NO DATA DELETION
-- Default: 'auto-parts' preserves 100% existing data compatibility
-- =========================================================================

-- 1. Add business_type column to pos_orders
ALTER TABLE IF EXISTS pos_orders 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_pos_orders_business_type 
ON pos_orders (tenant_id, business_type);

-- 2. Add business_type column to products
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_products_business_type 
ON products (tenant_id, business_type);

-- 3. Add business_type column to categories
ALTER TABLE IF EXISTS categories 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_categories_business_type 
ON categories (tenant_id, business_type);

-- 4. Add business_type column to customers
ALTER TABLE IF EXISTS customers 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_customers_business_type 
ON customers (tenant_id, business_type);

-- 5. Add business_type column to vehicles
ALTER TABLE IF EXISTS vehicles 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_vehicles_business_type 
ON vehicles (tenant_id, business_type);

-- 6. Add business_type column to service_jobs
ALTER TABLE IF EXISTS service_jobs 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

CREATE INDEX IF NOT EXISTS idx_service_jobs_business_type 
ON service_jobs (tenant_id, business_type);

-- 7. Add business_type column to app_settings
ALTER TABLE IF EXISTS app_settings 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'auto-parts';

-- 8. Existing record safety guarantee: Ensure existing NULLs default to 'auto-parts'
UPDATE pos_orders SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE products SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE categories SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE customers SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE vehicles SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE service_jobs SET business_type = 'auto-parts' WHERE business_type IS NULL;
UPDATE app_settings SET business_type = 'auto-parts' WHERE business_type IS NULL;
