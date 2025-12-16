-- Add new columns for storing AI analysis details
ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS approval_probability INTEGER,
ADD COLUMN IF NOT EXISTS documentation_score INTEGER,
ADD COLUMN IF NOT EXISTS executive_summary TEXT,
ADD COLUMN IF NOT EXISTS clinical_findings JSONB,
ADD COLUMN IF NOT EXISTS claim_filename TEXT,
ADD COLUMN IF NOT EXISTS notes_filename TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_claims_ai_reviewed_at ON public.claims(ai_reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_approval_probability ON public.claims(approval_probability);

-- Add policy to allow users to delete their own claims
CREATE POLICY "Users can delete own claims" 
ON public.claims 
FOR DELETE 
USING (auth.uid() = user_id);