-- ==============================================================================
-- MIGRATION 002: Fix app_settings — Per-User Isolation
-- 
-- BUG: Previously a single shared row was used for ALL users, so settings
--      (hidden modules, passcode) from one user would bleed into every other user.
--
-- FIX: Each user now has their own isolated row, enforced by:
--      1. user_id column (uuid, NOT NULL) referencing the logged-in auth.uid()
--      2. UNIQUE constraint on user_id (one row per user)
--      3. Strict RLS policies — users can only read/write their OWN row
--
-- HOW TO APPLY: Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ==============================================================================

-- Step 1: Add user_id column if missing (for fresh tables) or convert type
DO $$
BEGIN
  -- If user_id column is text type, convert it to uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'user_id'
      AND data_type = 'text'
  ) THEN
    -- Remove any rows where user_id is not a valid uuid (legacy null/text rows)
    DELETE FROM app_settings WHERE user_id IS NULL OR user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    ALTER TABLE app_settings ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
    ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;

  -- If user_id column is already uuid, just ensure NOT NULL and DEFAULT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;
END $$;

-- Step 2: Add UNIQUE constraint so each user has exactly one row
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_user_id_key;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_user_id_key UNIQUE (user_id);

-- Step 3: Enable RLS (safe to re-run)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL old permissive "allow all" policies
DROP POLICY IF EXISTS "Allow select for all" ON app_settings;
DROP POLICY IF EXISTS "Allow insert for all" ON app_settings;
DROP POLICY IF EXISTS "Allow update for all" ON app_settings;
DROP POLICY IF EXISTS "Users can read own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON app_settings;

-- Step 5: Create strict per-user RLS policies
CREATE POLICY "Users can read own settings" ON app_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own settings" ON app_settings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Done! Verify with:
-- SELECT id, user_id, is_passcode_enabled, hidden_modules FROM app_settings;
