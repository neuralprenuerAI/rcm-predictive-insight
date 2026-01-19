-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin')
  );
$$;

-- Fix is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;

-- Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid()),
    'user'
  );
$$;

-- Fix handle_new_user_role function
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_role text;
BEGIN
  SELECT role INTO invited_role 
  FROM public.pending_invites 
  WHERE email = lower(NEW.email)
  AND status = 'pending'
  AND expires_at > now();
  
  INSERT INTO public.user_roles (user_id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(invited_role, 'user'))
  ON CONFLICT (user_id) DO UPDATE SET role = COALESCE(invited_role, user_roles.role);
  
  UPDATE public.pending_invites 
  SET status = 'accepted', accepted_at = now()
  WHERE email = lower(NEW.email) AND status = 'pending';
  
  RETURN NEW;
END;
$$;

-- Fix handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix is_email_invited function
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

-- Fix get_invite_role function
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

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix has_any_role function
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

-- Fix increment_template_usage function
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appeal_templates 
  SET times_used = COALESCE(times_used, 0) + 1 
  WHERE id = template_id;
END;
$$;

-- Fix link_service_requests_to_patients function
CREATE OR REPLACE FUNCTION public.link_service_requests_to_patients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.service_requests sr
  SET patient_id = p.id
  FROM public.patients p
  WHERE sr.patient_external_id = p.external_id
    AND sr.source = p.source
    AND sr.user_id = p.user_id
    AND sr.patient_id IS NULL;
END;
$$;

-- Fix link_procedures_to_patients function
CREATE OR REPLACE FUNCTION public.link_procedures_to_patients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.procedures p
  SET patient_id = pat.id
  FROM public.patients pat
  WHERE p.patient_external_id = pat.external_id
    AND p.source = pat.source
    AND p.user_id = pat.user_id
    AND p.patient_id IS NULL;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;