-- Create table for API connections (EHR, etc.)
CREATE TABLE public.api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_name text NOT NULL,
  connection_type text NOT NULL, -- 'ehr', 'payer', 'other'
  api_url text NOT NULL,
  api_key_encrypted text, -- We'll store encrypted keys
  configuration jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_sync timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for payer portal connections
CREATE TABLE public.payer_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payer_name text NOT NULL,
  portal_url text NOT NULL,
  credentials_encrypted text, -- Store encrypted credentials
  configuration jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for generated letters
CREATE TABLE public.generated_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  letter_type text NOT NULL, -- 'appeal', 'prior_auth'
  related_id uuid, -- denial_id or authorization_id
  content text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create table for CPT code requirements
CREATE TABLE public.cpt_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpt_code text NOT NULL UNIQUE,
  requires_prior_auth boolean DEFAULT false,
  payer_specific jsonb DEFAULT '{}'::jsonb,
  cms_requirements text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpt_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_connections
CREATE POLICY "Users can view own API connections"
  ON public.api_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API connections"
  ON public.api_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API connections"
  ON public.api_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API connections"
  ON public.api_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for payer_connections
CREATE POLICY "Users can view own payer connections"
  ON public.payer_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payer connections"
  ON public.payer_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payer connections"
  ON public.payer_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payer connections"
  ON public.payer_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for generated_letters
CREATE POLICY "Users can view own letters"
  ON public.generated_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own letters"
  ON public.generated_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for cpt_requirements (read-only for users)
CREATE POLICY "Users can view CPT requirements"
  ON public.cpt_requirements FOR SELECT
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_api_connections_updated_at
  BEFORE UPDATE ON public.api_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payer_connections_updated_at
  BEFORE UPDATE ON public.payer_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_cpt_requirements_updated_at
  BEFORE UPDATE ON public.cpt_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();