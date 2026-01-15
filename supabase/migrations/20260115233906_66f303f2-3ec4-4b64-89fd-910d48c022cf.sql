-- Create procedures table for syncing completed procedures from ECW
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT DEFAULT 'ecw',
  source_connection_id UUID REFERENCES public.api_connections(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_external_id TEXT,
  code TEXT,
  code_display TEXT,
  status TEXT,
  performed_date TIMESTAMPTZ,
  outcome TEXT,
  user_id UUID NOT NULL,
  last_synced_at TIMESTAMPTZ,
  raw_fhir_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT procedures_external_id_source_key UNIQUE (external_id, source)
);

-- Enable RLS
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own procedures"
  ON public.procedures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own procedures"
  ON public.procedures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own procedures"
  ON public.procedures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own procedures"
  ON public.procedures FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_procedures_updated_at
  BEFORE UPDATE ON public.procedures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to link procedures to patients
CREATE OR REPLACE FUNCTION public.link_procedures_to_patients()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Create index for performance
CREATE INDEX idx_procedures_user_id ON public.procedures(user_id);
CREATE INDEX idx_procedures_patient_id ON public.procedures(patient_id);
CREATE INDEX idx_procedures_external_id ON public.procedures(external_id);