-- =====================================================
-- AI DENIAL MANAGEMENT - DATABASE SCHEMA
-- Tables for denial workflows, classifications, 
-- appeal templates, and deadline tracking
-- =====================================================

-- =====================================================
-- TABLE 1: DENIAL CLASSIFICATIONS
-- Master list of denial reason codes and categories
-- =====================================================
CREATE TABLE IF NOT EXISTS public.denial_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reason Code Info
  reason_code VARCHAR(10) NOT NULL,
  reason_description TEXT,
  
  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'medical_necessity',
    'coding_error', 
    'authorization',
    'eligibility',
    'timely_filing',
    'duplicate',
    'bundling',
    'modifier',
    'documentation',
    'coordination_of_benefits',
    'provider_enrollment',
    'contract',
    'other'
  )),
  subcategory TEXT,
  
  -- Root Cause Analysis
  common_causes TEXT[],
  typical_resolution TEXT,
  
  -- Appeal Info
  appealable BOOLEAN DEFAULT true,
  appeal_success_rate DECIMAL(5,2),
  recommended_action TEXT,
  required_documentation TEXT[],
  
  -- Deadlines
  typical_appeal_deadline_days INTEGER DEFAULT 60,
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT denial_class_unique UNIQUE(reason_code)
);

-- =====================================================
-- TABLE 2: DENIAL_QUEUE
-- Active denials requiring attention
-- =====================================================
CREATE TABLE IF NOT EXISTS public.denial_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Source References
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  remittance_id UUID,
  
  -- Denial Info
  denial_date DATE NOT NULL,
  service_date DATE,
  payer_name TEXT,
  payer_id TEXT,
  
  -- Codes
  reason_code VARCHAR(10),
  reason_description TEXT,
  remark_codes TEXT[],
  adjustment_reason_code VARCHAR(10),
  
  -- Amounts
  billed_amount DECIMAL(10,2),
  allowed_amount DECIMAL(10,2),
  denied_amount DECIMAL(10,2),
  
  -- CPT/ICD
  cpt_code VARCHAR(10),
  cpt_description TEXT,
  icd_codes TEXT[],
  modifiers TEXT[],
  
  -- Classification (AI-assigned)
  classification_id UUID REFERENCES denial_classifications(id),
  classified_category TEXT,
  root_cause TEXT,
  ai_confidence DECIMAL(5,2),
  
  -- Status Workflow
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new',
    'reviewing',
    'appealing',
    'correcting',
    'resubmitting',
    'resolved',
    'written_off',
    'escalated'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- Deadlines
  appeal_deadline DATE,
  days_until_deadline INTEGER,
  
  -- Resolution
  resolution_type TEXT CHECK (resolution_type IN (
    'appeal_won',
    'appeal_denied', 
    'corrected_resubmit',
    'payment_received',
    'written_off',
    'patient_responsibility',
    'other'
  )),
  resolution_amount DECIMAL(10,2),
  resolution_date DATE,
  resolution_notes TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 3: APPEAL_TEMPLATES
-- Pre-built appeal letter templates by denial type
-- =====================================================
CREATE TABLE IF NOT EXISTS public.appeal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Categorization
  denial_category TEXT NOT NULL,
  reason_codes TEXT[],
  payer_specific TEXT,
  
  -- Template Content
  subject_template TEXT,
  body_template TEXT NOT NULL,
  
  -- Placeholders used: {{patient_name}}, {{dos}}, {{cpt_code}}, {{icd_codes}}, 
  -- {{billed_amount}}, {{denial_reason}}, {{provider_name}}, {{practice_name}},
  -- {{claim_number}}, {{payer_name}}, {{member_id}}
  
  -- Required Attachments
  required_attachments TEXT[],
  optional_attachments TEXT[],
  
  -- Effectiveness
  success_rate DECIMAL(5,2),
  times_used INTEGER DEFAULT 0,
  
  -- Status
  active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 4: APPEALS (recreate with new structure)
-- Generated appeal records
-- =====================================================
DROP TABLE IF EXISTS public.appeals CASCADE;

CREATE TABLE public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- References
  denial_queue_id UUID REFERENCES denial_queue(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  template_id UUID REFERENCES appeal_templates(id),
  
  -- Appeal Details
  appeal_number TEXT,
  appeal_date DATE DEFAULT CURRENT_DATE,
  appeal_type TEXT DEFAULT 'first_level' CHECK (appeal_type IN (
    'first_level',
    'second_level', 
    'external_review',
    'peer_to_peer',
    'expedited'
  )),
  
  -- Payer Info
  payer_name TEXT,
  payer_address TEXT,
  payer_fax TEXT,
  payer_email TEXT,
  
  -- Letter Content
  subject_line TEXT,
  letter_body TEXT,
  
  -- Amounts
  disputed_amount DECIMAL(10,2),
  requested_amount DECIMAL(10,2),
  
  -- Supporting Info
  clinical_justification TEXT,
  supporting_documents TEXT[],
  attachments JSONB DEFAULT '[]',
  
  -- Submission
  submission_method TEXT CHECK (submission_method IN ('mail', 'fax', 'portal', 'email', 'electronic')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  confirmation_number TEXT,
  
  -- Tracking
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending_review',
    'approved',
    'submitted',
    'acknowledged',
    'in_review',
    'additional_info_requested',
    'won',
    'denied',
    'partial',
    'withdrawn'
  )),
  
  -- Response
  response_date DATE,
  response_notes TEXT,
  outcome_amount DECIMAL(10,2),
  
  -- Deadlines
  response_deadline DATE,
  
  -- AI Generation Info
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 5: DENIAL_ACTIONS
-- Action log for denial workflow
-- =====================================================
CREATE TABLE IF NOT EXISTS public.denial_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- References
  denial_queue_id UUID REFERENCES denial_queue(id) ON DELETE CASCADE,
  appeal_id UUID REFERENCES appeals(id) ON DELETE SET NULL,
  
  -- Action Info
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created',
    'classified',
    'assigned',
    'status_change',
    'note_added',
    'appeal_generated',
    'appeal_submitted',
    'response_received',
    'resolved',
    'escalated',
    'deadline_alert'
  )),
  action_description TEXT,
  
  -- Old/New Values
  previous_value TEXT,
  new_value TEXT,
  
  -- Metadata
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 6: DENIAL_NOTES
-- Notes and comments on denials
-- =====================================================
CREATE TABLE IF NOT EXISTS public.denial_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  denial_queue_id UUID REFERENCES denial_queue(id) ON DELETE CASCADE,
  
  note_type TEXT DEFAULT 'general' CHECK (note_type IN (
    'general',
    'internal',
    'payer_communication',
    'clinical',
    'resolution'
  )),
  note_text TEXT NOT NULL,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- denial_classifications indexes
CREATE INDEX IF NOT EXISTS idx_denial_class_code ON denial_classifications(reason_code);
CREATE INDEX IF NOT EXISTS idx_denial_class_category ON denial_classifications(category);

-- denial_queue indexes
CREATE INDEX IF NOT EXISTS idx_denial_queue_user ON denial_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_denial_queue_status ON denial_queue(status);
CREATE INDEX IF NOT EXISTS idx_denial_queue_priority ON denial_queue(priority);
CREATE INDEX IF NOT EXISTS idx_denial_queue_deadline ON denial_queue(appeal_deadline);
CREATE INDEX IF NOT EXISTS idx_denial_queue_payer ON denial_queue(payer_name);
CREATE INDEX IF NOT EXISTS idx_denial_queue_reason ON denial_queue(reason_code);
CREATE INDEX IF NOT EXISTS idx_denial_queue_date ON denial_queue(denial_date DESC);
CREATE INDEX IF NOT EXISTS idx_denial_queue_claim ON denial_queue(claim_id);

-- appeal_templates indexes
CREATE INDEX IF NOT EXISTS idx_appeal_templates_category ON appeal_templates(denial_category);
CREATE INDEX IF NOT EXISTS idx_appeal_templates_active ON appeal_templates(active);

-- appeals indexes
CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_denial ON appeals(denial_queue_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_date ON appeals(appeal_date DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_deadline ON appeals(response_deadline);

-- denial_actions indexes
CREATE INDEX IF NOT EXISTS idx_denial_actions_queue ON denial_actions(denial_queue_id);
CREATE INDEX IF NOT EXISTS idx_denial_actions_type ON denial_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_denial_actions_date ON denial_actions(performed_at DESC);

-- denial_notes indexes
CREATE INDEX IF NOT EXISTS idx_denial_notes_queue ON denial_notes(denial_queue_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE denial_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE denial_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE denial_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE denial_notes ENABLE ROW LEVEL SECURITY;

-- denial_classifications (read by all authenticated)
CREATE POLICY "Authenticated can view denial_classifications" 
  ON denial_classifications FOR SELECT 
  USING (auth.role() = 'authenticated');

-- denial_queue policies
CREATE POLICY "Users can view own denial_queue" 
  ON denial_queue FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own denial_queue" 
  ON denial_queue FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own denial_queue" 
  ON denial_queue FOR UPDATE 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own denial_queue" 
  ON denial_queue FOR DELETE 
  USING (auth.uid() = user_id);

-- appeal_templates (read by all authenticated)
CREATE POLICY "Authenticated can view appeal_templates" 
  ON appeal_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

-- appeals policies
CREATE POLICY "Users can view own appeals" 
  ON appeals FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appeals" 
  ON appeals FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own appeals" 
  ON appeals FOR UPDATE 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own appeals" 
  ON appeals FOR DELETE 
  USING (auth.uid() = user_id);

-- denial_actions policies
CREATE POLICY "Users can view own denial_actions" 
  ON denial_actions FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own denial_actions" 
  ON denial_actions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- denial_notes policies
CREATE POLICY "Users can view own denial_notes" 
  ON denial_notes FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own denial_notes" 
  ON denial_notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own denial_notes" 
  ON denial_notes FOR UPDATE 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own denial_notes" 
  ON denial_notes FOR DELETE 
  USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER set_denial_classifications_updated_at 
  BEFORE UPDATE ON denial_classifications 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_denial_queue_updated_at 
  BEFORE UPDATE ON denial_queue 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_appeal_templates_updated_at 
  BEFORE UPDATE ON appeal_templates 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_appeals_updated_at 
  BEFORE UPDATE ON appeals 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();