-- ==============================================================================
-- Supabase SQL Migration: Prevent Duplicate Orders in Vercel + Supabase POS
-- ==============================================================================

-- 1. Ensure `pos_reference` column exists on both `orders` and `pos_orders`
ALTER TABLE IF EXISTS orders 
  ADD COLUMN IF NOT EXISTS pos_reference TEXT;

ALTER TABLE IF EXISTS pos_orders 
  ADD COLUMN IF NOT EXISTS pos_reference TEXT;

-- 2. Clean up any existing duplicate records before applying UNIQUE constraints
-- (Keeps the original lowest/earliest created order and removes duplicate ghost copies)

-- Deduplicate `pos_orders` by tenant_id + order_number
DELETE FROM pos_orders a
USING pos_orders b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.order_number = b.order_number;

-- Deduplicate `orders` by tenant_id + order_number
DELETE FROM orders a
USING orders b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.order_number = b.order_number;

-- 3. Add UNIQUE constraint for pos_reference on orders (Requested by specification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_pos_reference'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT unique_pos_reference UNIQUE (pos_reference);
  END IF;
END $$;

-- 4. Add UNIQUE constraint for pos_reference on pos_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_pos_orders_pos_reference'
  ) THEN
    ALTER TABLE pos_orders ADD CONSTRAINT unique_pos_orders_pos_reference UNIQUE (pos_reference);
  END IF;
END $$;

-- 5. Add UNIQUE constraint on (tenant_id, order_number) for pos_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_pos_orders_tenant_order_number'
  ) THEN
    ALTER TABLE pos_orders ADD CONSTRAINT unique_pos_orders_tenant_order_number UNIQUE (tenant_id, order_number);
  END IF;
END $$;

-- 6. Add UNIQUE constraint on (tenant_id, order_number) for standard orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_orders_tenant_order_number'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT unique_orders_tenant_order_number UNIQUE (tenant_id, order_number);
  END IF;
END $$;

-- 7. Ensure index on order_items id for conflict-free upserts
CREATE INDEX IF NOT EXISTS idx_order_items_id ON order_items (id);
