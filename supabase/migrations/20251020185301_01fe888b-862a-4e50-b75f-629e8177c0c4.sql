-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create claims table
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  date_of_service DATE NOT NULL,
  provider TEXT NOT NULL,
  diagnosis_code TEXT,
  procedure_code TEXT,
  billed_amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  claim_file_url TEXT,
  notes_file_url TEXT,
  ai_analysis JSONB,
  deniability_probability DECIMAL(5,2),
  risk_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON public.claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own claims"
  ON public.claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own claims"
  ON public.claims FOR UPDATE
  USING (auth.uid() = user_id);

-- Create denials table
CREATE TABLE public.denials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims ON DELETE CASCADE,
  denial_code TEXT NOT NULL,
  denial_reason TEXT NOT NULL,
  denied_amount DECIMAL(10,2),
  payer TEXT NOT NULL,
  denial_date DATE NOT NULL,
  appeal_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.denials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own denials"
  ON public.denials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own denials"
  ON public.denials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create metrics table for dashboard
CREATE TABLE public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON public.metrics FOR SELECT
  USING (auth.uid() = user_id);

-- Create storage bucket for claim files
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-files', 'claim-files', false);

-- Storage policies for claim files
CREATE POLICY "Users can upload own claim files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'claim-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own claim files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claim-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own claim files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'claim-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_claims
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();