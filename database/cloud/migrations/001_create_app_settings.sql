-- ==============================================================================
-- GENX Cloud Auto Care: App Settings Migration
-- Creates table for Master Passcode protection and Hidden Modules visibility
-- ==============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  master_passcode text,
  is_passcode_enabled boolean DEFAULT false,
  hidden_modules text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon & authenticated users so frontend can read and update settings
DROP POLICY IF EXISTS "Allow select for all" ON app_settings;
CREATE POLICY "Allow select for all" ON app_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert for all" ON app_settings;
CREATE POLICY "Allow insert for all" ON app_settings
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for all" ON app_settings;
CREATE POLICY "Allow update for all" ON app_settings
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial default record if empty
INSERT INTO app_settings (master_passcode, is_passcode_enabled, hidden_modules)
SELECT NULL, false, '{}'::text[]
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);
