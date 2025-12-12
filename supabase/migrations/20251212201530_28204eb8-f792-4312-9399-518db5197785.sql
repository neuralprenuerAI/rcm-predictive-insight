-- Create service_requests table
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT DEFAULT 'ecw',
  source_connection_id UUID REFERENCES public.api_connections(id),
  patient_id UUID REFERENCES public.patients(id),
  patient_external_id TEXT,
  category TEXT,
  code TEXT,
  code_display TEXT,
  status TEXT,
  priority TEXT,
  authored_on TIMESTAMPTZ,
  user_id UUID NOT NULL,
  last_synced_at TIMESTAMPTZ,
  raw_fhir_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_id, source)
);

-- Enable Row Level Security
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own service_requests"
  ON public.service_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own service_requests"
  ON public.service_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service_requests"
  ON public.service_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own service_requests"
  ON public.service_requests FOR DELETE
  USING (auth.uid() = user_id);

-- Function to link service_requests to patients
CREATE OR REPLACE FUNCTION public.link_service_requests_to_patients()
RETURNS void AS $$
BEGIN
  UPDATE public.service_requests sr
  SET patient_id = p.id
  FROM public.patients p
  WHERE sr.patient_external_id = p.external_id
    AND sr.source = p.source
    AND sr.user_id = p.user_id
    AND sr.patient_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;