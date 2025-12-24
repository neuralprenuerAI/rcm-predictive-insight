-- =====================================================
-- AI Charge Capture Auditor Schema
-- =====================================================

-- 1. clinical_notes - Store uploaded clinical documentation
CREATE TABLE public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Patient/Encounter Info
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  encounter_date DATE,
  encounter_id TEXT,
  
  -- Note Content
  note_type TEXT CHECK (note_type IN ('progress_note', 'procedure_note', 'h_and_p', 'consult', 'operative_note', 'discharge_summary', 'other')),
  raw_content TEXT,
  parsed_content JSONB DEFAULT '{}',
  
  -- Source
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'paste', 'ecw', 'athena', 'advancedmd', 'drchrono', 'ehr_import', 'other')),
  source_document_id TEXT,
  
  -- Processing
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  
  -- Provider Info
  provider_name TEXT,
  provider_npi TEXT,
  specialty TEXT,
  facility_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. charge_audits - Master record for each audit
CREATE TABLE public.charge_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinical_note_id UUID REFERENCES public.clinical_notes(id) ON DELETE SET NULL,
  
  -- Audit Info
  audit_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'comparing', 'completed', 'reviewed', 'actioned', 'failed')),
  
  -- Counts
  predicted_count INTEGER DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,
  undercoded_count INTEGER DEFAULT 0,
  overcoded_count INTEGER DEFAULT 0,
  
  -- Revenue Impact
  potential_revenue DECIMAL(10,2) DEFAULT 0,
  confirmed_revenue DECIMAL(10,2) DEFAULT 0,
  
  -- AI Metrics
  overall_confidence DECIMAL(5,2),
  processing_time_ms INTEGER,
  
  -- Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. predicted_charges - AI-predicted charges from clinical note analysis
CREATE TABLE public.predicted_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.charge_audits(id) ON DELETE CASCADE,
  
  -- Code Info
  cpt_code TEXT NOT NULL,
  cpt_description TEXT,
  units INTEGER DEFAULT 1,
  modifiers TEXT[] DEFAULT '{}',
  
  -- Supporting Diagnoses
  icd_codes TEXT[] DEFAULT '{}',
  
  -- Confidence
  confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  
  -- Evidence from Note
  supporting_text TEXT,
  reasoning TEXT,
  documentation_elements JSONB DEFAULT '{}',
  
  -- Estimated Value
  estimated_value DECIMAL(10,2),
  
  -- Match Status
  matched_actual_id UUID,
  match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'missing', 'undercoded', 'overcoded', 'partial')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. actual_charges - Provider's actual billed/submitted charges
CREATE TABLE public.actual_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.charge_audits(id) ON DELETE CASCADE,
  
  -- Code Info
  cpt_code TEXT NOT NULL,
  cpt_description TEXT,
  units INTEGER DEFAULT 1,
  modifiers TEXT[] DEFAULT '{}',
  icd_codes TEXT[] DEFAULT '{}',
  
  -- Source
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'superbill', 'ecw', 'athena', 'ehr_import', 'era', 'other')),
  external_charge_id TEXT,
  
  -- Amount
  charge_amount DECIMAL(10,2),
  
  -- Match
  matched_predicted_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. audit_discrepancies - Specific issues/gaps found during audit
CREATE TABLE public.audit_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.charge_audits(id) ON DELETE CASCADE,
  predicted_charge_id UUID REFERENCES public.predicted_charges(id) ON DELETE SET NULL,
  actual_charge_id UUID REFERENCES public.actual_charges(id) ON DELETE SET NULL,
  
  -- Discrepancy Type
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN (
    'missing_charge',
    'undercoded',
    'overcoded',
    'wrong_units',
    'missing_modifier',
    'wrong_modifier',
    'missing_diagnosis',
    'unbundling_opportunity',
    'documentation_gap'
  )),
  
  -- Details
  description TEXT,
  predicted_cpt TEXT,
  predicted_units INTEGER,
  predicted_modifiers TEXT[],
  actual_cpt TEXT,
  actual_units INTEGER,
  actual_modifiers TEXT[],
  
  -- Impact
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  revenue_impact DECIMAL(10,2),
  
  -- Evidence
  supporting_text TEXT,
  ai_explanation TEXT,
  
  -- Resolution
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected', 'corrected', 'appealed')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. cpt_documentation_rules - Keywords and documentation requirements
CREATE TABLE public.cpt_documentation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Code Info
  cpt_code TEXT NOT NULL,
  cpt_description TEXT,
  cpt_category TEXT,
  
  -- Keywords (for AI matching)
  required_keywords TEXT[] DEFAULT '{}',
  supporting_keywords TEXT[] DEFAULT '{}',
  exclusion_keywords TEXT[] DEFAULT '{}',
  
  -- E/M Specific
  em_level INTEGER CHECK (em_level >= 1 AND em_level <= 5),
  mdm_level TEXT CHECK (mdm_level IN ('straightforward', 'low', 'moderate', 'high')),
  time_threshold_minutes INTEGER,
  
  -- Documentation Elements
  required_elements JSONB DEFAULT '{}',
  
  -- Specialty
  specialty TEXT,
  
  -- Common Modifiers
  common_modifiers TEXT[] DEFAULT '{}',
  modifier_triggers JSONB DEFAULT '{}',
  
  -- Reimbursement (rough estimates for impact calculation)
  medicare_rate DECIMAL(10,2),
  commercial_rate DECIMAL(10,2),
  
  -- Status
  active BOOLEAN DEFAULT true,
  source TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- clinical_notes indexes
CREATE INDEX idx_clinical_notes_user ON public.clinical_notes(user_id);
CREATE INDEX idx_clinical_notes_patient ON public.clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_status ON public.clinical_notes(status);
CREATE INDEX idx_clinical_notes_date ON public.clinical_notes(encounter_date DESC);
CREATE INDEX idx_clinical_notes_created ON public.clinical_notes(created_at DESC);

-- charge_audits indexes
CREATE INDEX idx_charge_audits_user ON public.charge_audits(user_id);
CREATE INDEX idx_charge_audits_note ON public.charge_audits(clinical_note_id);
CREATE INDEX idx_charge_audits_status ON public.charge_audits(status);
CREATE INDEX idx_charge_audits_date ON public.charge_audits(audit_date DESC);

-- predicted_charges indexes
CREATE INDEX idx_predicted_charges_audit ON public.predicted_charges(audit_id);
CREATE INDEX idx_predicted_charges_cpt ON public.predicted_charges(cpt_code);
CREATE INDEX idx_predicted_charges_status ON public.predicted_charges(match_status);

-- actual_charges indexes
CREATE INDEX idx_actual_charges_audit ON public.actual_charges(audit_id);
CREATE INDEX idx_actual_charges_cpt ON public.actual_charges(cpt_code);

-- audit_discrepancies indexes
CREATE INDEX idx_discrepancies_audit ON public.audit_discrepancies(audit_id);
CREATE INDEX idx_discrepancies_type ON public.audit_discrepancies(discrepancy_type);
CREATE INDEX idx_discrepancies_status ON public.audit_discrepancies(status);
CREATE INDEX idx_discrepancies_severity ON public.audit_discrepancies(severity);

-- cpt_documentation_rules indexes
CREATE INDEX idx_cpt_rules_code ON public.cpt_documentation_rules(cpt_code);
CREATE INDEX idx_cpt_rules_category ON public.cpt_documentation_rules(cpt_category);
CREATE INDEX idx_cpt_rules_specialty ON public.cpt_documentation_rules(specialty);
CREATE INDEX idx_cpt_rules_active ON public.cpt_documentation_rules(active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- clinical_notes RLS
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clinical_notes" ON public.clinical_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clinical_notes" ON public.clinical_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clinical_notes" ON public.clinical_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clinical_notes" ON public.clinical_notes FOR DELETE USING (auth.uid() = user_id);

-- charge_audits RLS
ALTER TABLE public.charge_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own charge_audits" ON public.charge_audits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own charge_audits" ON public.charge_audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own charge_audits" ON public.charge_audits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own charge_audits" ON public.charge_audits FOR DELETE USING (auth.uid() = user_id);

-- predicted_charges RLS (through audit_id relationship)
ALTER TABLE public.predicted_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own predicted_charges" ON public.predicted_charges FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = predicted_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can insert own predicted_charges" ON public.predicted_charges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = predicted_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can update own predicted_charges" ON public.predicted_charges FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = predicted_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can delete own predicted_charges" ON public.predicted_charges FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = predicted_charges.audit_id AND charge_audits.user_id = auth.uid())
);

-- actual_charges RLS
ALTER TABLE public.actual_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own actual_charges" ON public.actual_charges FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = actual_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can insert own actual_charges" ON public.actual_charges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = actual_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can update own actual_charges" ON public.actual_charges FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = actual_charges.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can delete own actual_charges" ON public.actual_charges FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = actual_charges.audit_id AND charge_audits.user_id = auth.uid())
);

-- audit_discrepancies RLS
ALTER TABLE public.audit_discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit_discrepancies" ON public.audit_discrepancies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = audit_discrepancies.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can insert own audit_discrepancies" ON public.audit_discrepancies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = audit_discrepancies.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can update own audit_discrepancies" ON public.audit_discrepancies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = audit_discrepancies.audit_id AND charge_audits.user_id = auth.uid())
);
CREATE POLICY "Users can delete own audit_discrepancies" ON public.audit_discrepancies FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.charge_audits WHERE charge_audits.id = audit_discrepancies.audit_id AND charge_audits.user_id = auth.uid())
);

-- cpt_documentation_rules RLS (readable by all authenticated users)
ALTER TABLE public.cpt_documentation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view cpt_documentation_rules" ON public.cpt_documentation_rules FOR SELECT USING (true);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE TRIGGER set_clinical_notes_updated_at
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_charge_audits_updated_at
  BEFORE UPDATE ON public.charge_audits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_cpt_documentation_rules_updated_at
  BEFORE UPDATE ON public.cpt_documentation_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();