-- Add columns for extracted data
ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS patient_dob TEXT,
ADD COLUMN IF NOT EXISTS patient_address TEXT,
ADD COLUMN IF NOT EXISTS patient_phone TEXT,
ADD COLUMN IF NOT EXISTS procedure_codes TEXT[],
ADD COLUMN IF NOT EXISTS diagnosis_codes TEXT[],
ADD COLUMN IF NOT EXISTS payer_type TEXT,
ADD COLUMN IF NOT EXISTS payer_id TEXT,
ADD COLUMN IF NOT EXISTS provider_name TEXT,
ADD COLUMN IF NOT EXISTS provider_npi TEXT,
ADD COLUMN IF NOT EXISTS service_facility_name TEXT,
ADD COLUMN IF NOT EXISTS service_facility_npi TEXT,
ADD COLUMN IF NOT EXISTS extracted_claim_data JSONB,
ADD COLUMN IF NOT EXISTS risk_level TEXT,
ADD COLUMN IF NOT EXISTS next_steps TEXT[],
ADD COLUMN IF NOT EXISTS source TEXT;