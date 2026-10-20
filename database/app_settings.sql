-- Supabase SQL: Run this in Supabase SQL Editor
-- FIXED: app_settings are now per-user (scoped by user_id = auth.uid())

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),  -- must reference auth.users
  master_passcode text,
  is_passcode_enabled boolean DEFAULT false,
  hidden_modules text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)  -- one settings row per user
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Each user can only see their own settings row
DROP POLICY IF EXISTS "Allow select for all" ON app_settings;
CREATE POLICY "Users can read own settings" ON app_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Each user can only insert a row for themselves
DROP POLICY IF EXISTS "Allow insert for all" ON app_settings;
CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Each user can only update their own row
DROP POLICY IF EXISTS "Allow update for all" ON app_settings;
CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Each user can delete their own settings
DROP POLICY IF EXISTS "Users can delete own settings" ON app_settings;
CREATE POLICY "Users can delete own settings" ON app_settings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- NOTE: Do NOT insert any global default row — each user gets their own row
-- when they first access settings (inserted by the app on first load).
