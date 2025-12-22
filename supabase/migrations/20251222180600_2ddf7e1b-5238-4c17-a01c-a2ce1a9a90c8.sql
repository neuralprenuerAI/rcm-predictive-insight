-- =====================================================
-- EXPANDED MEDICAL NECESSITY MATRIX
-- +140 Additional CPT/ICD-10 Mappings
-- =====================================================

-- First, add unique constraint for upserts
ALTER TABLE public.medical_necessity_matrix 
ADD CONSTRAINT medical_necessity_cpt_icd_unique UNIQUE (cpt_code, icd_code);

-- =====================================================
-- CARDIOLOGY - EXPANDED
-- =====================================================

INSERT INTO public.medical_necessity_matrix (cpt_code, icd_code, necessity_score, notes) VALUES

-- Echocardiography (93303-93351) - More ICD codes
('93306', 'I50.1', 95, 'Left heart failure - strong indication for echo'),
('93306', 'I50.20', 95, 'Unspecified systolic heart failure'),
('93306', 'I50.21', 95, 'Acute systolic heart failure'),
('93306', 'I50.22', 95, 'Chronic systolic heart failure'),
('93306', 'I50.23', 95, 'Acute on chronic systolic heart failure'),
('93306', 'I50.30', 95, 'Unspecified diastolic heart failure'),
('93306', 'I50.31', 95, 'Acute diastolic heart failure'),
('93306', 'I50.32', 95, 'Chronic diastolic heart failure'),
('93306', 'I50.33', 95, 'Acute on chronic diastolic heart failure'),
('93306', 'I50.40', 95, 'Unspecified combined heart failure'),
('93306', 'I50.41', 95, 'Acute combined heart failure'),
('93306', 'I50.42', 95, 'Chronic combined heart failure'),
('93306', 'I50.43', 95, 'Acute on chronic combined heart failure'),
('93306', 'I42.0', 95, 'Dilated cardiomyopathy'),
('93306', 'I42.1', 90, 'Hypertrophic cardiomyopathy'),
('93306', 'I42.2', 90, 'Other hypertrophic cardiomyopathy'),
('93306', 'I42.5', 85, 'Other restrictive cardiomyopathy'),
('93306', 'I42.9', 80, 'Cardiomyopathy unspecified'),
('93306', 'I34.0', 95, 'Mitral valve insufficiency'),
('93306', 'I34.1', 95, 'Mitral valve prolapse'),
('93306', 'I34.2', 90, 'Mitral valve stenosis'),
('93306', 'I35.0', 95, 'Aortic valve stenosis'),
('93306', 'I35.1', 95, 'Aortic valve insufficiency'),
('93306', 'I35.2', 95, 'Aortic stenosis with insufficiency'),
('93306', 'I36.0', 90, 'Tricuspid stenosis'),
('93306', 'I36.1', 90, 'Tricuspid insufficiency'),
('93306', 'I37.0', 85, 'Pulmonary valve stenosis'),
('93306', 'I37.1', 85, 'Pulmonary valve insufficiency'),
('93306', 'Q21.0', 90, 'Ventricular septal defect'),
('93306', 'Q21.1', 90, 'Atrial septal defect'),
('93306', 'I27.0', 90, 'Primary pulmonary hypertension'),
('93306', 'I27.2', 90, 'Secondary pulmonary hypertension'),
('93306', 'R06.02', 75, 'Shortness of breath - moderate support'),
('93306', 'R00.0', 70, 'Tachycardia - lower support for echo'),

-- Stress Testing (93015, 93350, 93351)
('93015', 'I25.10', 95, 'CAD native vessel - strong stress indication'),
('93015', 'I25.110', 95, 'CAD native vessel with unstable angina'),
('93015', 'I25.111', 95, 'CAD native vessel with angina with spasm'),
('93015', 'I25.118', 95, 'CAD native vessel with other angina'),
('93015', 'I25.119', 95, 'CAD native vessel with unspecified angina'),
('93015', 'I25.5', 90, 'Ischemic cardiomyopathy'),
('93015', 'R07.1', 85, 'Chest pain on breathing'),
('93015', 'R07.2', 85, 'Precordial pain'),
('93015', 'R07.89', 85, 'Other chest pain'),
('93015', 'R07.9', 80, 'Chest pain unspecified'),
('93015', 'R06.02', 75, 'Shortness of breath'),
('93015', 'R55', 70, 'Syncope'),
('93350', 'I25.10', 95, 'CAD - stress echo'),
('93350', 'R07.9', 85, 'Chest pain - stress echo'),
('93350', 'I50.9', 80, 'Heart failure - stress echo'),
('93351', 'I25.10', 95, 'CAD - stress echo with contrast'),
('93351', 'R07.9', 85, 'Chest pain - stress echo with contrast'),

-- Cardiac Catheterization (93452-93461)
('93458', 'I25.10', 95, 'CAD - left heart cath with angiography'),
('93458', 'I25.110', 98, 'CAD with unstable angina - strong cath indication'),
('93458', 'I21.9', 98, 'Acute MI - emergent cath indication'),
('93458', 'I21.01', 98, 'STEMI anterior wall'),
('93458', 'I21.02', 98, 'STEMI anterior wall subsequent'),
('93458', 'I21.11', 98, 'STEMI inferior wall'),
('93458', 'I21.4', 95, 'NSTEMI'),

-- =====================================================
-- PULMONOLOGY - EXPANDED
-- =====================================================

-- Pulmonary Function Tests (94010, 94060, 94729)
('94010', 'J44.9', 95, 'COPD - spirometry indicated'),
('94010', 'J44.0', 95, 'COPD with acute lower respiratory infection'),
('94010', 'J44.1', 95, 'COPD with acute exacerbation'),
('94010', 'J45.20', 90, 'Mild intermittent asthma'),
('94010', 'J45.30', 90, 'Mild persistent asthma'),
('94010', 'J45.40', 90, 'Moderate persistent asthma'),
('94010', 'J45.50', 90, 'Severe persistent asthma'),
('94010', 'J45.909', 85, 'Asthma unspecified'),
('94010', 'R06.02', 80, 'Shortness of breath'),
('94010', 'R05.9', 75, 'Cough'),
('94060', 'J44.9', 95, 'COPD - pre/post bronchodilator'),
('94060', 'J45.909', 95, 'Asthma - pre/post bronchodilator'),
('94729', 'J44.9', 90, 'COPD - DLCO'),
('94729', 'J84.9', 90, 'Interstitial lung disease - DLCO'),

-- Chest CT (71250-71270)
('71250', 'R91.1', 95, 'Solitary pulmonary nodule - CT indicated'),
('71250', 'R91.8', 90, 'Other lung findings'),
('71250', 'C34.90', 95, 'Lung cancer - staging/monitoring'),
('71250', 'C34.10', 95, 'Upper lobe lung cancer'),
('71250', 'C34.11', 95, 'Upper lobe right lung cancer'),
('71250', 'C34.12', 95, 'Upper lobe left lung cancer'),
('71250', 'J18.9', 85, 'Pneumonia - CT for complications'),
('71250', 'J84.9', 90, 'Interstitial lung disease'),
('71250', 'J84.10', 90, 'Pulmonary fibrosis'),
('71260', 'I26.99', 95, 'Pulmonary embolism - CT angiography'),
('71260', 'I26.90', 95, 'Pulmonary embolism without cor pulmonale'),
('71260', 'R07.9', 80, 'Chest pain - CT workup'),

-- =====================================================
-- GASTROENTEROLOGY - EXPANDED
-- =====================================================

-- Upper Endoscopy (43235-43259)
('43239', 'K21.0', 95, 'GERD with esophagitis - EGD indicated'),
('43239', 'K21.9', 85, 'GERD without esophagitis'),
('43239', 'K25.9', 95, 'Gastric ulcer'),
('43239', 'K26.9', 95, 'Duodenal ulcer'),
('43239', 'K29.70', 90, 'Gastritis unspecified'),
('43239', 'K92.0', 98, 'Hematemesis - urgent EGD'),
('43239', 'K92.1', 98, 'Melena - urgent EGD'),
('43239', 'K22.2', 90, 'Esophageal obstruction'),
('43239', 'R13.10', 85, 'Dysphagia'),
('43239', 'R10.13', 75, 'Epigastric pain'),

-- Colonoscopy (45378-45398)
('45378', 'Z12.11', 95, 'Colon cancer screening - colonoscopy'),
('45378', 'Z86.010', 95, 'Personal history colon polyps'),
('45378', 'K92.1', 98, 'Melena - diagnostic colonoscopy'),
('45378', 'K92.2', 98, 'GI hemorrhage - diagnostic colonoscopy'),
('45378', 'K62.5', 95, 'Rectal bleeding'),
('45378', 'K58.9', 80, 'IBS'),
('45378', 'K50.90', 90, 'Crohn disease'),
('45378', 'K51.90', 90, 'Ulcerative colitis'),
('45380', 'Z12.11', 95, 'Screening colonoscopy with biopsy'),
('45385', 'K63.5', 95, 'Colon polyp - polypectomy'),

-- =====================================================
-- ORTHOPEDICS - EXPANDED
-- =====================================================

-- Joint Injections (20610)
('20610', 'M17.11', 95, 'Primary osteoarthritis right knee'),
('20610', 'M17.12', 95, 'Primary osteoarthritis left knee'),
('20610', 'M17.9', 90, 'Osteoarthritis knee unspecified'),
('20610', 'M25.561', 90, 'Pain in right knee'),
('20610', 'M25.562', 90, 'Pain in left knee'),
('20610', 'M25.511', 90, 'Pain in right shoulder'),
('20610', 'M25.512', 90, 'Pain in left shoulder'),
('20610', 'M75.100', 90, 'Rotator cuff syndrome right'),
('20610', 'M75.101', 90, 'Rotator cuff syndrome left'),
('20610', 'M75.102', 90, 'Rotator cuff syndrome bilateral'),

-- MRI (72141-72158, 73721-73723)
('72148', 'M54.5', 90, 'Low back pain - lumbar MRI'),
('72148', 'M54.16', 90, 'Radiculopathy lumbar'),
('72148', 'M54.17', 90, 'Radiculopathy lumbosacral'),
('72148', 'M51.16', 95, 'Lumbar disc herniation'),
('72148', 'M48.06', 90, 'Spinal stenosis lumbar'),
('72141', 'M54.2', 90, 'Cervicalgia - cervical MRI'),
('72141', 'M54.12', 90, 'Radiculopathy cervical'),
('72141', 'M50.20', 95, 'Cervical disc displacement'),
('73721', 'M25.551', 90, 'Pain right hip - hip MRI'),
('73721', 'M25.552', 90, 'Pain left hip'),
('73721', 'M16.11', 95, 'Primary osteoarthritis right hip'),
('73721', 'M16.12', 95, 'Primary osteoarthritis left hip'),

-- =====================================================
-- LABORATORY - EXPANDED
-- =====================================================

-- Diabetes Labs
('83036', 'E11.9', 95, 'Type 2 DM - HbA1c monitoring'),
('83036', 'E11.65', 95, 'Type 2 DM with hyperglycemia'),
('83036', 'E10.9', 95, 'Type 1 DM - HbA1c'),
('83036', 'E10.65', 95, 'Type 1 DM with hyperglycemia'),
('83036', 'E13.9', 90, 'Other DM'),
('83036', 'R73.03', 85, 'Prediabetes'),
('83036', 'Z13.1', 80, 'DM screening'),

-- Thyroid Labs
('84443', 'E03.9', 95, 'Hypothyroidism - TSH monitoring'),
('84443', 'E05.90', 95, 'Hyperthyroidism - TSH monitoring'),
('84443', 'E06.3', 90, 'Autoimmune thyroiditis'),
('84443', 'R53.83', 75, 'Fatigue - thyroid workup'),
('84443', 'R63.4', 75, 'Weight loss - thyroid workup'),
('84443', 'R63.5', 75, 'Weight gain - thyroid workup'),
('84436', 'E03.9', 90, 'Hypothyroidism - T4'),
('84439', 'E05.90', 90, 'Hyperthyroidism - Free T4'),

-- Lipid Panel
('80061', 'E78.5', 95, 'Hyperlipidemia - lipid monitoring'),
('80061', 'E78.0', 95, 'Pure hypercholesterolemia'),
('80061', 'E78.1', 95, 'Pure hypertriglyceridemia'),
('80061', 'E78.2', 95, 'Mixed hyperlipidemia'),
('80061', 'I25.10', 90, 'CAD - lipid monitoring'),
('80061', 'E11.9', 85, 'Diabetes - cardiovascular risk'),
('80061', 'I10', 80, 'Hypertension - cardiovascular risk'),
('80061', 'Z13.220', 80, 'Lipid screening'),

-- Kidney Function
('80048', 'N18.9', 95, 'CKD - BMP monitoring'),
('80048', 'N18.1', 95, 'CKD stage 1'),
('80048', 'N18.2', 95, 'CKD stage 2'),
('80048', 'N18.3', 95, 'CKD stage 3'),
('80048', 'N18.4', 95, 'CKD stage 4'),
('80048', 'N18.5', 95, 'CKD stage 5'),
('80048', 'E11.22', 95, 'DM with CKD'),
('80048', 'I10', 85, 'HTN - renal monitoring'),

-- =====================================================
-- WEAK/LOW SUPPORT CODES (Likely to Deny)
-- =====================================================

-- These get LOW scores to flag potential denials
('93306', 'Z00.00', 20, 'Routine exam - weak support for echo'),
('93306', 'Z01.89', 25, 'Other specified exam - weak echo support'),
('93229', 'Z00.00', 15, 'Routine exam - weak support for cardiac monitoring'),
('93229', 'Z01.89', 20, 'Other exam - weak cardiac monitoring support'),
('71250', 'Z00.00', 15, 'Routine exam - CT not indicated'),
('80061', 'Z00.00', 60, 'Routine exam - screening lipids acceptable'),
('83036', 'Z00.00', 40, 'Routine exam - HbA1c needs DM or prediabetes dx'),
('43239', 'Z00.00', 20, 'Routine exam - EGD not indicated'),
('45378', 'Z00.00', 50, 'Routine exam - screening colonoscopy may be OK')

ON CONFLICT ON CONSTRAINT medical_necessity_cpt_icd_unique DO UPDATE SET
  necessity_score = EXCLUDED.necessity_score,
  notes = EXCLUDED.notes;

-- =====================================================
-- ADD INDEX FOR ICD CODE LOOKUPS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_necessity_icd 
  ON public.medical_necessity_matrix(icd_code);

CREATE INDEX IF NOT EXISTS idx_necessity_score 
  ON public.medical_necessity_matrix(necessity_score);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  total_count INTEGER;
  high_support INTEGER;
  low_support INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.medical_necessity_matrix;
  SELECT COUNT(*) INTO high_support FROM public.medical_necessity_matrix WHERE necessity_score >= 80;
  SELECT COUNT(*) INTO low_support FROM public.medical_necessity_matrix WHERE necessity_score < 50;
  
  RAISE NOTICE '✅ Medical Necessity Matrix Updated:';
  RAISE NOTICE '   Total mappings: %', total_count;
  RAISE NOTICE '   Strong support (≥80): %', high_support;
  RAISE NOTICE '   Weak support (<50): %', low_support;
END $$;