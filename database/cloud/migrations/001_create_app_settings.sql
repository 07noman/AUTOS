-- ==============================================================================
-- GENX Cloud Auto Care: App Settings Migration (v2 - Per-User Isolation)
-- BUG FIX: Settings are now scoped per user (user_id = auth.uid()).
-- Each user has their own independent row — no shared global settings.
-- ==============================================================================

-- Step 1: Create table with user_id as a NOT NULL uuid tied to auth.uid()
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  master_passcode text,
  is_passcode_enabled boolean DEFAULT false,
  hidden_modules text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- Step 2: Enable Row Level Security
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop all old permissive "allow all" policies
DROP POLICY IF EXISTS "Allow select for all" ON app_settings;
DROP POLICY IF EXISTS "Allow insert for all" ON app_settings;
DROP POLICY IF EXISTS "Allow update for all" ON app_settings;

-- Step 4: Create strict per-user RLS policies
-- Each authenticated user can only see their own settings row
CREATE POLICY "Users can read own settings" ON app_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Each user can only insert a row for themselves
CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Each user can only update their own row
CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Each user can delete their own settings
CREATE POLICY "Users can delete own settings" ON app_settings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Step 5: If migrating from old schema (user_id was text), run:
--   ALTER TABLE app_settings ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
--   ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;
--   ALTER TABLE app_settings ADD UNIQUE (user_id);
-- Then delete the single shared global row (if any) — it's no longer valid:
--   DELETE FROM app_settings WHERE user_id IS NULL;

-- NOTE: No global seed INSERT — each user gets their own row inserted
-- automatically by the app on first load (getAppSettings function).
