-- =====================================================
-- DENIAL OUTCOMES TRACKING
-- Track actual claim results to improve predictions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.denial_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Link to scrub result
  scrub_result_id UUID REFERENCES public.claim_scrub_results(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  
  -- Claim identifiers
  patient_name TEXT,
  payer TEXT,
  procedure_codes TEXT[],
  icd_codes TEXT[],
  
  -- Original prediction
  predicted_risk_score INTEGER,
  predicted_risk_level TEXT,
  issues_flagged INTEGER DEFAULT 0,
  
  -- Actual outcome
  outcome TEXT NOT NULL CHECK (outcome IN ('paid', 'denied', 'partial', 'pending')),
  denial_reason_code TEXT,
  denial_reason_description TEXT,
  denial_category TEXT,
  
  -- Financial
  billed_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  denied_amount DECIMAL(10,2),
  
  -- Dates
  date_of_service DATE,
  date_submitted DATE,
  date_adjudicated DATE,
  
  -- Learning data
  was_prediction_correct BOOLEAN,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analysis
CREATE INDEX IF NOT EXISTS idx_denial_outcomes_user ON public.denial_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_denial_outcomes_outcome ON public.denial_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_denial_outcomes_payer ON public.denial_outcomes(payer);
CREATE INDEX IF NOT EXISTS idx_denial_outcomes_category ON public.denial_outcomes(denial_category);
CREATE INDEX IF NOT EXISTS idx_denial_outcomes_created ON public.denial_outcomes(created_at);

-- RLS
ALTER TABLE public.denial_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own denial outcomes"
  ON public.denial_outcomes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own denial outcomes"
  ON public.denial_outcomes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own denial outcomes"
  ON public.denial_outcomes FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- PAYER DENIAL PATTERNS VIEW
-- Aggregate patterns by payer for analysis
-- =====================================================

CREATE OR REPLACE VIEW public.payer_denial_patterns AS
SELECT 
  payer,
  COUNT(*) as total_claims,
  COUNT(*) FILTER (WHERE outcome = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE outcome = 'denied') as denied_count,
  COUNT(*) FILTER (WHERE outcome = 'partial') as partial_count,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'denied')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as denial_rate,
  ROUND(AVG(predicted_risk_score), 2) as avg_predicted_risk,
  ROUND(
    COUNT(*) FILTER (WHERE was_prediction_correct)::DECIMAL / 
    NULLIF(COUNT(*) FILTER (WHERE was_prediction_correct IS NOT NULL), 0) * 100, 2
  ) as prediction_accuracy,
  MODE() WITHIN GROUP (ORDER BY denial_category) as most_common_denial_reason
FROM public.denial_outcomes
WHERE payer IS NOT NULL
GROUP BY payer
ORDER BY total_claims DESC;

-- =====================================================
-- CPT DENIAL PATTERNS VIEW
-- =====================================================

CREATE OR REPLACE VIEW public.cpt_denial_patterns AS
SELECT 
  unnest(procedure_codes) as cpt_code,
  COUNT(*) as total_claims,
  COUNT(*) FILTER (WHERE outcome = 'denied') as denied_count,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'denied')::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as denial_rate,
  MODE() WITHIN GROUP (ORDER BY denial_category) as most_common_denial_reason,
  MODE() WITHIN GROUP (ORDER BY payer) as highest_denial_payer
FROM public.denial_outcomes
WHERE procedure_codes IS NOT NULL
GROUP BY unnest(procedure_codes)
HAVING COUNT(*) >= 3
ORDER BY denial_rate DESC;