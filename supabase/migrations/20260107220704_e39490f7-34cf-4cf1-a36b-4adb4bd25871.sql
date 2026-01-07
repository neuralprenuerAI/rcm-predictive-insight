-- =====================================================
-- DENIAL CLASSIFICATIONS - SEED DATA
-- Common denial reason codes with categories and guidance
-- =====================================================

-- MEDICAL NECESSITY DENIALS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-50', 'Not deemed a medical necessity by the payer', 'medical_necessity', 'clinical_justification', 
  ARRAY['Diagnosis does not support procedure', 'Missing clinical documentation', 'Service frequency exceeded', 'Experimental/investigational'],
  'Submit appeal with clinical documentation supporting medical necessity',
  true, 45.00, 'appeal_with_documentation',
  ARRAY['Clinical notes', 'Lab results', 'Prior treatment history', 'Peer-reviewed literature'],
  60),
  
('CO-56', 'Service not medically necessary based on diagnosis', 'medical_necessity', 'diagnosis_mismatch',
  ARRAY['Wrong ICD code', 'Non-specific diagnosis', 'Missing secondary diagnosis'],
  'Review and correct diagnosis codes, resubmit or appeal',
  true, 55.00, 'correct_and_resubmit',
  ARRAY['Updated clinical notes', 'Corrected diagnosis'],
  60),

('CO-167', 'Diagnosis is not consistent with the procedure', 'medical_necessity', 'diagnosis_mismatch',
  ARRAY['ICD does not support CPT', 'Medical necessity not established'],
  'Appeal with documentation showing clinical necessity',
  true, 50.00, 'appeal_with_documentation',
  ARRAY['Clinical notes', 'Medical records', 'Physician statement'],
  60);

-- CODING ERROR DENIALS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-4', 'The procedure code is inconsistent with the modifier used', 'coding_error', 'modifier',
  ARRAY['Wrong modifier', 'Missing modifier', 'Modifier not applicable to code'],
  'Correct modifier and resubmit claim',
  true, 70.00, 'correct_and_resubmit',
  ARRAY['Corrected claim form'],
  90),

('CO-11', 'Diagnosis is inconsistent with procedure', 'coding_error', 'diagnosis_mismatch',
  ARRAY['ICD does not support CPT', 'Wrong diagnosis code', 'Non-covered diagnosis'],
  'Review diagnosis codes, correct and resubmit',
  true, 65.00, 'correct_and_resubmit',
  ARRAY['Clinical notes', 'Corrected claim'],
  90),

('CO-16', 'Claim lacks information needed for adjudication', 'coding_error', 'missing_info',
  ARRAY['Missing patient info', 'Missing provider info', 'Incomplete claim form'],
  'Add missing information and resubmit',
  true, 80.00, 'correct_and_resubmit',
  ARRAY['Complete claim form with all required fields'],
  90),

('CO-97', 'Payment adjusted based on Multiple Procedure rules', 'coding_error', 'bundling',
  ARRAY['Codes should be bundled', 'NCCI edit violation', 'Modifier 59 may be needed'],
  'Review bundling rules, add modifier if appropriate or accept reduction',
  true, 40.00, 'review_and_correct',
  ARRAY['Operative report', 'Documentation of distinct procedures'],
  90),

('CO-151', 'Payment adjusted based on NCCI edits', 'bundling', 'ncci',
  ARRAY['Column 1/Column 2 edit', 'Mutually exclusive codes', 'Incorrect modifier'],
  'Review NCCI edits, separate claims or add appropriate modifier',
  true, 45.00, 'review_ncci_edits',
  ARRAY['Operative report', 'Documentation of separate procedures'],
  90);

-- AUTHORIZATION DENIALS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-15', 'Authorization was not obtained', 'authorization', 'no_auth',
  ARRAY['Prior auth not obtained', 'Auth expired', 'Wrong auth number', 'Service not covered by auth'],
  'Obtain retroactive authorization or appeal',
  true, 35.00, 'request_retro_auth',
  ARRAY['Clinical notes', 'Auth request form', 'Medical necessity documentation'],
  30),

('CO-197', 'Precertification/authorization absent', 'authorization', 'no_auth',
  ARRAY['Prior auth required but not obtained', 'Emergency exception may apply'],
  'Request retroactive authorization citing emergency or appeal',
  true, 40.00, 'request_retro_auth',
  ARRAY['Emergency documentation', 'Clinical notes'],
  30),

('CO-198', 'Precertification/authorization exceeded', 'authorization', 'exceeded',
  ARRAY['More units than authorized', 'Additional days beyond auth'],
  'Request extension of authorization',
  true, 50.00, 'request_auth_extension',
  ARRAY['Clinical notes showing medical necessity', 'Authorization extension request'],
  30);

-- ELIGIBILITY DENIALS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-27', 'Expenses incurred after coverage terminated', 'eligibility', 'coverage_ended',
  ARRAY['Patient coverage ended', 'Wrong insurance information', 'COBRA not activated'],
  'Verify eligibility, bill correct payer or patient',
  false, 10.00, 'verify_eligibility',
  ARRAY['Eligibility verification'],
  90),

('CO-29', 'Time limit for filing has expired', 'timely_filing', 'deadline_missed',
  ARRAY['Claim filed after deadline', 'Wrong payer caused delay'],
  'Appeal if delay was caused by payer or system issues',
  true, 25.00, 'appeal_timely_filing',
  ARRAY['Proof of timely submission', 'System logs', 'Payer correspondence'],
  30),

('CO-31', 'Patient cannot be identified as our insured', 'eligibility', 'not_found',
  ARRAY['Wrong member ID', 'Patient not in system', 'Name mismatch'],
  'Verify patient information and resubmit',
  true, 75.00, 'verify_and_resubmit',
  ARRAY['Insurance card copy', 'Patient demographics'],
  90),

('CO-45', 'Charges exceed fee schedule/maximum allowable', 'contract', 'fee_schedule',
  ARRAY['Billed above contracted rate', 'Fee schedule reduction'],
  'Accept payment or review contract',
  false, 5.00, 'accept_or_review_contract',
  ARRAY[]::TEXT[],
  90);

-- DUPLICATE DENIALS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-18', 'Duplicate claim/service', 'duplicate', 'duplicate_claim',
  ARRAY['Same claim submitted twice', 'Similar service dates', 'Same patient/provider/code'],
  'Verify if truly duplicate, void if needed, appeal if distinct services',
  true, 60.00, 'verify_duplicate',
  ARRAY['Documentation showing distinct services'],
  90),

('CO-96', 'Non-covered charges', 'other', 'non_covered',
  ARRAY['Service not covered by plan', 'Exclusion applies', 'Cosmetic/elective'],
  'Bill patient or appeal if clinically necessary',
  true, 20.00, 'bill_patient_or_appeal',
  ARRAY['Medical necessity documentation', 'Clinical notes'],
  60);

-- COORDINATION OF BENEFITS
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-22', 'Coordination of benefits (COB) - another payer is primary', 'coordination_of_benefits', 'wrong_payer_order',
  ARRAY['Secondary payer billed as primary', 'COB not updated', 'Patient has other coverage'],
  'Bill primary payer first, then submit to secondary with EOB',
  true, 70.00, 'bill_correct_order',
  ARRAY['Primary payer EOB', 'COB information'],
  90),

('CO-23', 'Payment adjusted due to COB provisions', 'coordination_of_benefits', 'cob_adjustment',
  ARRAY['Secondary payer applied COB rules', 'Primary payment exceeded allowed'],
  'Review COB calculation, may be correct',
  false, 15.00, 'review_cob',
  ARRAY['Primary EOB', 'Secondary EOB'],
  90);

-- PROVIDER ENROLLMENT
INSERT INTO denial_classifications (reason_code, reason_description, category, subcategory, common_causes, typical_resolution, appealable, appeal_success_rate, recommended_action, required_documentation, typical_appeal_deadline_days) VALUES
('CO-149', 'Provider not credentialed for this payer', 'provider_enrollment', 'not_credentialed',
  ARRAY['Provider not enrolled', 'Credentialing pending', 'Wrong tax ID'],
  'Complete credentialing, request retro enrollment',
  true, 55.00, 'complete_enrollment',
  ARRAY['Credentialing application', 'Provider credentials'],
  90),

('PR-1', 'Deductible amount', 'other', 'deductible',
  ARRAY['Patient has unmet deductible'],
  'Bill patient for deductible amount',
  false, 0.00, 'bill_patient',
  ARRAY[]::TEXT[],
  90),

('PR-2', 'Coinsurance amount', 'other', 'coinsurance',
  ARRAY['Patient responsible for coinsurance'],
  'Bill patient for coinsurance amount',
  false, 0.00, 'bill_patient',
  ARRAY[]::TEXT[],
  90),

('PR-3', 'Copay amount', 'other', 'copay',
  ARRAY['Patient responsible for copay'],
  'Collect copay from patient',
  false, 0.00, 'collect_copay',
  ARRAY[]::TEXT[],
  90);

-- =====================================================
-- APPEAL TEMPLATES - SEED DATA
-- Pre-built appeal letter templates by denial type
-- =====================================================

-- Medical Necessity Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Medical Necessity Appeal - Standard', 
 'General appeal template for medical necessity denials',
 'medical_necessity',
 ARRAY['CO-50', 'CO-56', 'CO-167'],
 'Appeal for Medical Necessity - Patient: {{patient_name}} - DOS: {{dos}} - Claim: {{claim_number}}',
 'Dear Appeals Department,

We are writing to formally appeal the denial of claim {{claim_number}} for patient {{patient_name}} (Member ID: {{member_id}}) for date of service {{dos}}.

**Denial Information:**
- Procedure Code: {{cpt_code}}
- Diagnosis: {{icd_codes}}
- Billed Amount: ${{billed_amount}}
- Denial Reason: {{denial_reason}}

**Clinical Justification:**
The services rendered were medically necessary for the following reasons:

{{clinical_justification}}

**Supporting Documentation:**
Please find enclosed:
1. Complete medical records for the date of service
2. Clinical notes documenting the medical necessity
3. Relevant lab results and diagnostic studies
4. Peer-reviewed literature supporting the treatment approach

Based on the enclosed documentation, we respectfully request that you overturn this denial and process the claim for payment.

If you require additional information, please contact our office at your earliest convenience.

Sincerely,

{{provider_name}}
{{practice_name}}
NPI: {{provider_npi}}
Phone: {{practice_phone}}',
 ARRAY['Clinical notes', 'Medical records', 'Lab results'],
 45.00, true, true);

-- Coding Error Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Coding Correction Appeal',
 'Template for appeals related to coding errors',
 'coding_error',
 ARRAY['CO-4', 'CO-11', 'CO-16'],
 'Corrected Claim Appeal - Patient: {{patient_name}} - DOS: {{dos}} - Claim: {{claim_number}}',
 'Dear Claims Department,

We are submitting this appeal for claim {{claim_number}} for patient {{patient_name}} (Member ID: {{member_id}}) for date of service {{dos}}.

**Original Denial:**
- Denial Reason: {{denial_reason}}
- Procedure Code: {{cpt_code}}
- Original Diagnosis: {{icd_codes}}

**Correction Made:**
{{clinical_justification}}

We have reviewed the claim and corrected the identified issue. Please find the corrected claim information enclosed.

Please process this corrected claim for payment consideration.

Sincerely,

{{provider_name}}
{{practice_name}}',
 ARRAY['Corrected claim form', 'Supporting documentation'],
 70.00, false, true);

-- Authorization Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Retroactive Authorization Request',
 'Template for requesting retroactive authorization',
 'authorization',
 ARRAY['CO-15', 'CO-197', 'CO-198'],
 'Retroactive Authorization Request - Patient: {{patient_name}} - DOS: {{dos}}',
 'Dear Utilization Management Department,

We are requesting retroactive authorization for services rendered to {{patient_name}} (Member ID: {{member_id}}) on {{dos}}.

**Service Information:**
- Procedure Code: {{cpt_code}}
- Diagnosis: {{icd_codes}}
- Billed Amount: ${{billed_amount}}

**Reason for Retroactive Request:**
{{clinical_justification}}

**Medical Necessity:**
The services were medically necessary and could not be delayed due to:
- Patient presented with acute symptoms requiring immediate intervention
- Delay in treatment would have resulted in adverse outcomes
- Service was rendered in good faith based on clinical presentation

Please review the enclosed documentation and grant retroactive authorization for these medically necessary services.

Sincerely,

{{provider_name}}
{{practice_name}}',
 ARRAY['Clinical notes', 'Emergency documentation', 'Medical necessity letter'],
 40.00, false, true);

-- Timely Filing Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Timely Filing Exception Request',
 'Template for appealing timely filing denials',
 'timely_filing',
 ARRAY['CO-29'],
 'Timely Filing Exception Request - Patient: {{patient_name}} - DOS: {{dos}} - Claim: {{claim_number}}',
 'Dear Appeals Department,

We are requesting an exception to the timely filing deadline for claim {{claim_number}} for patient {{patient_name}} for date of service {{dos}}.

**Claim Information:**
- Procedure Code: {{cpt_code}}
- Billed Amount: ${{billed_amount}}
- Original Submission Date: [INSERT DATE]

**Reason for Late Submission:**
{{clinical_justification}}

The delay in filing was due to circumstances beyond our control. We respectfully request that you grant an exception and process this claim for payment.

Enclosed please find documentation supporting our timely filing exception request.

Sincerely,

{{provider_name}}
{{practice_name}}',
 ARRAY['Proof of original submission', 'Correspondence history', 'System documentation'],
 25.00, false, true);

-- Bundling/NCCI Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Distinct Procedure Appeal (NCCI/Bundling)',
 'Template for appealing bundling/NCCI denials',
 'bundling',
 ARRAY['CO-97', 'CO-151'],
 'Appeal for Distinct Procedures - Patient: {{patient_name}} - DOS: {{dos}} - Claim: {{claim_number}}',
 'Dear Appeals Department,

We are appealing the bundling edit applied to claim {{claim_number}} for patient {{patient_name}} for date of service {{dos}}.

**Denied Service:**
- Procedure Code: {{cpt_code}}
- Billed Amount: ${{billed_amount}}
- Denial Reason: {{denial_reason}}

**Clinical Documentation Supporting Distinct Procedures:**
{{clinical_justification}}

The procedures were performed as distinct services and are appropriately billed separately based on:
1. Different anatomical sites
2. Separate surgical sessions
3. Distinct clinical indications

Please review the enclosed operative report and documentation supporting the distinct nature of these procedures.

Sincerely,

{{provider_name}}
{{practice_name}}',
 ARRAY['Operative report', 'Procedure notes', 'Diagram if applicable'],
 45.00, false, true);

-- COB Appeal Template
INSERT INTO appeal_templates (name, description, denial_category, reason_codes, subject_template, body_template, required_attachments, success_rate, is_default, active) VALUES
('Coordination of Benefits Correction',
 'Template for COB-related denials',
 'coordination_of_benefits',
 ARRAY['CO-22', 'CO-23'],
 'COB Correction - Patient: {{patient_name}} - DOS: {{dos}} - Claim: {{claim_number}}',
 'Dear Claims Department,

We are resubmitting claim {{claim_number}} for patient {{patient_name}} for date of service {{dos}} with correct coordination of benefits information.

**Claim Information:**
- Procedure Code: {{cpt_code}}
- Billed Amount: ${{billed_amount}}

**COB Information:**
{{clinical_justification}}

Enclosed please find the primary payer''s Explanation of Benefits (EOB) showing their payment determination.

Please process this claim according to secondary payer guidelines.

Sincerely,

{{provider_name}}
{{practice_name}}',
 ARRAY['Primary payer EOB', 'Updated COB information'],
 70.00, false, true);