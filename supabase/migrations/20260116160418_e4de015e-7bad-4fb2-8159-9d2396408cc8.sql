-- =====================================================
-- Fix recursive RLS by using SECURITY DEFINER role check function
-- =====================================================

-- 1) Helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY(_roles)
  );
$$;

-- 2) Recreate user_roles policies without self-referential subqueries
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']));

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin']));

-- 3) Recreate activity_logs admin policy (was recursive)
DROP POLICY IF EXISTS "Admins can read all activity" ON public.activity_logs;

CREATE POLICY "Admins can read all activity" ON public.activity_logs
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']));

-- 4) Recreate error_logs policies (was recursive)
DROP POLICY IF EXISTS "Admins can read error logs" ON public.error_logs;
DROP POLICY IF EXISTS "Super admins can update error logs" ON public.error_logs;

CREATE POLICY "Admins can read error logs" ON public.error_logs
  FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']));

CREATE POLICY "Super admins can update error logs" ON public.error_logs
  FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin']));