-- Migration: Create mobile_phone_details and mobile_used_purchase tables
-- Additive only. Preserves all existing products and inventory tables.

CREATE TABLE IF NOT EXISTS public.mobile_phone_details (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  shop_type TEXT NOT NULL DEFAULT 'Auto Store',
  brand TEXT,
  model TEXT,
  variant TEXT,
  color TEXT,
  ram TEXT,
  storage TEXT,
  pta_status TEXT,
  warranty_type TEXT,
  battery_health INTEGER,
  is_imei_product BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mpd_product_id ON public.mobile_phone_details(product_id);
CREATE INDEX IF NOT EXISTS idx_mpd_tenant_id ON public.mobile_phone_details(tenant_id);

CREATE TABLE IF NOT EXISTS public.mobile_used_purchase (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  seller_name TEXT,
  seller_cnic TEXT,
  seller_phone TEXT,
  purchase_price NUMERIC,
  condition TEXT,
  battery_health INTEGER,
  notes TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mup_product_id ON public.mobile_used_purchase(product_id);
CREATE INDEX IF NOT EXISTS idx_mup_tenant_id ON public.mobile_used_purchase(tenant_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.mobile_phone_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_used_purchase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their own mobile phone details"
  ON public.mobile_phone_details
  FOR ALL
  USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id')
  WITH CHECK (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');

CREATE POLICY "Tenants can manage their own mobile used purchases"
  ON public.mobile_used_purchase
  FOR ALL
  USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id')
  WITH CHECK (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');
