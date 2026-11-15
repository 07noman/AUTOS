-- ==============================================================================
-- GENX Cloud POS — Pharmacy Module Supabase Schema (Additive Only)
-- Multi-Tenant SaaS with Strict Per-Business RLS Isolation
-- ==============================================================================

-- 1. pharmacy_medicines
CREATE TABLE IF NOT EXISTS public.pharmacy_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT,
  subcategory TEXT,
  manufacturer TEXT,
  dosage_form TEXT,
  strength TEXT,
  purchase_price NUMERIC(12, 2) DEFAULT 0,
  selling_price NUMERIC(12, 2) DEFAULT 0,
  barcode TEXT,
  sku TEXT,
  batch_number TEXT,
  stock NUMERIC(12, 2) DEFAULT 0,
  min_stock_level NUMERIC(12, 2) DEFAULT 0,
  mfg_date TEXT,
  expiry_date TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_business_id ON public.pharmacy_medicines(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_barcode ON public.pharmacy_medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_name ON public.pharmacy_medicines(name);

ALTER TABLE public.pharmacy_medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_medicines_select" ON public.pharmacy_medicines;
CREATE POLICY "pharmacy_medicines_select" ON public.pharmacy_medicines
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_medicines_insert" ON public.pharmacy_medicines;
CREATE POLICY "pharmacy_medicines_insert" ON public.pharmacy_medicines
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_medicines_update" ON public.pharmacy_medicines;
CREATE POLICY "pharmacy_medicines_update" ON public.pharmacy_medicines
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_medicines_delete" ON public.pharmacy_medicines;
CREATE POLICY "pharmacy_medicines_delete" ON public.pharmacy_medicines
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 2. pharmacy_batches
CREATE TABLE IF NOT EXISTS public.pharmacy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  medicine_id UUID,
  medicine_name TEXT,
  batch_number TEXT,
  mfg_date TEXT,
  expiry_date TEXT,
  quantity NUMERIC(12, 2) DEFAULT 0,
  purchase_cost NUMERIC(12, 2) DEFAULT 0,
  selling_price NUMERIC(12, 2) DEFAULT 0,
  supplier_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_business_id ON public.pharmacy_batches(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_expiry ON public.pharmacy_batches(expiry_date);

ALTER TABLE public.pharmacy_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_batches_select" ON public.pharmacy_batches;
CREATE POLICY "pharmacy_batches_select" ON public.pharmacy_batches
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_batches_insert" ON public.pharmacy_batches;
CREATE POLICY "pharmacy_batches_insert" ON public.pharmacy_batches
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_batches_update" ON public.pharmacy_batches;
CREATE POLICY "pharmacy_batches_update" ON public.pharmacy_batches
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_batches_delete" ON public.pharmacy_batches;
CREATE POLICY "pharmacy_batches_delete" ON public.pharmacy_batches
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 3. pharmacy_sales
CREATE TABLE IF NOT EXISTS public.pharmacy_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  invoice_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  discount NUMERIC(12, 2) DEFAULT 0,
  tax NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_business_id ON public.pharmacy_sales(business_id);

ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_sales_select" ON public.pharmacy_sales;
CREATE POLICY "pharmacy_sales_select" ON public.pharmacy_sales
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sales_insert" ON public.pharmacy_sales;
CREATE POLICY "pharmacy_sales_insert" ON public.pharmacy_sales
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sales_update" ON public.pharmacy_sales;
CREATE POLICY "pharmacy_sales_update" ON public.pharmacy_sales
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sales_delete" ON public.pharmacy_sales;
CREATE POLICY "pharmacy_sales_delete" ON public.pharmacy_sales
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 4. pharmacy_sale_items
CREATE TABLE IF NOT EXISTS public.pharmacy_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  sale_id UUID REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  medicine_id TEXT,
  medicine_name TEXT,
  batch_number TEXT,
  quantity NUMERIC(12, 2) DEFAULT 1,
  unit_price NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_items_business_id ON public.pharmacy_sale_items(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_items_sale_id ON public.pharmacy_sale_items(sale_id);

ALTER TABLE public.pharmacy_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_sale_items_select" ON public.pharmacy_sale_items;
CREATE POLICY "pharmacy_sale_items_select" ON public.pharmacy_sale_items
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sale_items_insert" ON public.pharmacy_sale_items;
CREATE POLICY "pharmacy_sale_items_insert" ON public.pharmacy_sale_items
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sale_items_update" ON public.pharmacy_sale_items;
CREATE POLICY "pharmacy_sale_items_update" ON public.pharmacy_sale_items
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_sale_items_delete" ON public.pharmacy_sale_items;
CREATE POLICY "pharmacy_sale_items_delete" ON public.pharmacy_sale_items
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 5. pharmacy_purchases
CREATE TABLE IF NOT EXISTS public.pharmacy_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  po_number TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  date TEXT,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  discount NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) DEFAULT 0,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_purchases_business_id ON public.pharmacy_purchases(business_id);

ALTER TABLE public.pharmacy_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_purchases_select" ON public.pharmacy_purchases;
CREATE POLICY "pharmacy_purchases_select" ON public.pharmacy_purchases
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchases_insert" ON public.pharmacy_purchases;
CREATE POLICY "pharmacy_purchases_insert" ON public.pharmacy_purchases
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchases_update" ON public.pharmacy_purchases;
CREATE POLICY "pharmacy_purchases_update" ON public.pharmacy_purchases
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchases_delete" ON public.pharmacy_purchases;
CREATE POLICY "pharmacy_purchases_delete" ON public.pharmacy_purchases
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 6. pharmacy_purchase_items
CREATE TABLE IF NOT EXISTS public.pharmacy_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  purchase_id UUID REFERENCES public.pharmacy_purchases(id) ON DELETE CASCADE,
  medicine_id TEXT,
  medicine_name TEXT,
  batch_number TEXT,
  mfg_date TEXT,
  expiry_date TEXT,
  quantity NUMERIC(12, 2) DEFAULT 1,
  unit_cost NUMERIC(12, 2) DEFAULT 0,
  total NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_purchase_items_business_id ON public.pharmacy_purchase_items(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_purchase_items_purchase_id ON public.pharmacy_purchase_items(purchase_id);

ALTER TABLE public.pharmacy_purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_purchase_items_select" ON public.pharmacy_purchase_items;
CREATE POLICY "pharmacy_purchase_items_select" ON public.pharmacy_purchase_items
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchase_items_insert" ON public.pharmacy_purchase_items;
CREATE POLICY "pharmacy_purchase_items_insert" ON public.pharmacy_purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchase_items_update" ON public.pharmacy_purchase_items;
CREATE POLICY "pharmacy_purchase_items_update" ON public.pharmacy_purchase_items
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_purchase_items_delete" ON public.pharmacy_purchase_items;
CREATE POLICY "pharmacy_purchase_items_delete" ON public.pharmacy_purchase_items
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 7. pharmacy_vendors (Suppliers)
CREATE TABLE IF NOT EXISTS public.pharmacy_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  outstanding_balance NUMERIC(12, 2) DEFAULT 0,
  total_purchases NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_vendors_business_id ON public.pharmacy_vendors(business_id);

ALTER TABLE public.pharmacy_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_vendors_select" ON public.pharmacy_vendors;
CREATE POLICY "pharmacy_vendors_select" ON public.pharmacy_vendors
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_vendors_insert" ON public.pharmacy_vendors;
CREATE POLICY "pharmacy_vendors_insert" ON public.pharmacy_vendors
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_vendors_update" ON public.pharmacy_vendors;
CREATE POLICY "pharmacy_vendors_update" ON public.pharmacy_vendors
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_vendors_delete" ON public.pharmacy_vendors;
CREATE POLICY "pharmacy_vendors_delete" ON public.pharmacy_vendors
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 8. pharmacy_customers
CREATE TABLE IF NOT EXISTS public.pharmacy_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  outstanding_balance NUMERIC(12, 2) DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0,
  prescription_notes TEXT,
  last_visit TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_customers_business_id ON public.pharmacy_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_customers_phone ON public.pharmacy_customers(phone);

ALTER TABLE public.pharmacy_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_customers_select" ON public.pharmacy_customers;
CREATE POLICY "pharmacy_customers_select" ON public.pharmacy_customers
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_customers_insert" ON public.pharmacy_customers;
CREATE POLICY "pharmacy_customers_insert" ON public.pharmacy_customers
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_customers_update" ON public.pharmacy_customers;
CREATE POLICY "pharmacy_customers_update" ON public.pharmacy_customers
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_customers_delete" ON public.pharmacy_customers;
CREATE POLICY "pharmacy_customers_delete" ON public.pharmacy_customers
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 9. pharmacy_expenses
CREATE TABLE IF NOT EXISTS public.pharmacy_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'Cash',
  notes TEXT,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_expenses_business_id ON public.pharmacy_expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_expenses_date ON public.pharmacy_expenses(date);

ALTER TABLE public.pharmacy_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_expenses_select" ON public.pharmacy_expenses;
CREATE POLICY "pharmacy_expenses_select" ON public.pharmacy_expenses
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_expenses_insert" ON public.pharmacy_expenses;
CREATE POLICY "pharmacy_expenses_insert" ON public.pharmacy_expenses
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_expenses_update" ON public.pharmacy_expenses;
CREATE POLICY "pharmacy_expenses_update" ON public.pharmacy_expenses
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_expenses_delete" ON public.pharmacy_expenses;
CREATE POLICY "pharmacy_expenses_delete" ON public.pharmacy_expenses
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 10. pharmacy_payments (Accounts / Cash Log)
CREATE TABLE IF NOT EXISTS public.pharmacy_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'Cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_payments_business_id ON public.pharmacy_payments(business_id);

ALTER TABLE public.pharmacy_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_payments_select" ON public.pharmacy_payments;
CREATE POLICY "pharmacy_payments_select" ON public.pharmacy_payments
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_payments_insert" ON public.pharmacy_payments;
CREATE POLICY "pharmacy_payments_insert" ON public.pharmacy_payments
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_payments_update" ON public.pharmacy_payments;
CREATE POLICY "pharmacy_payments_update" ON public.pharmacy_payments
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_payments_delete" ON public.pharmacy_payments;
CREATE POLICY "pharmacy_payments_delete" ON public.pharmacy_payments
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 11. pharmacy_staff
CREATE TABLE IF NOT EXISTS public.pharmacy_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'Pharmacist',
  phone TEXT,
  status TEXT DEFAULT 'Active',
  last_login TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_staff_business_id ON public.pharmacy_staff(business_id);

ALTER TABLE public.pharmacy_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_staff_select" ON public.pharmacy_staff;
CREATE POLICY "pharmacy_staff_select" ON public.pharmacy_staff
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_staff_insert" ON public.pharmacy_staff;
CREATE POLICY "pharmacy_staff_insert" ON public.pharmacy_staff
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_staff_update" ON public.pharmacy_staff;
CREATE POLICY "pharmacy_staff_update" ON public.pharmacy_staff
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_staff_delete" ON public.pharmacy_staff;
CREATE POLICY "pharmacy_staff_delete" ON public.pharmacy_staff
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 12. pharmacy_settings
CREATE TABLE IF NOT EXISTS public.pharmacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE,
  pharmacy_name TEXT DEFAULT 'My Pharmacy',
  tagline TEXT DEFAULT 'Licensed Medical Store & Pharmacy',
  phone TEXT,
  email TEXT,
  address TEXT,
  drug_license_number TEXT,
  tax_registration_number TEXT,
  currency TEXT DEFAULT 'Rs.',
  tax_rate_percent NUMERIC(5, 2) DEFAULT 0,
  receipt_header TEXT,
  receipt_footer TEXT,
  printer_type TEXT DEFAULT 'thermal_80mm',
  auto_print_receipt BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_settings_business_id ON public.pharmacy_settings(business_id);

ALTER TABLE public.pharmacy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_settings_select" ON public.pharmacy_settings;
CREATE POLICY "pharmacy_settings_select" ON public.pharmacy_settings
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_settings_insert" ON public.pharmacy_settings;
CREATE POLICY "pharmacy_settings_insert" ON public.pharmacy_settings
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_settings_update" ON public.pharmacy_settings;
CREATE POLICY "pharmacy_settings_update" ON public.pharmacy_settings
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_settings_delete" ON public.pharmacy_settings;
CREATE POLICY "pharmacy_settings_delete" ON public.pharmacy_settings
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());


-- 13. pharmacy_disposals
CREATE TABLE IF NOT EXISTS public.pharmacy_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  medicine_name TEXT,
  batch TEXT,
  qty NUMERIC(12, 2) DEFAULT 0,
  reason TEXT,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_disposals_business_id ON public.pharmacy_disposals(business_id);

ALTER TABLE public.pharmacy_disposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharmacy_disposals_select" ON public.pharmacy_disposals;
CREATE POLICY "pharmacy_disposals_select" ON public.pharmacy_disposals
  FOR SELECT TO authenticated
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_disposals_insert" ON public.pharmacy_disposals;
CREATE POLICY "pharmacy_disposals_insert" ON public.pharmacy_disposals
  FOR INSERT TO authenticated
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_disposals_update" ON public.pharmacy_disposals;
CREATE POLICY "pharmacy_disposals_update" ON public.pharmacy_disposals
  FOR UPDATE TO authenticated
  USING (business_id = auth.uid())
  WITH CHECK (business_id = auth.uid());

DROP POLICY IF EXISTS "pharmacy_disposals_delete" ON public.pharmacy_disposals;
CREATE POLICY "pharmacy_disposals_delete" ON public.pharmacy_disposals
  FOR DELETE TO authenticated
  USING (business_id = auth.uid());
