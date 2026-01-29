-- Add raw_extracted_data column to patients table for storing OCR extraction results
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS raw_extracted_data JSONB;