-- =====================================================
-- LCD/NCD COMPREHENSIVE COVERAGE RULES
-- Local and National Coverage Determinations
-- =====================================================

-- First, let's ensure we have the proper table structure
-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Add coverage_type column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payer_rules' AND column_name = 'coverage_type') THEN
    ALTER TABLE public.payer_rules ADD COLUMN coverage_type VARCHAR(10);
  END IF;
  
  -- Add mac_contractor column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payer_rules' AND column_name = 'mac_contractor') THEN
    ALTER TABLE public.payer_rules ADD COLUMN mac_contractor VARCHAR(100);
  END IF;
  
  -- Add frequency_limit column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payer_rules' AND column_name = 'frequency_limit') THEN
    ALTER TABLE public.payer_rules ADD COLUMN frequency_limit VARCHAR(255);
  END IF;
  
  -- Add documentation_required column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payer_rules' AND column_name = 'documentation_required') THEN
    ALTER TABLE public.payer_rules ADD COLUMN documentation_required TEXT;
  END IF;
  
  -- Add covered_diagnoses column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payer_rules' AND column_name = 'covered_diagnoses') THEN
    ALTER TABLE public.payer_rules ADD COLUMN covered_diagnoses TEXT[];
  END IF;
END $$;

-- =====================================================
-- NATIONAL COVERAGE DETERMINATIONS (NCD)
-- Apply to all Medicare contractors nationwide
-- =====================================================

INSERT INTO public.payer_rules (payer_name, rule_type, coverage_type, cpt_codes, icd_codes, 
  rule_description, action_required, covered_diagnoses, documentation_required, 
  frequency_limit, severity, active) VALUES

-- NCD: Cardiac Monitoring (Holter, Event Recorders)
('Medicare', 'lcd', 'NCD', 
  ARRAY['93224','93225','93226','93227','93228','93229','93241','93242','93243','93244','93245','93246','93247','93248'],
  ARRAY['R00.0','R00.1','R00.2','R00.8','R55','R42','I49.9','I48.91','I48.92','I47.1','I47.2','I45.9'],
  'Ambulatory cardiac monitoring requires documented symptoms of arrhythmia (palpitations, syncope, dizziness, presyncope) or known arrhythmia requiring monitoring',
  'Document specific symptoms, duration, frequency, and prior ECG/cardiac workup results',
  ARRAY['R00.0','R00.1','R00.2','R00.8','R55','R42','I49.9','I48.91','I48.92','I47.1','I47.2','I45.9','I44.0','I44.1','I44.2','I45.0','I45.1'],
  'Symptoms documented in clinical note, prior ECG results referenced, duration of symptoms noted',
  '24-48hr Holter once per episode, Event monitor up to 30 days per episode',
  'critical', true),

-- NCD: Echocardiography
('Medicare', 'lcd', 'NCD',
  ARRAY['93303','93304','93306','93307','93308','93312','93313','93314','93315','93316','93317','93318','93320','93321','93325','93350','93351'],
  ARRAY['I50.9','I50.1','I50.20','I50.30','I50.40','I42.0','I42.9','I34.0','I35.0','I35.1','I36.0','I37.0','R00.2','R55','R06.02'],
  'Echocardiography covered for evaluation of suspected or known cardiac disease including heart failure, cardiomyopathy, valvular disease, or unexplained symptoms',
  'Document indication: symptoms, physical findings (murmur, edema), or prior abnormal cardiac studies',
  ARRAY['I50.9','I50.1','I50.20','I50.21','I50.22','I50.23','I50.30','I50.31','I50.32','I50.33','I50.40','I50.41','I50.42','I50.43','I42.0','I42.1','I42.2','I42.9','I34.0','I34.1','I34.2','I35.0','I35.1','I35.2','I36.0','I36.1','I37.0','I37.1','I25.10','I25.5','Q21.0','Q21.1'],
  'Clinical indication documented, relevant symptoms or physical findings noted, prior cardiac history referenced',
  'Once per year for stable disease, more frequently with documented clinical change',
  'high', true),

-- NCD: Electrocardiogram (ECG)
('Medicare', 'lcd', 'NCD',
  ARRAY['93000','93005','93010','93015','93016','93017','93018'],
  ARRAY['R00.0','R00.1','R00.2','R07.9','R07.89','R55','R42','I10','I25.10','I50.9','I48.91'],
  'ECG covered for evaluation of cardiac symptoms, arrhythmia, chest pain, syncope, or monitoring of cardiac conditions',
  'Document symptoms or condition being evaluated',
  ARRAY['R00.0','R00.1','R00.2','R00.8','R00.9','R07.1','R07.2','R07.89','R07.9','R55','R42','I10','I11.0','I11.9','I25.10','I25.5','I50.9','I48.0','I48.1','I48.2','I48.91','I48.92','I49.0','I49.1','I49.9'],
  'Symptoms documented, indication for ECG clear in assessment',
  'As clinically indicated',
  'medium', true),

-- NCD: Stress Testing
('Medicare', 'lcd', 'NCD',
  ARRAY['93015','93016','93017','93018','93350','93351'],
  ARRAY['R07.9','R07.89','I25.10','I25.5','R55','R06.02','I10'],
  'Cardiac stress testing covered for evaluation of chest pain, known or suspected CAD, dyspnea, or risk stratification',
  'Document symptoms, cardiac risk factors, and clinical indication',
  ARRAY['R07.1','R07.2','R07.89','R07.9','I25.10','I25.5','I25.110','I25.111','I25.118','I25.119','R55','R06.02','R06.00','I10','E11.9','E78.5'],
  'Symptoms documented, risk factors listed, prior cardiac history noted',
  'As clinically indicated based on symptoms',
  'high', true),

-- NCD: Lipid Panel
('Medicare', 'lcd', 'NCD',
  ARRAY['80061','82465','83718','84478'],
  ARRAY['E78.0','E78.1','E78.2','E78.4','E78.5','I25.10','I10','E11.9'],
  'Lipid testing covered for diagnosis and management of lipid disorders, cardiovascular risk assessment',
  'Document indication: known lipid disorder, cardiovascular disease, or risk assessment',
  ARRAY['E78.0','E78.00','E78.01','E78.1','E78.2','E78.3','E78.4','E78.41','E78.49','E78.5','I25.10','I10','E11.9','Z13.220'],
  'Diagnosis of lipid disorder documented, or screening indication noted with risk factors',
  'Once per year for screening, more frequently for monitoring treatment',
  'low', true),

-- NCD: Complete Blood Count (CBC)
('Medicare', 'lcd', 'NCD',
  ARRAY['85025','85027','85004'],
  ARRAY['D64.9','D50.9','R53.83','R50.9','Z23'],
  'CBC covered for diagnosis and monitoring of hematologic conditions, infection workup, or preoperative evaluation',
  'Document clinical indication',
  ARRAY['D64.9','D50.0','D50.1','D50.8','D50.9','D51.0','D51.9','D52.0','D52.9','D53.9','D63.1','R53.83','R50.9','R79.0','Z23','Z01.812'],
  'Symptoms of anemia documented, or other clinical indication clear',
  'As clinically indicated',
  'low', true),

-- NCD: Comprehensive Metabolic Panel (CMP)
('Medicare', 'lcd', 'NCD',
  ARRAY['80053','80048'],
  ARRAY['E11.9','E11.65','I10','N18.9','E87.6','E87.5','E83.52'],
  'Metabolic panels covered for diagnosis and monitoring of metabolic disorders, diabetes, kidney disease, electrolyte abnormalities',
  'Document condition being monitored',
  ARRAY['E11.9','E11.65','E11.21','E11.22','E11.29','E11.40','E11.41','E11.42','E11.43','E11.49','E11.51','E11.52','I10','N18.1','N18.2','N18.3','N18.4','N18.5','N18.9','E87.0','E87.1','E87.5','E87.6','E86.0','E86.1'],
  'Chronic condition documented requiring metabolic monitoring',
  'As clinically indicated, typically every 3-12 months for chronic conditions',
  'low', true),

-- NCD: Chest X-Ray
('Medicare', 'lcd', 'NCD',
  ARRAY['71045','71046','71047','71048'],
  ARRAY['R05.9','R06.02','J18.9','J44.9','J44.1','R07.9','R91.8'],
  'Chest radiography covered for evaluation of respiratory symptoms, suspected pneumonia, COPD exacerbation, or chest pain',
  'Document symptoms or clinical indication',
  ARRAY['R05.9','R05.1','R05.2','R05.3','R05.4','R06.00','R06.02','R06.09','J18.0','J18.1','J18.9','J44.0','J44.1','J44.9','J45.20','J45.21','J45.22','R07.1','R07.89','R07.9','R91.1','R91.8','J96.00','J96.01'],
  'Respiratory symptoms documented, physical exam findings noted',
  'As clinically indicated',
  'low', true),

-- NCD: CT Chest
('Medicare', 'lcd', 'NCD',
  ARRAY['71250','71260','71270','71271'],
  ARRAY['R91.8','R91.1','J18.9','C34.90','R05.9','R06.02'],
  'Chest CT covered for further evaluation of abnormal chest X-ray, suspected malignancy, pulmonary embolism workup, or complex pulmonary disease',
  'Document indication and any prior imaging results',
  ARRAY['R91.1','R91.8','J18.9','C34.10','C34.11','C34.12','C34.2','C34.30','C34.31','C34.32','C34.80','C34.81','C34.82','C34.90','C34.91','C34.92','I26.99','I26.90','J84.9','J84.10'],
  'Prior chest X-ray results referenced, clinical indication clear, symptoms documented',
  'As clinically indicated',
  'high', true),

-- NCD: Thyroid Testing
('Medicare', 'lcd', 'NCD',
  ARRAY['84436','84439','84443','84480','84481'],
  ARRAY['E03.9','E05.90','R53.83','R63.4','E89.0'],
  'Thyroid function tests covered for diagnosis and monitoring of thyroid disorders, or evaluation of symptoms suggestive of thyroid dysfunction',
  'Document symptoms or known thyroid condition',
  ARRAY['E03.0','E03.1','E03.2','E03.8','E03.9','E05.00','E05.01','E05.10','E05.11','E05.20','E05.21','E05.80','E05.81','E05.90','E05.91','E06.3','E89.0','R53.83','R63.4','R63.5'],
  'Symptoms documented (fatigue, weight changes, etc.) or thyroid condition being monitored',
  'TSH annually for monitoring, more frequently during dose adjustment',
  'low', true),

-- NCD: HbA1c
('Medicare', 'lcd', 'NCD',
  ARRAY['83036'],
  ARRAY['E11.9','E11.65','E10.9','E13.9','R73.09'],
  'HbA1c covered for diagnosis and monitoring of diabetes mellitus',
  'Document diabetes diagnosis or diabetes screening indication',
  ARRAY['E11.9','E11.65','E11.8','E10.9','E10.65','E10.8','E13.9','E13.65','R73.01','R73.02','R73.03','R73.09','Z13.1'],
  'Diabetes diagnosis documented, or screening indication with risk factors',
  'Every 3 months if not at goal, every 6 months if stable',
  'low', true),

-- NCD: Vitamin D Testing
('Medicare', 'lcd', 'NCD',
  ARRAY['82306'],
  ARRAY['E55.9','M81.0','M80.00XA','R29.6'],
  'Vitamin D testing covered for evaluation of suspected deficiency, osteoporosis management, or malabsorption conditions',
  'Document indication: osteoporosis, malabsorption, symptoms of deficiency',
  ARRAY['E55.9','E55.0','M81.0','M81.6','M81.8','M80.00XA','M80.08XA','R29.6','K90.0','K90.9','N18.9'],
  'Osteoporosis diagnosis documented, or symptoms/risk factors for deficiency noted',
  'Once per year unless deficiency being treated',
  'medium', true),

-- NCD: PSA Testing
('Medicare', 'lcd', 'NCD',
  ARRAY['84153','84154'],
  ARRAY['Z12.5','R97.20','C61','N40.0'],
  'PSA testing covered for prostate cancer screening (with patient consent), monitoring of known prostate cancer, or evaluation of prostatic symptoms',
  'Document screening discussion or condition being monitored',
  ARRAY['Z12.5','R97.20','R97.21','C61','D07.5','N40.0','N40.1','N40.2','N40.3','N42.9'],
  'Screening consent documented, or prostate condition noted',
  'Annually for screening in appropriate candidates',
  'low', true),

-- NCD: Urinalysis
('Medicare', 'lcd', 'NCD',
  ARRAY['81000','81001','81002','81003','81005'],
  ARRAY['N39.0','R30.0','R31.9','R82.90','E11.9'],
  'Urinalysis covered for evaluation of UTI symptoms, hematuria, proteinuria, or diabetes monitoring',
  'Document symptoms or condition being evaluated',
  ARRAY['N39.0','N30.00','N30.01','R30.0','R30.9','R31.0','R31.1','R31.21','R31.29','R31.9','R82.90','R82.5','E11.21','E11.22','N18.9'],
  'Urinary symptoms documented, or diabetes nephropathy monitoring noted',
  'As clinically indicated',
  'low', true)

ON CONFLICT DO NOTHING;

-- =====================================================
-- LOCAL COVERAGE DETERMINATIONS (LCD) - Regional
-- Specific to Medicare Administrative Contractors
-- =====================================================

INSERT INTO public.payer_rules (payer_name, rule_type, coverage_type, mac_contractor, cpt_codes, 
  rule_description, action_required, documentation_required, frequency_limit, severity, active) VALUES

-- LCD: Novitas (JL/JH) - Cardiac Monitoring Specifics
('Medicare', 'lcd', 'LCD', 'Novitas',
  ARRAY['93224','93225','93226','93227'],
  'Novitas LCD: Holter monitoring requires clear documentation of arrhythmia symptoms and expected benefit from continuous monitoring',
  'Include symptom diary, document why Holter preferred over ECG, state expected findings',
  'Symptom onset date, frequency, duration, prior cardiac workup, expected diagnostic yield',
  'One 24-48hr study per diagnostic episode',
  'high', true),

-- LCD: CGS (J15) - Extended Cardiac Monitoring
('Medicare', 'lcd', 'LCD', 'CGS',
  ARRAY['93228','93229'],
  'CGS LCD: Mobile cardiac telemetry requires documentation that shorter monitoring (Holter) was non-diagnostic or symptoms are infrequent',
  'Document prior Holter results or explain why extended monitoring needed',
  'Prior monitoring results, symptom frequency justifying extended monitoring',
  'Up to 30 days per episode',
  'high', true),

-- LCD: First Coast (JN) - Echocardiography
('Medicare', 'lcd', 'LCD', 'First Coast',
  ARRAY['93306','93307','93308'],
  'First Coast LCD: Repeat echocardiography requires documented clinical change or new symptoms',
  'Document what changed since prior echo',
  'New symptoms, change in clinical status, or prior echo findings requiring follow-up',
  'Annually for stable disease, sooner with documented change',
  'high', true),

-- LCD: WPS (J5/J8) - Stress Testing
('Medicare', 'lcd', 'LCD', 'WPS',
  ARRAY['93015','93350','93351'],
  'WPS LCD: Stress testing requires intermediate pre-test probability of CAD or evaluation of known CAD',
  'Document chest pain characteristics, risk factors, or known CAD requiring evaluation',
  'Duke treadmill score or pre-test probability assessment, symptoms described',
  'As clinically indicated for new or changed symptoms',
  'high', true),

-- LCD: Palmetto (JM) - Laboratory Testing
('Medicare', 'lcd', 'LCD', 'Palmetto',
  ARRAY['80053','80061','85025'],
  'Palmetto LCD: Routine labs require documented medical necessity, not just screening',
  'Link each test to specific diagnosis or symptom being evaluated',
  'Each lab test linked to specific ICD-10 code with documented reason',
  'Based on condition being monitored',
  'medium', true),

-- LCD: NGS (J6/JK) - Imaging
('Medicare', 'lcd', 'LCD', 'NGS',
  ARRAY['71250','71260','71270'],
  'NGS LCD: Advanced imaging requires clear indication and documentation of why simpler imaging insufficient',
  'Document prior imaging results, explain clinical need for CT',
  'Prior X-ray results referenced, clinical question to be answered by CT',
  'As clinically indicated',
  'high', true)

ON CONFLICT DO NOTHING;

-- =====================================================
-- ADD INDEX FOR FASTER LCD/NCD LOOKUPS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_payer_rules_coverage_type 
  ON public.payer_rules(coverage_type) 
  WHERE coverage_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payer_rules_mac 
  ON public.payer_rules(mac_contractor) 
  WHERE mac_contractor IS NOT NULL;