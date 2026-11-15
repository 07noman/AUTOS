-- ==============================================================================
-- ADDITIVE MIGRATION: Add optional phone column to vehicles and pos_orders
-- STRICT LIVE SAFETY: No tables/columns dropped or renamed, purely additive
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN phone TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pos_orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE pos_orders ADD COLUMN customer_phone TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_phone ON vehicles(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_pos_orders_customer_phone ON pos_orders(tenant_id, customer_phone);
