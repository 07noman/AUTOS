-- ==============================================================================
-- GENX CLOUD — Mobile Retail Inventory Enhancement Schema
-- Strictly Additive Migration:
-- 1. Preserves all existing retail tables, columns, indexes, and APIs.
-- 2. Adds product_mobile_details with foreign key to products(id).
-- 3. Adds product_imeis with foreign key to products(id) and duplicate prevention.
-- ==============================================================================

-- 1. product_mobile_details
CREATE TABLE IF NOT EXISTS public.product_mobile_details (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id      TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL,
  shop_type       TEXT NOT NULL DEFAULT 'New Phone', -- 'New Phone', 'Used Phone', 'Accessories'
  brand           TEXT,
  model           TEXT,
  ram             TEXT,
  storage         TEXT,
  pta_status      TEXT DEFAULT 'Approved',           -- 'Approved', 'Non-PTA', 'Pending'
  warranty_type   TEXT DEFAULT 'Company',            -- 'Company', 'Shop', 'No Warranty'
  is_imei_product BOOLEAN NOT NULL DEFAULT true,
  created_at      BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at      BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  CONSTRAINT uq_product_mobile_details_tenant_product UNIQUE(tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pmd_product_id ON public.product_mobile_details(product_id);
CREATE INDEX IF NOT EXISTS idx_pmd_tenant_id  ON public.product_mobile_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pmd_shop_type  ON public.product_mobile_details(tenant_id, shop_type);

-- 2. product_imeis
CREATE TABLE IF NOT EXISTS public.product_imeis (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id  TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id   TEXT NOT NULL,
  imei1       TEXT NOT NULL,
  imei2       TEXT,
  status      TEXT NOT NULL DEFAULT 'available', -- 'available', 'sold', 'transferred', 'returned', 'defective'
  notes       TEXT,
  created_at  BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at  BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  sold_at     BIGINT,
  CONSTRAINT uq_product_imeis_tenant_imei1 UNIQUE(tenant_id, imei1)
);

CREATE INDEX IF NOT EXISTS idx_product_imeis_product ON public.product_imeis(product_id);
CREATE INDEX IF NOT EXISTS idx_product_imeis_tenant  ON public.product_imeis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_imeis_imei1   ON public.product_imeis(tenant_id, imei1);
CREATE INDEX IF NOT EXISTS idx_product_imeis_imei2   ON public.product_imeis(tenant_id, imei2);
CREATE INDEX IF NOT EXISTS idx_product_imeis_status  ON public.product_imeis(tenant_id, product_id, status);

-- 3. Row Level Security (RLS)
ALTER TABLE public.product_mobile_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_imeis          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_mobile_details_open" ON public.product_mobile_details;
CREATE POLICY "product_mobile_details_open" ON public.product_mobile_details
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_imeis_open" ON public.product_imeis;
CREATE POLICY "product_imeis_open" ON public.product_imeis
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Enable Realtime Replica Identity
ALTER TABLE public.product_mobile_details REPLICA IDENTITY FULL;
ALTER TABLE public.product_imeis          REPLICA IDENTITY FULL;
