-- =====================================================
-- PENDING INVITES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invited_by_email text,
  invite_token uuid DEFAULT gen_random_uuid(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all invites (using has_any_role to avoid recursion)
CREATE POLICY "Admins can view invites" ON public.pending_invites
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin'])
  );

-- Policy: Admins can create invites
CREATE POLICY "Admins can create invites" ON public.pending_invites
  FOR INSERT WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin', 'admin'])
  );

-- Policy: Super admins can update invites
CREATE POLICY "Super admins can update invites" ON public.pending_invites
  FOR UPDATE USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin'])
  );

-- Policy: Super admins can delete invites
CREATE POLICY "Super admins can delete invites" ON public.pending_invites
  FOR DELETE USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin'])
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON public.pending_invites(email);
CREATE INDEX IF NOT EXISTS idx_pending_invites_token ON public.pending_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_pending_invites_status ON public.pending_invites(status);

-- =====================================================
-- FUNCTION: Check if email is invited
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_email_invited(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pending_invites 
    WHERE email = lower(check_email)
    AND status = 'pending'
    AND expires_at > now()
  );
$$;

-- =====================================================
-- FUNCTION: Get invite role for email
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_invite_role(check_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.pending_invites 
  WHERE email = lower(check_email)
  AND status = 'pending'
  AND expires_at > now()
  LIMIT 1;
$$;

-- =====================================================
-- UPDATE: Modify new user trigger to check invite and assign role
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_role text;
BEGIN
  -- Check if user was invited
  SELECT role INTO invited_role 
  FROM public.pending_invites 
  WHERE email = lower(NEW.email)
  AND status = 'pending'
  AND expires_at > now();
  
  -- If invited, use invited role; otherwise default to 'user'
  INSERT INTO public.user_roles (user_id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(invited_role, 'user'))
  ON CONFLICT (user_id) DO UPDATE SET role = COALESCE(invited_role, user_roles.role);
  
  -- Mark invite as accepted if exists
  UPDATE public.pending_invites 
  SET status = 'accepted', accepted_at = now()
  WHERE email = lower(NEW.email) AND status = 'pending';
  
  RETURN NEW;
END;
$$;