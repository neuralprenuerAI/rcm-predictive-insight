-- Add unique constraint for patient upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_external_source_user 
ON public.patients (external_id, source, user_id);