-- Enable RLS on reference tables
ALTER TABLE public.mue_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncci_ptp_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_necessity_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_rules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read reference tables
CREATE POLICY "Authenticated users can read mue_edits" 
  ON public.mue_edits FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read ncci_ptp_edits" 
  ON public.ncci_ptp_edits FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read modifier_rules" 
  ON public.modifier_rules FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read medical_necessity_matrix" 
  ON public.medical_necessity_matrix FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read payer_rules" 
  ON public.payer_rules FOR SELECT 
  TO authenticated
  USING (true);