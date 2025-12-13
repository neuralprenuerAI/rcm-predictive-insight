-- ============================================
-- CORE AI ENGINE DATABASE SCHEMA
-- Foundation for document processing, EDI parsing, and rules engine
-- ============================================

-- ============================================
-- 1. DOCUMENTS TABLE
-- Central table for all uploaded documents
-- ============================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  
  -- File info
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'edi', 'csv', 'xlsx', 'xls', 'txt')),
  
  -- Classification
  document_type TEXT,
  classification_confidence TEXT CHECK (classification_confidence IN ('high', 'medium', 'low')),
  classification_indicators TEXT[],
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'ocr_processing', 'classifying', 'extracting', 'completed', 'failed')),
  
  -- Extracted content
  extracted_text TEXT,
  extracted_data JSONB DEFAULT '{}',
  
  -- OCR specific
  ocr_required BOOLEAN DEFAULT false,
  ocr_confidence DECIMAL(5,4),
  ocr_provider TEXT,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Performance tracking
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_duration_ms INTEGER,
  
  -- Metadata
  source TEXT,
  tags TEXT[],
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for documents
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_document_type ON public.documents(document_type);
CREATE INDEX idx_documents_file_type ON public.documents(file_type);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

-- Enable RLS for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at (uses existing function)
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 2. EDI FILES TABLE
-- Tracks all EDI file uploads (835, 837)
-- ============================================

CREATE TABLE IF NOT EXISTS public.edi_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  
  -- EDI Type
  file_type TEXT NOT NULL CHECK (file_type IN ('835', '837P', '837I', '837D')),
  
  -- ISA Segment Data
  interchange_control_number TEXT,
  interchange_date DATE,
  interchange_time TIME,
  sender_id TEXT,
  sender_qualifier TEXT,
  receiver_id TEXT,
  receiver_qualifier TEXT,
  
  -- GS Segment Data
  functional_group_control_number TEXT,
  application_sender_code TEXT,
  application_receiver_code TEXT,
  
  -- ST Segment Data
  transaction_set_control_number TEXT,
  implementation_reference TEXT,
  
  -- Processing info
  version_code TEXT,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'parsing', 'parsed', 'failed')),
  parsed_data JSONB,
  raw_content TEXT,
  
  -- Error handling
  error_message TEXT,
  validation_errors JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for edi_files
CREATE INDEX idx_edi_files_user_id ON public.edi_files(user_id);
CREATE INDEX idx_edi_files_file_type ON public.edi_files(file_type);
CREATE INDEX idx_edi_files_status ON public.edi_files(status);

-- RLS for edi_files
ALTER TABLE public.edi_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own edi_files"
  ON public.edi_files FOR ALL
  USING (auth.uid() = user_id);


-- ============================================
-- 3. REMITTANCES TABLE (835 Header)
-- Payment information from 835 files
-- ============================================

CREATE TABLE IF NOT EXISTS public.remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  edi_file_id UUID REFERENCES public.edi_files(id) ON DELETE CASCADE,
  
  -- BPR Segment - Financial Information
  transaction_handling_code TEXT,
  payment_amount DECIMAL(12,2),
  credit_debit_flag TEXT,
  payment_method TEXT,
  payment_format TEXT,
  
  -- Check/EFT details
  check_number TEXT,
  check_date DATE,
  eft_trace_number TEXT,
  sender_dfi_number TEXT,
  sender_account_number TEXT,
  receiver_dfi_number TEXT,
  receiver_account_number TEXT,
  
  -- TRN Segment
  trace_type TEXT,
  trace_number TEXT,
  originating_company_id TEXT,
  
  -- Payer Information
  payer_name TEXT,
  payer_id TEXT,
  payer_id_qualifier TEXT,
  payer_address_line1 TEXT,
  payer_address_line2 TEXT,
  payer_city TEXT,
  payer_state TEXT,
  payer_zip TEXT,
  payer_contact_name TEXT,
  payer_contact_phone TEXT,
  
  -- Payee Information
  payee_name TEXT,
  payee_npi TEXT,
  payee_tax_id TEXT,
  payee_id_qualifier TEXT,
  payee_address_line1 TEXT,
  payee_address_line2 TEXT,
  payee_city TEXT,
  payee_state TEXT,
  payee_zip TEXT,
  
  -- Summary
  total_claims INTEGER DEFAULT 0,
  total_paid DECIMAL(12,2),
  total_charged DECIMAL(12,2),
  total_adjustments DECIMAL(12,2),
  total_patient_responsibility DECIMAL(12,2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for remittances
CREATE INDEX idx_remittances_user_id ON public.remittances(user_id);
CREATE INDEX idx_remittances_check_number ON public.remittances(check_number);
CREATE INDEX idx_remittances_check_date ON public.remittances(check_date);
CREATE INDEX idx_remittances_edi_file_id ON public.remittances(edi_file_id);

-- RLS for remittances
ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own remittances"
  ON public.remittances FOR ALL
  USING (auth.uid() = user_id);


-- ============================================
-- 4. REMITTANCE CLAIMS TABLE (835 CLP Loop)
-- Individual claim payment details
-- ============================================

CREATE TABLE IF NOT EXISTS public.remittance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES public.remittances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  
  -- Link to internal claim if matched
  internal_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  
  -- CLP Segment
  claim_submitter_id TEXT NOT NULL,
  claim_status_code TEXT,
  claim_status_description TEXT,
  total_charge DECIMAL(10,2),
  total_paid DECIMAL(10,2),
  patient_responsibility DECIMAL(10,2),
  claim_filing_indicator TEXT,
  payer_claim_control_number TEXT,
  facility_type_code TEXT,
  claim_frequency_code TEXT,
  
  -- Patient Information
  patient_name_last TEXT,
  patient_name_first TEXT,
  patient_name_middle TEXT,
  patient_id TEXT,
  patient_id_qualifier TEXT,
  
  -- Subscriber Information
  subscriber_name_last TEXT,
  subscriber_name_first TEXT,
  subscriber_id TEXT,
  
  -- Rendering Provider
  rendering_provider_name TEXT,
  rendering_provider_npi TEXT,
  
  -- Service Dates
  service_date_start DATE,
  service_date_end DATE,
  coverage_expiration_date DATE,
  received_date DATE,
  
  -- Other amounts
  coverage_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  interest_amount DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for remittance_claims
CREATE INDEX idx_remittance_claims_remittance_id ON public.remittance_claims(remittance_id);
CREATE INDEX idx_remittance_claims_user_id ON public.remittance_claims(user_id);
CREATE INDEX idx_remittance_claims_claim_submitter_id ON public.remittance_claims(claim_submitter_id);
CREATE INDEX idx_remittance_claims_internal_claim_id ON public.remittance_claims(internal_claim_id);

-- RLS for remittance_claims
ALTER TABLE public.remittance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own remittance_claims"
  ON public.remittance_claims FOR ALL
  USING (auth.uid() = user_id);


-- ============================================
-- 5. REMITTANCE SERVICE LINES TABLE (835 SVC Loop)
-- Line-level payment details
-- ============================================

CREATE TABLE IF NOT EXISTS public.remittance_service_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_claim_id UUID NOT NULL REFERENCES public.remittance_claims(id) ON DELETE CASCADE,
  
  -- SVC Segment
  line_number INTEGER,
  procedure_code_qualifier TEXT,
  procedure_code TEXT,
  procedure_modifiers TEXT[],
  original_procedure_code TEXT,
  revenue_code TEXT,
  
  -- Amounts
  charge_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  
  -- Units
  units_billed DECIMAL(8,2),
  units_paid DECIMAL(8,2),
  
  -- Dates
  service_date_start DATE,
  service_date_end DATE,
  
  -- Reference numbers
  line_item_control_number TEXT,
  rendering_provider_id TEXT,
  healthcare_policy_id TEXT,
  
  -- Remarks
  remark_codes TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for remittance_service_lines
CREATE INDEX idx_remittance_service_lines_claim_id ON public.remittance_service_lines(remittance_claim_id);
CREATE INDEX idx_remittance_service_lines_procedure_code ON public.remittance_service_lines(procedure_code);

-- RLS for remittance_service_lines
ALTER TABLE public.remittance_service_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remittance_service_lines"
  ON public.remittance_service_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.remittance_claims rc 
    WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own remittance_service_lines"
  ON public.remittance_service_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.remittance_claims rc 
    WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own remittance_service_lines"
  ON public.remittance_service_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.remittance_claims rc 
    WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own remittance_service_lines"
  ON public.remittance_service_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.remittance_claims rc 
    WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid()
  ));


-- ============================================
-- 6. CLAIM ADJUSTMENTS TABLE (835 CAS Segments)
-- Adjustment details at claim or line level
-- ============================================

CREATE TABLE IF NOT EXISTS public.claim_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Can be at claim level or service line level
  remittance_claim_id UUID REFERENCES public.remittance_claims(id) ON DELETE CASCADE,
  service_line_id UUID REFERENCES public.remittance_service_lines(id) ON DELETE CASCADE,
  
  -- CAS Segment
  adjustment_group_code TEXT NOT NULL,
  adjustment_group_description TEXT,
  
  -- Reason/amount pairs (up to 6 per CAS)
  reason_code_1 TEXT,
  amount_1 DECIMAL(10,2),
  quantity_1 DECIMAL(8,2),
  
  reason_code_2 TEXT,
  amount_2 DECIMAL(10,2),
  quantity_2 DECIMAL(8,2),
  
  reason_code_3 TEXT,
  amount_3 DECIMAL(10,2),
  quantity_3 DECIMAL(8,2),
  
  reason_code_4 TEXT,
  amount_4 DECIMAL(10,2),
  quantity_4 DECIMAL(8,2),
  
  reason_code_5 TEXT,
  amount_5 DECIMAL(10,2),
  quantity_5 DECIMAL(8,2),
  
  reason_code_6 TEXT,
  amount_6 DECIMAL(10,2),
  quantity_6 DECIMAL(8,2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- At least one FK must be set
  CONSTRAINT chk_adjustment_parent CHECK (
    remittance_claim_id IS NOT NULL OR service_line_id IS NOT NULL
  )
);

-- Indexes for claim_adjustments
CREATE INDEX idx_claim_adjustments_claim_id ON public.claim_adjustments(remittance_claim_id);
CREATE INDEX idx_claim_adjustments_service_line_id ON public.claim_adjustments(service_line_id);
CREATE INDEX idx_claim_adjustments_reason_code ON public.claim_adjustments(reason_code_1);

-- RLS for claim_adjustments
ALTER TABLE public.claim_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claim_adjustments"
  ON public.claim_adjustments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.remittance_claims rc WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.remittance_service_lines sl 
      JOIN public.remittance_claims rc ON rc.id = sl.remittance_claim_id 
      WHERE sl.id = service_line_id AND rc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own claim_adjustments"
  ON public.claim_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.remittance_claims rc WHERE rc.id = remittance_claim_id AND rc.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.remittance_service_lines sl 
      JOIN public.remittance_claims rc ON rc.id = sl.remittance_claim_id 
      WHERE sl.id = service_line_id AND rc.user_id = auth.uid()
    )
  );


-- ============================================
-- 7. EDI CLAIMS TABLE (837 Parsed Data)
-- Outbound claims from 837 files
-- ============================================

CREATE TABLE IF NOT EXISTS public.edi_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  edi_file_id UUID REFERENCES public.edi_files(id) ON DELETE CASCADE,
  
  -- Link to internal claim if created
  internal_claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  
  -- Claim Information (CLM segment)
  claim_submitter_id TEXT,
  total_charge DECIMAL(10,2),
  place_of_service TEXT,
  claim_frequency_code TEXT,
  provider_signature BOOLEAN,
  provider_accept_assignment TEXT,
  benefits_assignment TEXT,
  release_of_info TEXT,
  patient_signature_source TEXT,
  
  -- Billing Provider
  billing_provider_npi TEXT,
  billing_provider_name TEXT,
  billing_provider_tax_id TEXT,
  billing_provider_taxonomy TEXT,
  billing_provider_address_line1 TEXT,
  billing_provider_address_line2 TEXT,
  billing_provider_city TEXT,
  billing_provider_state TEXT,
  billing_provider_zip TEXT,
  
  -- Pay-to Provider (if different)
  pay_to_provider_name TEXT,
  pay_to_provider_npi TEXT,
  pay_to_provider_address_line1 TEXT,
  pay_to_provider_city TEXT,
  pay_to_provider_state TEXT,
  pay_to_provider_zip TEXT,
  
  -- Subscriber
  subscriber_id TEXT,
  subscriber_name_last TEXT,
  subscriber_name_first TEXT,
  subscriber_name_middle TEXT,
  subscriber_dob DATE,
  subscriber_gender TEXT,
  subscriber_address_line1 TEXT,
  subscriber_city TEXT,
  subscriber_state TEXT,
  subscriber_zip TEXT,
  
  -- Patient (if different from subscriber)
  patient_name_last TEXT,
  patient_name_first TEXT,
  patient_name_middle TEXT,
  patient_dob DATE,
  patient_gender TEXT,
  patient_relationship TEXT,
  patient_address_line1 TEXT,
  patient_city TEXT,
  patient_state TEXT,
  patient_zip TEXT,
  
  -- Payer
  payer_name TEXT,
  payer_id TEXT,
  payer_address_line1 TEXT,
  payer_city TEXT,
  payer_state TEXT,
  payer_zip TEXT,
  
  -- Referring Provider
  referring_provider_npi TEXT,
  referring_provider_name TEXT,
  
  -- Rendering Provider (if different from billing)
  rendering_provider_npi TEXT,
  rendering_provider_name TEXT,
  
  -- Service Facility
  service_facility_name TEXT,
  service_facility_npi TEXT,
  service_facility_address TEXT,
  
  -- Diagnosis Codes
  diagnosis_code_qualifier TEXT,
  principal_diagnosis TEXT,
  diagnosis_codes TEXT[],
  
  -- Dates
  admission_date DATE,
  discharge_date DATE,
  service_date_start DATE,
  service_date_end DATE,
  
  -- Service Lines (stored as JSONB)
  service_lines JSONB DEFAULT '[]',
  
  -- Prior Authorization
  prior_auth_number TEXT,
  
  -- Accident Info
  accident_date DATE,
  accident_state TEXT,
  accident_type TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for edi_claims
CREATE INDEX idx_edi_claims_user_id ON public.edi_claims(user_id);
CREATE INDEX idx_edi_claims_edi_file_id ON public.edi_claims(edi_file_id);
CREATE INDEX idx_edi_claims_internal_claim_id ON public.edi_claims(internal_claim_id);
CREATE INDEX idx_edi_claims_subscriber_id ON public.edi_claims(subscriber_id);

-- RLS for edi_claims
ALTER TABLE public.edi_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own edi_claims"
  ON public.edi_claims FOR ALL
  USING (auth.uid() = user_id);


-- ============================================
-- 8. RULES TABLE
-- Business rules definitions
-- ============================================

CREATE TABLE IF NOT EXISTS public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  
  -- Rule identification
  rule_name TEXT NOT NULL,
  rule_code TEXT UNIQUE,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'scrub',
    'denial_prevention',
    'coding',
    'payment_validation',
    'compliance',
    'custom'
  )),
  category TEXT,
  description TEXT,
  
  -- Rule logic (JSONB)
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  
  -- Rule behavior
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  stop_on_match BOOLEAN DEFAULT false,
  
  -- Triggers
  trigger_event TEXT CHECK (trigger_event IN (
    'claim_created',
    'claim_updated', 
    'claim_before_submit',
    'payment_received',
    'denial_received',
    'document_processed',
    'manual',
    'scheduled'
  )),
  applies_to TEXT[] DEFAULT ARRAY['claims'],
  
  -- Filtering
  payer_ids TEXT[],
  provider_npis TEXT[],
  place_of_service TEXT[],
  
  -- Metadata
  tags TEXT[],
  effective_date DATE,
  expiration_date DATE,
  version INTEGER DEFAULT 1,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users,
  last_modified_by UUID REFERENCES auth.users
);

-- Indexes for rules
CREATE INDEX idx_rules_user_id ON public.rules(user_id);
CREATE INDEX idx_rules_rule_type ON public.rules(rule_type);
CREATE INDEX idx_rules_is_active ON public.rules(is_active);
CREATE INDEX idx_rules_trigger_event ON public.rules(trigger_event);
CREATE INDEX idx_rules_priority ON public.rules(priority);

-- RLS for rules
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view system rules and own rules"
  ON public.rules FOR SELECT
  USING (is_system = true OR user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can create own rules"
  ON public.rules FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own rules"
  ON public.rules FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own rules"
  ON public.rules FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- Trigger for updated_at
CREATE TRIGGER set_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- 9. RULE EXECUTIONS TABLE
-- Tracks rule execution history
-- ============================================

CREATE TABLE IF NOT EXISTS public.rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  
  -- What triggered this
  rule_id UUID NOT NULL REFERENCES public.rules(id) ON DELETE CASCADE,
  trigger_event TEXT,
  batch_id UUID,
  
  -- What was evaluated
  target_type TEXT NOT NULL,
  target_id UUID,
  input_data JSONB,
  
  -- Results
  conditions_evaluated JSONB,
  execution_result TEXT CHECK (execution_result IN ('pass', 'fail', 'warning', 'error', 'skipped')),
  result_message TEXT,
  actions_executed JSONB,
  
  -- Performance
  execution_duration_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  error_stack TEXT,
  
  -- Timestamps
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for rule_executions
CREATE INDEX idx_rule_executions_rule_id ON public.rule_executions(rule_id);
CREATE INDEX idx_rule_executions_user_id ON public.rule_executions(user_id);
CREATE INDEX idx_rule_executions_target ON public.rule_executions(target_type, target_id);
CREATE INDEX idx_rule_executions_executed_at ON public.rule_executions(executed_at DESC);
CREATE INDEX idx_rule_executions_batch_id ON public.rule_executions(batch_id);

-- RLS for rule_executions
ALTER TABLE public.rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rule_executions"
  ON public.rule_executions FOR ALL
  USING (auth.uid() = user_id);


-- ============================================
-- 10. RULE ACTION LOGS TABLE
-- Detailed action tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.rule_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.rule_executions(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL,
  action_params JSONB,
  
  -- Results
  action_result TEXT,
  result_data JSONB,
  message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for rule_action_logs
CREATE INDEX idx_rule_action_logs_execution_id ON public.rule_action_logs(execution_id);

-- RLS for rule_action_logs
ALTER TABLE public.rule_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rule_action_logs"
  ON public.rule_action_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rule_executions re 
    WHERE re.id = execution_id AND re.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own rule_action_logs"
  ON public.rule_action_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rule_executions re 
    WHERE re.id = execution_id AND re.user_id = auth.uid()
  ));


-- ============================================
-- 11. ADJUSTMENT REASON CODES TABLE
-- Reference table for CARC/RARC codes
-- ============================================

CREATE TABLE IF NOT EXISTS public.adjustment_reason_codes (
  code TEXT PRIMARY KEY,
  code_type TEXT DEFAULT 'CARC' CHECK (code_type IN ('CARC', 'RARC', 'GROUP')),
  description TEXT NOT NULL,
  category TEXT,
  full_description TEXT,
  notes TEXT,
  effective_date DATE,
  termination_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for adjustment_reason_codes
CREATE INDEX idx_adjustment_codes_category ON public.adjustment_reason_codes(category);
CREATE INDEX idx_adjustment_codes_type ON public.adjustment_reason_codes(code_type);

-- RLS for adjustment_reason_codes (read-only for everyone)
ALTER TABLE public.adjustment_reason_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read adjustment codes" 
  ON public.adjustment_reason_codes FOR SELECT 
  USING (true);


-- ============================================
-- 12. SEED DATA: ADJUSTMENT GROUP CODES
-- ============================================

INSERT INTO public.adjustment_reason_codes (code, code_type, description, category) VALUES
('CO', 'GROUP', 'Contractual Obligations', 'contractual'),
('CR', 'GROUP', 'Corrections and Reversals', 'correction'),
('OA', 'GROUP', 'Other Adjustments', 'other'),
('PI', 'GROUP', 'Payer Initiated Reductions', 'payer'),
('PR', 'GROUP', 'Patient Responsibility', 'patient')
ON CONFLICT (code) DO NOTHING;


-- ============================================
-- 13. SEED DATA: COMMON CARC CODES
-- ============================================

INSERT INTO public.adjustment_reason_codes (code, code_type, description, category) VALUES
('1', 'CARC', 'Deductible Amount', 'patient_responsibility'),
('2', 'CARC', 'Coinsurance Amount', 'patient_responsibility'),
('3', 'CARC', 'Co-payment Amount', 'patient_responsibility'),
('4', 'CARC', 'The procedure code is inconsistent with the modifier used', 'coding'),
('5', 'CARC', 'The procedure code/bill type is inconsistent with the place of service', 'coding'),
('6', 'CARC', 'The procedure/revenue code is inconsistent with the patient age', 'coding'),
('9', 'CARC', 'The diagnosis is inconsistent with the patient age', 'coding'),
('10', 'CARC', 'The diagnosis is inconsistent with the patient gender', 'coding'),
('11', 'CARC', 'The diagnosis is inconsistent with the procedure', 'coding'),
('15', 'CARC', 'The authorization number is missing, invalid, or does not apply', 'authorization'),
('16', 'CARC', 'Claim/service lacks information or has submission/billing error(s)', 'submission'),
('18', 'CARC', 'Exact duplicate claim/service', 'duplicate'),
('19', 'CARC', 'This is a work-related injury/illness - Workers Compensation liable', 'coverage'),
('20', 'CARC', 'This injury/illness is covered by the liability carrier', 'coverage'),
('22', 'CARC', 'This care may be covered by another payer per coordination of benefits', 'coordination'),
('23', 'CARC', 'The impact of prior payer(s) adjudication including payments/adjustments', 'coordination'),
('24', 'CARC', 'Charges are covered under a capitation agreement/managed care plan', 'contractual'),
('26', 'CARC', 'Expenses incurred prior to coverage', 'coverage'),
('27', 'CARC', 'Expenses incurred after coverage terminated', 'coverage'),
('29', 'CARC', 'The time limit for filing has expired', 'timely_filing'),
('31', 'CARC', 'Patient cannot be identified as our insured', 'eligibility'),
('32', 'CARC', 'Our records indicate this dependent is not eligible', 'eligibility'),
('33', 'CARC', 'Insured has no dependent coverage', 'eligibility'),
('35', 'CARC', 'Lifetime benefit maximum has been reached', 'benefit_limit'),
('39', 'CARC', 'Services denied at the time authorization/pre-certification was requested', 'authorization'),
('40', 'CARC', 'Charges do not meet qualifications for emergent/urgent care', 'medical_necessity'),
('45', 'CARC', 'Charge exceeds fee schedule/maximum allowable', 'contractual'),
('49', 'CARC', 'Non-covered routine/preventive exam or diagnostic/screening procedure', 'non_covered'),
('50', 'CARC', 'Non-covered services - not deemed medical necessity by payer', 'medical_necessity'),
('51', 'CARC', 'Non-covered services - pre-existing condition', 'pre_existing'),
('55', 'CARC', 'Procedure/treatment/drug deemed experimental/investigational', 'experimental'),
('56', 'CARC', 'Procedure/treatment has not been deemed proven effective', 'experimental'),
('58', 'CARC', 'Treatment deemed rendered in inappropriate place of service', 'place_of_service'),
('59', 'CARC', 'Processed based on multiple or concurrent procedure rules', 'bundling'),
('96', 'CARC', 'Non-covered charge(s) - Remark Code required', 'non_covered'),
('97', 'CARC', 'Benefit included in payment/allowance for another service already adjudicated', 'bundling'),
('109', 'CARC', 'Claim/service not covered by this payer - send to correct payer', 'coverage'),
('119', 'CARC', 'Benefit maximum for this time period or occurrence has been reached', 'benefit_limit'),
('125', 'CARC', 'Submission/billing error(s) - Remark Code required', 'submission'),
('129', 'CARC', 'Prior processing information appears incorrect', 'correction'),
('130', 'CARC', 'Claim submission fee', 'fee'),
('131', 'CARC', 'Claim specific negotiated discount', 'contractual'),
('136', 'CARC', 'Failure to follow prior payer coverage rules', 'coordination'),
('140', 'CARC', 'Patient/Insured health ID number and name do not match', 'eligibility'),
('146', 'CARC', 'Diagnosis was invalid for the date(s) of service reported', 'coding'),
('147', 'CARC', 'Provider contracted/negotiated rate expired or not on file', 'contractual'),
('150', 'CARC', 'Information submitted does not support this level of service', 'medical_necessity'),
('151', 'CARC', 'Information submitted does not support this many/frequency of services', 'medical_necessity'),
('167', 'CARC', 'This diagnosis is not covered', 'non_covered'),
('170', 'CARC', 'Payment denied when performed/billed by this type of provider', 'provider'),
('171', 'CARC', 'Payment denied when performed/billed by this provider in this facility', 'provider'),
('172', 'CARC', 'Payment adjusted when performed/billed by a provider of this specialty', 'provider'),
('177', 'CARC', 'Patient has not met the required eligibility requirements', 'eligibility'),
('181', 'CARC', 'Procedure code was invalid on the date of service', 'coding'),
('182', 'CARC', 'Procedure modifier was invalid on the date of service', 'coding'),
('183', 'CARC', 'The referring provider is not eligible to refer the service billed', 'provider'),
('185', 'CARC', 'The rendering provider is not eligible to perform the service billed', 'provider'),
('189', 'CARC', 'Not otherwise classified code billed when specific code exists', 'coding'),
('193', 'CARC', 'Original payment decision is being maintained', 'appeal'),
('197', 'CARC', 'Precertification/authorization/notification absent', 'authorization'),
('198', 'CARC', 'Precertification/authorization/notification exceeded', 'authorization'),
('199', 'CARC', 'Revenue code and Procedure code do not match', 'coding'),
('204', 'CARC', 'This service/equipment/drug is not covered under current benefit plan', 'non_covered'),
('226', 'CARC', 'Information requested from Billing/Rendering Provider was not provided', 'submission'),
('227', 'CARC', 'Information requested from patient/insured was not provided', 'submission'),
('233', 'CARC', 'Services related to hospital-acquired condition or preventable error', 'quality'),
('234', 'CARC', 'This procedure is not paid separately', 'bundling'),
('235', 'CARC', 'Sales Tax', 'tax'),
('236', 'CARC', 'Procedure/modifier combo not compatible per NCCI edits', 'bundling'),
('242', 'CARC', 'Services not provided by network/primary care providers', 'network'),
('243', 'CARC', 'Services not authorized by network/primary care providers', 'authorization'),
('252', 'CARC', 'Attachment/documentation required to adjudicate this claim', 'submission'),
('253', 'CARC', 'Sequestration - Reduction of federal payment', 'sequestration'),
('256', 'CARC', 'Service not payable per Managed Care contract', 'contractual'),
('272', 'CARC', 'Coverage/program guidelines were not met', 'coverage'),
('273', 'CARC', 'Coverage/program guidelines were exceeded', 'coverage'),
('276', 'CARC', 'Services denied by prior payer are not covered by this payer', 'coordination'),
('282', 'CARC', 'Claim Submitted to Incorrect Payer', 'submission'),
('283', 'CARC', 'Claim submitted outside of Network Service Area', 'network'),
('288', 'CARC', 'Claim denied/reduced - not payable per managed care contract', 'contractual')
ON CONFLICT (code) DO UPDATE SET 
  description = EXCLUDED.description,
  category = EXCLUDED.category;


-- ============================================
-- 14. SEED DATA: DEFAULT SYSTEM RULES
-- ============================================

INSERT INTO public.rules (
  rule_name, rule_code, rule_type, category, description,
  conditions, actions, priority, is_system, trigger_event, applies_to
) VALUES
(
  'Flag Claims Over 90 Days',
  'TIMELY_90_DAY',
  'scrub',
  'timely_filing',
  'Flag claims with date of service older than 90 days',
  '{"logic": "and", "rules": [{"field": "date_of_service", "operator": "older_than_days", "value": 90}]}',
  '[{"type": "flag", "params": {"severity": "warning", "message": "Claim DOS is over 90 days old", "code": "TIMELY_90"}}]',
  10, true, 'claim_created', ARRAY['claims']
),
(
  'Reject Claims Over 365 Days',
  'TIMELY_365_DAY',
  'scrub',
  'timely_filing',
  'Reject claims with date of service older than 365 days',
  '{"logic": "and", "rules": [{"field": "date_of_service", "operator": "older_than_days", "value": 365}]}',
  '[{"type": "reject", "params": {"reason": "Claim DOS exceeds 365 days"}}]',
  5, true, 'claim_before_submit', ARRAY['claims']
),
(
  'Missing Diagnosis Code',
  'MISSING_DX',
  'coding',
  'required_fields',
  'Reject claims without diagnosis codes',
  '{"logic": "and", "rules": [{"field": "diagnosis_code", "operator": "is_empty"}]}',
  '[{"type": "reject", "params": {"reason": "Missing diagnosis code"}}]',
  1, true, 'claim_before_submit', ARRAY['claims']
),
(
  'Missing Procedure Code',
  'MISSING_CPT',
  'coding',
  'required_fields',
  'Reject claims without procedure codes',
  '{"logic": "and", "rules": [{"field": "procedure_code", "operator": "is_empty"}]}',
  '[{"type": "reject", "params": {"reason": "Missing procedure code"}}]',
  1, true, 'claim_before_submit', ARRAY['claims']
),
(
  'High Value Claim Alert',
  'HIGH_VALUE_10K',
  'scrub',
  'review_required',
  'Flag claims over $10,000 for review',
  '{"logic": "and", "rules": [{"field": "billed_amount", "operator": "greater_than", "value": 10000}]}',
  '[{"type": "flag", "params": {"severity": "info", "message": "High value claim ($10K+)", "code": "HIGH_VALUE"}}]',
  50, true, 'claim_created', ARRAY['claims']
),
(
  'Missing Provider NPI',
  'MISSING_NPI',
  'compliance',
  'required_fields',
  'Flag claims without provider NPI',
  '{"logic": "and", "rules": [{"field": "provider_npi", "operator": "is_empty"}]}',
  '[{"type": "flag", "params": {"severity": "error", "message": "Missing provider NPI", "code": "MISSING_NPI"}}]',
  5, true, 'claim_before_submit', ARRAY['claims']
),
(
  'Zero Payment Alert',
  'ZERO_PAYMENT',
  'payment_validation',
  'payment_review',
  'Alert when zero payment is posted',
  '{"logic": "and", "rules": [{"field": "paid_amount", "operator": "equals", "value": 0}]}',
  '[{"type": "alert", "params": {"message": "Zero payment received", "code": "ZERO_PAY"}}]',
  30, true, 'payment_received', ARRAY['payments']
)
ON CONFLICT (rule_code) DO NOTHING;