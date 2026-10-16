-- Supabase SQL: Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  master_passcode text,
  is_passcode_enabled boolean DEFAULT false,
  hidden_modules text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all" ON app_settings;
CREATE POLICY "Allow select for all" ON app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for all" ON app_settings;
CREATE POLICY "Allow insert for all" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for all" ON app_settings;
CREATE POLICY "Allow update for all" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO app_settings (master_passcode, is_passcode_enabled, hidden_modules)
SELECT NULL, false, '{}'::text[]
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);
