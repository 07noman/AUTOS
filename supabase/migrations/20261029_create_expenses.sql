-- ==============================================================================
-- Expenses Table for Supabase PostgreSQL
-- ==============================================================================

-- 1. Table
create table if not exists public.expenses (
  id text primary key,
  store_id text not null,
  business_id text,
  date date not null default CURRENT_DATE,
  category text not null,
  amount numeric not null check (amount > 0),
  payment_method text default 'Cash',
  description text,
  added_by text,
  created_at timestamptz default now()
);

-- 2. Index for fast loading & tenant/store isolation
create index if not exists idx_expenses_store_id on public.expenses(store_id);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_expenses_category on public.expenses(category);

-- 3. Row Level Security
alter table public.expenses enable row level security;
drop policy if exists "allow all" on public.expenses;
drop policy if exists "allow all for authenticated" on public.expenses;
create policy "allow all" on public.expenses for all using (true) with check (true);
