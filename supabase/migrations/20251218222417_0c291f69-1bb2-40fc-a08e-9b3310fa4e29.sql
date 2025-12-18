-- =====================================================
-- AI CLAIM SCRUBBER - COMPLETE DATABASE SCHEMA
-- Creates all tables for MUE, NCCI, modifiers, 
-- medical necessity, payer rules, and scrub results
-- =====================================================

-- =====================================================
-- TABLE 1: MUE EDITS (Medically Unlikely Edits)
-- Stores CMS MUE limits for procedure units
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mue_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpt_code VARCHAR(10) NOT NULL,
  practitioner_limit INTEGER,
  facility_limit INTEGER,
  rationale VARCHAR(3),
  effective_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT mue_cpt_unique UNIQUE(cpt_code, effective_date)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_mue_cpt ON public.mue_edits(cpt_code);
CREATE INDEX IF NOT EXISTS idx_mue_effective ON public.mue_edits(effective_date);

-- =====================================================
-- TABLE 2: NCCI PTP EDITS (Procedure-to-Procedure)
-- Identifies code pairs that should not be billed together
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ncci_ptp_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_1_cpt VARCHAR(10) NOT NULL,
  column_2_cpt VARCHAR(10) NOT NULL,
  modifier_indicator CHAR(1) DEFAULT '0',
  effective_date DATE DEFAULT CURRENT_DATE,
  deletion_date DATE,
  ptp_edit_rationale INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT ncci_pair_unique UNIQUE(column_1_cpt, column_2_cpt, effective_date)
);

-- Indexes for checking code pairs
CREATE INDEX IF NOT EXISTS idx_ncci_col1 ON public.ncci_ptp_edits(column_1_cpt);
CREATE INDEX IF NOT EXISTS idx_ncci_col2 ON public.ncci_ptp_edits(column_2_cpt);
CREATE INDEX IF NOT EXISTS idx_ncci_pair ON public.ncci_ptp_edits(column_1_cpt, column_2_cpt);

-- =====================================================
-- TABLE 3: MODIFIER RULES
-- Validation rules for CPT modifiers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.modifier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier VARCHAR(5) NOT NULL,
  modifier_description TEXT,
  required_with_cpt_categories TEXT[],
  required_conditions TEXT[],
  prohibited_with_modifiers VARCHAR(5)[],
  requires_documentation BOOLEAN DEFAULT false,
  documentation_requirements TEXT,
  global_rule BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT modifier_unique UNIQUE(modifier)
);

-- Index for modifier lookup
CREATE INDEX IF NOT EXISTS idx_modifier ON public.modifier_rules(modifier);

-- =====================================================
-- TABLE 4: MEDICAL NECESSITY MATRIX
-- Maps CPT codes to valid ICD codes with necessity scores
-- =====================================================
CREATE TABLE IF NOT EXISTS public.medical_necessity_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpt_code VARCHAR(10) NOT NULL,
  icd_code VARCHAR(10) NOT NULL,
  necessity_score INTEGER DEFAULT 100 CHECK (necessity_score >= 0 AND necessity_score <= 100),
  payer_type VARCHAR(50) DEFAULT 'all',
  notes TEXT,
  source VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT necessity_pair_unique UNIQUE(cpt_code, icd_code, payer_type)
);

-- Indexes for necessity checks
CREATE INDEX IF NOT EXISTS idx_necessity_cpt ON public.medical_necessity_matrix(cpt_code);
CREATE INDEX IF NOT EXISTS idx_necessity_icd ON public.medical_necessity_matrix(icd_code);
CREATE INDEX IF NOT EXISTS idx_necessity_pair ON public.medical_necessity_matrix(cpt_code, icd_code);
CREATE INDEX IF NOT EXISTS idx_necessity_payer ON public.medical_necessity_matrix(payer_type);

-- =====================================================
-- TABLE 5: PAYER RULES
-- Payer-specific billing rules and requirements
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name VARCHAR(255) NOT NULL,
  payer_id VARCHAR(50),
  rule_type VARCHAR(50) NOT NULL,
  cpt_codes TEXT[],
  icd_codes TEXT[],
  rule_description TEXT NOT NULL,
  action_required TEXT,
  denial_reason_codes TEXT[],
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payer rule lookup
CREATE INDEX IF NOT EXISTS idx_payer_name ON public.payer_rules(payer_name);
CREATE INDEX IF NOT EXISTS idx_payer_rule_type ON public.payer_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_payer_active ON public.payer_rules(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_payer_cpt ON public.payer_rules USING GIN(cpt_codes);

-- =====================================================
-- TABLE 6: CLAIM SCRUB RESULTS
-- Stores results of claim scrubbing/validation
-- =====================================================
CREATE TABLE IF NOT EXISTS public.claim_scrub_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  
  -- Risk Assessment
  denial_risk_score INTEGER DEFAULT 0 CHECK (denial_risk_score >= 0 AND denial_risk_score <= 100),
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  
  -- Issue Categories (JSONB arrays)
  mue_issues JSONB DEFAULT '[]'::jsonb,
  ncci_issues JSONB DEFAULT '[]'::jsonb,
  modifier_issues JSONB DEFAULT '[]'::jsonb,
  necessity_issues JSONB DEFAULT '[]'::jsonb,
  payer_issues JSONB DEFAULT '[]'::jsonb,
  documentation_issues JSONB DEFAULT '[]'::jsonb,
  
  -- Combined Results
  all_issues JSONB DEFAULT '[]'::jsonb,
  corrections JSONB DEFAULT '[]'::jsonb,
  
  -- Issue Counts
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  total_issues INTEGER DEFAULT 0,
  
  -- Claim Info Snapshot
  claim_info JSONB,
  
  -- Status Tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed', 'corrected', 'submitted', 'failed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scrub results
CREATE INDEX IF NOT EXISTS idx_scrub_user ON public.claim_scrub_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scrub_claim ON public.claim_scrub_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_scrub_risk ON public.claim_scrub_results(denial_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_scrub_status ON public.claim_scrub_results(status);
CREATE INDEX IF NOT EXISTS idx_scrub_created ON public.claim_scrub_results(created_at DESC);

-- =====================================================
-- TABLE 7: NOTIFICATIONS
-- System notifications and alerts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification Content
  notification_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Related Entities
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  scrub_result_id UUID REFERENCES public.claim_scrub_results(id) ON DELETE SET NULL,
  
  -- Action
  action_url TEXT,
  action_label TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notif_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_created ON public.notifications(created_at DESC);

-- =====================================================
-- TABLE 8: DENIAL HISTORY (For ML Training)
-- Tracks actual denials to improve predictions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.denial_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  
  -- Claim Details at Denial
  payer VARCHAR(255),
  cpt_codes TEXT[],
  icd_codes TEXT[],
  modifiers TEXT[],
  billed_amount DECIMAL(12,2),
  
  -- Denial Information
  denial_date DATE,
  denial_reason_code VARCHAR(50),
  denial_reason_description TEXT,
  denial_category VARCHAR(100),
  remark_codes TEXT[],
  
  -- Resolution
  was_appealed BOOLEAN DEFAULT false,
  appeal_outcome VARCHAR(50) CHECK (appeal_outcome IN ('overturned', 'upheld', 'partial', 'pending', NULL)),
  appeal_date DATE,
  final_paid_amount DECIMAL(12,2),
  
  -- Prediction Tracking
  predicted_risk_score INTEGER,
  scrub_result_id UUID REFERENCES public.claim_scrub_results(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for denial history
CREATE INDEX IF NOT EXISTS idx_denial_user ON public.denial_history(user_id);
CREATE INDEX IF NOT EXISTS idx_denial_payer ON public.denial_history(payer);
CREATE INDEX IF NOT EXISTS idx_denial_reason ON public.denial_history(denial_reason_code);
CREATE INDEX IF NOT EXISTS idx_denial_category ON public.denial_history(denial_category);
CREATE INDEX IF NOT EXISTS idx_denial_cpt ON public.denial_history USING GIN(cpt_codes);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on user-specific tables
ALTER TABLE public.claim_scrub_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denial_history ENABLE ROW LEVEL SECURITY;

-- Claim Scrub Results Policies
CREATE POLICY "Users can view own scrub results" 
  ON public.claim_scrub_results FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scrub results" 
  ON public.claim_scrub_results FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scrub results" 
  ON public.claim_scrub_results FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scrub results" 
  ON public.claim_scrub_results FOR DELETE 
  USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" 
  ON public.notifications FOR DELETE 
  USING (auth.uid() = user_id);

-- Denial History Policies
CREATE POLICY "Users can view own denial history" 
  ON public.denial_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own denial history" 
  ON public.denial_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own denial history" 
  ON public.denial_history FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own denial history" 
  ON public.denial_history FOR DELETE 
  USING (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp (only if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_mue_edits_updated_at ON public.mue_edits;
CREATE TRIGGER update_mue_edits_updated_at
  BEFORE UPDATE ON public.mue_edits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payer_rules_updated_at ON public.payer_rules;
CREATE TRIGGER update_payer_rules_updated_at
  BEFORE UPDATE ON public.payer_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_claim_scrub_results_updated_at ON public.claim_scrub_results;
CREATE TRIGGER update_claim_scrub_results_updated_at
  BEFORE UPDATE ON public.claim_scrub_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Reference tables (read by everyone)
GRANT SELECT ON public.mue_edits TO authenticated;
GRANT SELECT ON public.ncci_ptp_edits TO authenticated;
GRANT SELECT ON public.modifier_rules TO authenticated;
GRANT SELECT ON public.medical_necessity_matrix TO authenticated;
GRANT SELECT ON public.payer_rules TO authenticated;

-- User tables (managed by RLS)
GRANT ALL ON public.claim_scrub_results TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.denial_history TO authenticated;

-- Service role has full access
GRANT ALL ON public.mue_edits TO service_role;
GRANT ALL ON public.ncci_ptp_edits TO service_role;
GRANT ALL ON public.modifier_rules TO service_role;
GRANT ALL ON public.medical_necessity_matrix TO service_role;
GRANT ALL ON public.payer_rules TO service_role;
GRANT ALL ON public.claim_scrub_results TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.denial_history TO service_role;