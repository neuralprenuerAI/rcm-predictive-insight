-- Fix the "Anyone can log errors" policy to be more restrictive
DROP POLICY IF EXISTS "Anyone can log errors" ON error_logs;
CREATE POLICY "Authenticated users can log errors" ON error_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);