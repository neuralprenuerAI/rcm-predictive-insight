-- Add missing columns to patients table for patient update feature
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prefix text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS suffix text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();