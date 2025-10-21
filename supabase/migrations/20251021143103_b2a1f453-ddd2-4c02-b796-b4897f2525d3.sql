-- Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  denial_id UUID REFERENCES public.denials(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  content TEXT,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appeals"
ON public.appeals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own appeals"
ON public.appeals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own appeals"
ON public.appeals
FOR UPDATE
USING (auth.uid() = user_id);

-- Create authorizations table
CREATE TABLE IF NOT EXISTS public.authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  patient_name TEXT NOT NULL,
  payer TEXT NOT NULL,
  service TEXT,
  cpt_codes TEXT[],
  diagnosis_codes TEXT[],
  request_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  auth_number TEXT,
  decision_date DATE,
  denial_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own authorizations"
ON public.authorizations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own authorizations"
ON public.authorizations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own authorizations"
ON public.authorizations
FOR UPDATE
USING (auth.uid() = user_id);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  payer TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  method TEXT,
  reference TEXT,
  adjustments JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
ON public.payments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
ON public.payments
FOR UPDATE
USING (auth.uid() = user_id);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  theme TEXT NOT NULL DEFAULT 'system',
  default_date_range TEXT NOT NULL DEFAULT '30d',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Add update triggers for updated_at using existing function
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_appeals_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_appeals_updated_at
    BEFORE UPDATE ON public.appeals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_authorizations_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_authorizations_updated_at
    BEFORE UPDATE ON public.authorizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_payments_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_user_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;