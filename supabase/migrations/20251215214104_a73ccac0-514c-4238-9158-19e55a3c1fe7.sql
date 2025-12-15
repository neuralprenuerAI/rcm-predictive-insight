-- ============================================
-- CLAIM-DOCUMENT LINKING TABLE
-- Links clinical documents to claims for AI review
-- ============================================

-- Table to link documents to claims
CREATE TABLE IF NOT EXISTS public.claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  
  -- Document role in the claim
  document_role TEXT NOT NULL DEFAULT 'supporting' CHECK (document_role IN (
    'clinical_note',
    'progress_note', 
    'operative_report',
    'lab_result',
    'imaging_report',
    'referral',
    'prior_auth',
    'medical_record',
    'supporting',
    'other'
  )),
  
  -- Metadata
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate links
  UNIQUE(claim_id, document_id)
);

-- Indexes
CREATE INDEX idx_claim_documents_claim_id ON public.claim_documents(claim_id);
CREATE INDEX idx_claim_documents_document_id ON public.claim_documents(document_id);
CREATE INDEX idx_claim_documents_user_id ON public.claim_documents(user_id);

-- RLS
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own claim_documents"
  ON public.claim_documents FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- ADD AI REVIEW COLUMNS TO CLAIMS TABLE
-- (ai_analysis already exists, add new columns)
-- ============================================

ALTER TABLE public.claims 
ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_recommendations TEXT[];

-- Index for filtering by risk (using existing deniability_probability)
CREATE INDEX IF NOT EXISTS idx_claims_deniability ON public.claims(deniability_probability);
CREATE INDEX IF NOT EXISTS idx_claims_risk_category ON public.claims(risk_category);