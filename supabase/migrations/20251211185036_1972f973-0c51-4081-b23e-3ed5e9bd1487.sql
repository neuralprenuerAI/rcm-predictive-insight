-- Add missing columns to claims table for ECW FHIR sync
ALTER TABLE claims ADD COLUMN IF NOT EXISTS payer TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS fhir_id TEXT;

-- Create unique index on fhir_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS claims_fhir_id_user_idx ON claims(fhir_id, user_id) WHERE fhir_id IS NOT NULL;