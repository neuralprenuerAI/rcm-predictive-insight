-- =====================================================
-- ISSUE 1: Make Carlos super_admin
-- =====================================================

UPDATE user_roles 
SET role = 'super_admin', updated_at = now() 
WHERE email = 'carlos@neuralprenuer.com';

-- =====================================================
-- ISSUE 2: Add Company Column to user_roles
-- =====================================================

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS company text;

-- Update existing users with their companies
UPDATE user_roles SET company = 'Neuralprenuer' WHERE email IN ('jose@neuralprenuer.com', 'carlos@neuralprenuer.com');
UPDATE user_roles SET company = 'FBH Control' WHERE email = 'cdaza@fbhcontrol.com';
UPDATE user_roles SET company = 'Personal' WHERE email = 'carlos.daza@me.com';

-- =====================================================
-- ISSUE 3: Fix RLS - API_CONNECTIONS - Admins see ALL
-- =====================================================

DROP POLICY IF EXISTS "Users can view own connections" ON api_connections;
DROP POLICY IF EXISTS "Users can manage own connections" ON api_connections;
DROP POLICY IF EXISTS "Users can insert own connections" ON api_connections;
DROP POLICY IF EXISTS "Users can update own connections" ON api_connections;
DROP POLICY IF EXISTS "Users can delete own connections" ON api_connections;

-- Admins can VIEW all connections
CREATE POLICY "Users and admins can view connections" ON api_connections
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Users can only manage their OWN connections
CREATE POLICY "Users can insert own connections" ON api_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON api_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" ON api_connections
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- ISSUE 3: Fix RLS - PATIENTS - Admins see ALL
-- =====================================================

DROP POLICY IF EXISTS "Users can view own patients" ON patients;
DROP POLICY IF EXISTS "Users can manage own patients" ON patients;
DROP POLICY IF EXISTS "Users can insert own patients" ON patients;
DROP POLICY IF EXISTS "Users can update own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete own patients" ON patients;
DROP POLICY IF EXISTS "Users can view their own patients" ON patients;
DROP POLICY IF EXISTS "Users can create their own patients" ON patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON patients;

-- Admins can VIEW all patients
CREATE POLICY "Users and admins can view patients" ON patients
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Users can only manage their OWN patients
CREATE POLICY "Users can insert own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patients" ON patients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patients" ON patients
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- ISSUE 3: Fix RLS - PROCEDURES - Admins see ALL
-- =====================================================

DROP POLICY IF EXISTS "Users can view own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can manage own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can insert own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can update own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can delete own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can view their own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can create their own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can update their own procedures" ON procedures;
DROP POLICY IF EXISTS "Users can delete their own procedures" ON procedures;

-- Admins can VIEW all procedures
CREATE POLICY "Users and admins can view procedures" ON procedures
  FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Users can only manage their OWN procedures
CREATE POLICY "Users can insert own procedures" ON procedures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own procedures" ON procedures
  FOR UPDATE USING (auth.uid() = user_id);