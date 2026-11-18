-- ==============================================================================
-- GENX Cloud POS — Pharmacy Packing & Multi-Unit (Tablet / Strip / Box)
-- Additive & Backward-Compatible Migration
-- ==============================================================================

ALTER TABLE public.pharmacy_medicines
  ADD COLUMN IF NOT EXISTS base_unit TEXT,
  ADD COLUMN IF NOT EXISTS strip_size NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS box_size NUMERIC(12, 2);

COMMENT ON COLUMN public.pharmacy_medicines.base_unit IS 'Base packaging unit (Tablet, Capsule, Bottle, Tube, Ampoule, etc.)';
COMMENT ON COLUMN public.pharmacy_medicines.strip_size IS 'Number of base units in 1 strip (e.g. 10 tablets)';
COMMENT ON COLUMN public.pharmacy_medicines.box_size IS 'Number of strips in 1 box (e.g. 10 strips)';
