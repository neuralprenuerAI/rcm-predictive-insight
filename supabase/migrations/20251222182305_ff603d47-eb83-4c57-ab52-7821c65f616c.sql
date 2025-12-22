-- =====================================================
-- EXTENDED MEDICAL NECESSITY MATRIX
-- +200 Additional Mappings - Full Specialty Coverage
-- =====================================================

-- =====================================================
-- NEUROLOGY
-- =====================================================

INSERT INTO public.medical_necessity_matrix (cpt_code, icd_code, necessity_score, notes) VALUES

-- EEG (95816-95822)
('95816', 'G40.909', 95, 'Epilepsy unspecified - EEG indicated'),
('95816', 'G40.901', 95, 'Epilepsy with intractable seizures'),
('95816', 'G40.011', 95, 'Localization-related idiopathic epilepsy'),
('95816', 'G40.111', 95, 'Localization-related symptomatic epilepsy'),
('95816', 'G40.309', 95, 'Generalized idiopathic epilepsy'),
('95816', 'R56.9', 90, 'Convulsions unspecified'),
('95816', 'R56.00', 90, 'Febrile convulsions'),
('95816', 'R55', 80, 'Syncope - rule out seizure'),
('95816', 'R41.82', 75, 'Altered mental status'),
('95819', 'G40.909', 95, 'Epilepsy - extended EEG'),
('95822', 'G40.909', 95, 'Epilepsy - sleep EEG'),

-- EMG/Nerve Conduction (95860-95887)
('95860', 'G56.00', 95, 'Carpal tunnel syndrome - EMG'),
('95860', 'G56.01', 95, 'Carpal tunnel right'),
('95860', 'G56.02', 95, 'Carpal tunnel left'),
('95860', 'G56.03', 95, 'Carpal tunnel bilateral'),
('95860', 'G62.9', 90, 'Polyneuropathy unspecified'),
('95860', 'E11.42', 95, 'Type 2 DM with diabetic polyneuropathy'),
('95860', 'G57.00', 90, 'Sciatic nerve lesion'),
('95860', 'M54.16', 85, 'Radiculopathy lumbar'),
('95860', 'M54.17', 85, 'Radiculopathy lumbosacral'),
('95886', 'G56.00', 95, 'Carpal tunnel - nerve conduction'),
('95886', 'G62.9', 90, 'Polyneuropathy - nerve conduction'),
('95886', 'E11.42', 95, 'Diabetic neuropathy - nerve conduction'),

-- Brain MRI (70551-70553)
('70551', 'G43.909', 85, 'Migraine - brain MRI'),
('70551', 'R51.9', 80, 'Headache - brain MRI'),
('70551', 'G40.909', 90, 'Epilepsy - brain MRI'),
('70551', 'C71.9', 95, 'Brain malignancy'),
('70551', 'D33.0', 90, 'Benign brain neoplasm'),
('70551', 'G35', 95, 'Multiple sclerosis'),
('70551', 'I63.9', 95, 'Cerebral infarction'),
('70551', 'I61.9', 95, 'Intracerebral hemorrhage'),
('70551', 'R41.0', 85, 'Disorientation'),
('70551', 'R41.3', 85, 'Other amnesia'),
('70553', 'C71.9', 95, 'Brain malignancy - MRI with contrast'),
('70553', 'G35', 95, 'MS - MRI with contrast'),

-- =====================================================
-- VASCULAR STUDIES
-- =====================================================

-- Carotid Duplex (93880-93882)
('93880', 'I65.21', 95, 'Carotid artery stenosis right'),
('93880', 'I65.22', 95, 'Carotid artery stenosis left'),
('93880', 'I65.23', 95, 'Carotid artery stenosis bilateral'),
('93880', 'I65.29', 90, 'Carotid artery stenosis unspecified'),
('93880', 'G45.9', 90, 'TIA unspecified'),
('93880', 'G45.0', 90, 'Vertebrobasilar syndrome'),
('93880', 'G45.1', 90, 'Carotid artery syndrome'),
('93880', 'I63.9', 85, 'Cerebral infarction - carotid eval'),
('93880', 'R42', 75, 'Dizziness - carotid screen'),

-- Venous Duplex (93970-93971)
('93970', 'I82.401', 95, 'DVT right lower extremity'),
('93970', 'I82.402', 95, 'DVT left lower extremity'),
('93970', 'I82.403', 95, 'DVT bilateral lower extremity'),
('93970', 'I82.409', 95, 'DVT lower extremity unspecified'),
('93970', 'I82.411', 95, 'DVT right femoral vein'),
('93970', 'I82.421', 95, 'DVT right iliac vein'),
('93970', 'I80.10', 90, 'Phlebitis lower extremity'),
('93970', 'R60.0', 80, 'Localized edema - DVT rule out'),
('93970', 'M79.3', 75, 'Panniculitis - DVT rule out'),
('93971', 'I82.401', 90, 'DVT - unilateral study'),

-- Arterial Duplex (93925-93926)
('93925', 'I73.9', 95, 'Peripheral vascular disease'),
('93925', 'I70.201', 95, 'Atherosclerosis native arteries right leg'),
('93925', 'I70.202', 95, 'Atherosclerosis native arteries left leg'),
('93925', 'I70.209', 95, 'Atherosclerosis native arteries unspecified'),
('93925', 'I70.211', 95, 'Atherosclerosis with intermittent claudication right'),
('93925', 'I70.212', 95, 'Atherosclerosis with intermittent claudication left'),
('93925', 'R60.0', 70, 'Edema - arterial evaluation'),

-- =====================================================
-- DERMATOLOGY
-- =====================================================

-- Skin Biopsy (11102-11107)
('11102', 'L57.0', 90, 'Actinic keratosis'),
('11102', 'D48.5', 95, 'Neoplasm uncertain behavior skin'),
('11102', 'C44.91', 95, 'Skin malignancy right'),
('11102', 'C44.92', 95, 'Skin malignancy left'),
('11102', 'L82.1', 85, 'Seborrheic keratosis'),
('11102', 'D22.9', 90, 'Melanocytic nevus'),
('11102', 'L98.8', 85, 'Other skin disorder'),
('11102', 'R23.8', 80, 'Other skin changes'),
('11104', 'C44.91', 95, 'Skin malignancy - punch biopsy'),
('11106', 'C44.91', 95, 'Skin malignancy - incisional biopsy'),

-- Lesion Destruction (17000-17286)
('17000', 'L57.0', 95, 'Actinic keratosis destruction'),
('17003', 'L57.0', 95, 'Actinic keratosis 2-14 lesions'),
('17110', 'B07.9', 95, 'Viral wart destruction'),
('17110', 'B07.0', 95, 'Plantar wart'),
('17110', 'L82.1', 85, 'Seborrheic keratosis destruction'),
('17111', 'B07.9', 95, 'Viral warts 15+ lesions'),

-- Lesion Excision (11400-11446)
('11402', 'D22.9', 90, 'Melanocytic nevus excision 0.6-1cm'),
('11403', 'D22.9', 90, 'Melanocytic nevus excision 1.1-2cm'),
('11404', 'D22.9', 90, 'Melanocytic nevus excision 2.1-3cm'),
('11602', 'C44.91', 95, 'Skin malignancy excision 0.6-1cm'),
('11603', 'C44.91', 95, 'Skin malignancy excision 1.1-2cm'),
('11604', 'C44.91', 95, 'Skin malignancy excision 2.1-3cm'),

-- =====================================================
-- UROLOGY
-- =====================================================

-- Cystoscopy (52000-52354)
('52000', 'R31.0', 95, 'Gross hematuria - cystoscopy'),
('52000', 'R31.9', 90, 'Hematuria unspecified'),
('52000', 'C67.9', 95, 'Bladder cancer'),
('52000', 'N32.0', 90, 'Bladder neck obstruction'),
('52000', 'N30.00', 85, 'Acute cystitis'),
('52000', 'N30.10', 85, 'Interstitial cystitis'),
('52000', 'N39.0', 80, 'UTI - recurrent'),
('52000', 'N40.1', 85, 'BPH with LUTS'),

-- Urodynamics (51726-51797)
('51726', 'N31.9', 95, 'Neurogenic bladder - urodynamics'),
('51726', 'N32.81', 90, 'Overactive bladder'),
('51726', 'N39.3', 85, 'Stress incontinence'),
('51726', 'N39.41', 85, 'Urge incontinence'),
('51726', 'N39.46', 90, 'Mixed incontinence'),
('51728', 'N31.9', 95, 'Neurogenic bladder - complex urodynamics'),
('51729', 'N39.3', 90, 'Stress incontinence - with voiding pressure'),

-- PSA/Prostate
('84153', 'C61', 95, 'Prostate cancer - PSA monitoring'),
('84153', 'N40.0', 80, 'BPH - PSA'),
('84153', 'Z12.5', 85, 'Prostate cancer screening'),
('84154', 'C61', 95, 'Prostate cancer - free PSA'),

-- =====================================================
-- OPHTHALMOLOGY
-- =====================================================

-- OCT (92132-92134)
('92133', 'H35.30', 95, 'Macular degeneration - OCT'),
('92133', 'H35.31', 95, 'Nonexudative AMD right'),
('92133', 'H35.32', 95, 'Nonexudative AMD left'),
('92133', 'H35.3110', 95, 'Early AMD right'),
('92133', 'H35.3120', 95, 'Early AMD left'),
('92133', 'E11.3211', 95, 'DM with mild NPDR right'),
('92133', 'E11.3212', 95, 'DM with mild NPDR left'),
('92133', 'E11.3411', 95, 'DM with severe NPDR right'),
('92133', 'H40.10X0', 90, 'Open angle glaucoma'),
('92134', 'H40.10X0', 95, 'Open angle glaucoma - retinal nerve fiber OCT'),

-- Visual Fields (92081-92083)
('92083', 'H40.10X0', 95, 'Open angle glaucoma - visual field'),
('92083', 'H40.11X0', 95, 'Primary open angle glaucoma'),
('92083', 'H40.1210', 95, 'Low tension glaucoma right'),
('92083', 'H53.40', 90, 'Visual field defect'),
('92083', 'H47.10', 90, 'Papilledema'),
('92083', 'H47.20', 90, 'Optic atrophy'),
('92081', 'H40.10X0', 90, 'Glaucoma - limited visual field'),

-- Cataract
('66984', 'H25.11', 95, 'Age-related nuclear cataract right'),
('66984', 'H25.12', 95, 'Age-related nuclear cataract left'),
('66984', 'H25.13', 95, 'Age-related nuclear cataract bilateral'),
('66984', 'H25.811', 95, 'Combined cataract right'),
('66984', 'H25.812', 95, 'Combined cataract left'),
('66984', 'H26.9', 90, 'Cataract unspecified'),

-- =====================================================
-- ENT / AUDIOLOGY
-- =====================================================

-- Audiometry (92552-92557)
('92557', 'H91.90', 95, 'Hearing loss unspecified'),
('92557', 'H90.5', 95, 'Sensorineural hearing loss bilateral'),
('92557', 'H90.3', 95, 'Sensorineural hearing loss right'),
('92557', 'H90.4', 95, 'Sensorineural hearing loss left'),
('92557', 'H90.0', 90, 'Conductive hearing loss bilateral'),
('92557', 'H83.3X1', 90, 'Noise effects right ear'),
('92557', 'H83.3X2', 90, 'Noise effects left ear'),
('92557', 'H93.11', 85, 'Tinnitus right ear'),
('92557', 'H93.12', 85, 'Tinnitus left ear'),
('92553', 'H91.90', 90, 'Hearing loss - pure tone air'),

-- Tympanometry (92567-92570)
('92567', 'H65.90', 90, 'Otitis media unspecified'),
('92567', 'H65.20', 90, 'Chronic serous otitis media'),
('92567', 'H72.90', 90, 'TM perforation'),
('92567', 'H74.00', 85, 'Tympanosclerosis'),

-- Laryngoscopy (31575-31579)
('31575', 'R13.10', 90, 'Dysphagia - laryngoscopy'),
('31575', 'R49.0', 90, 'Dysphonia'),
('31575', 'J38.00', 90, 'Vocal cord paralysis'),
('31575', 'J38.1', 85, 'Vocal cord polyp'),
('31575', 'J38.2', 85, 'Vocal cord nodules'),
('31575', 'C32.9', 95, 'Laryngeal malignancy'),

-- =====================================================
-- SLEEP MEDICINE
-- =====================================================

-- Polysomnography (95810-95811)
('95810', 'G47.33', 95, 'Obstructive sleep apnea'),
('95810', 'G47.30', 90, 'Sleep apnea unspecified'),
('95810', 'G47.31', 90, 'Primary central sleep apnea'),
('95810', 'G47.9', 80, 'Sleep disorder unspecified'),
('95810', 'R06.83', 85, 'Snoring'),
('95810', 'E66.9', 75, 'Obesity - sleep study'),
('95810', 'I10', 70, 'Hypertension - sleep apnea screen'),
('95811', 'G47.33', 95, 'OSA - CPAP titration'),

-- =====================================================
-- ALLERGY / IMMUNOLOGY
-- =====================================================

-- Allergy Testing (95004-95079)
('95004', 'J30.9', 95, 'Allergic rhinitis - skin testing'),
('95004', 'J30.1', 95, 'Allergic rhinitis due to pollen'),
('95004', 'J30.2', 95, 'Other seasonal allergic rhinitis'),
('95004', 'J30.89', 90, 'Other allergic rhinitis'),
('95004', 'J45.20', 90, 'Mild intermittent asthma'),
('95004', 'L20.9', 85, 'Atopic dermatitis'),
('95004', 'L23.9', 85, 'Allergic contact dermatitis'),
('95004', 'T78.40XA', 90, 'Allergy unspecified'),
('95024', 'J30.9', 90, 'Allergic rhinitis - intradermal testing'),
('95044', 'J30.9', 85, 'Allergic rhinitis - patch testing'),

-- Immunotherapy (95115-95199)
('95117', 'J30.1', 95, 'Allergic rhinitis - immunotherapy 2+ injections'),
('95117', 'J45.20', 95, 'Asthma - immunotherapy'),
('95165', 'J30.1', 95, 'Allergic rhinitis - antigen preparation'),

-- =====================================================
-- PHYSICAL THERAPY / REHAB
-- =====================================================

-- PT Evaluations (97161-97163)
('97161', 'M54.5', 90, 'Low back pain - PT eval low complexity'),
('97162', 'M54.5', 90, 'Low back pain - PT eval moderate'),
('97163', 'M54.5', 90, 'Low back pain - PT eval high complexity'),
('97161', 'M25.561', 90, 'Knee pain - PT eval'),
('97161', 'M25.511', 90, 'Shoulder pain - PT eval'),
('97162', 'S83.511A', 95, 'ACL sprain - PT eval'),
('97163', 'Z96.641', 95, 'Right hip replacement - PT eval'),
('97163', 'Z96.651', 95, 'Right knee replacement - PT eval'),

-- Therapeutic Exercise (97110-97542)
('97110', 'M54.5', 90, 'Low back pain - therapeutic exercise'),
('97110', 'M25.561', 90, 'Knee pain - therapeutic exercise'),
('97110', 'Z96.641', 95, 'Hip replacement - therapeutic exercise'),
('97140', 'M54.5', 90, 'Low back pain - manual therapy'),
('97530', 'Z96.651', 95, 'Knee replacement - therapeutic activities'),
('97542', 'G81.90', 95, 'Hemiplegia - wheelchair training'),

-- =====================================================
-- ADDITIONAL IMAGING
-- =====================================================

-- Abdominal CT (74150-74178)
('74176', 'R10.9', 85, 'Abdominal pain - CT abdomen/pelvis'),
('74176', 'K35.80', 95, 'Acute appendicitis'),
('74176', 'K80.00', 90, 'Cholelithiasis'),
('74176', 'K57.30', 90, 'Diverticulosis'),
('74176', 'K57.32', 95, 'Diverticulitis'),
('74176', 'C18.9', 95, 'Colon malignancy'),
('74177', 'C18.9', 95, 'Colon malignancy - CT with contrast'),
('74178', 'C18.9', 95, 'Colon malignancy - CT with/without contrast'),

-- Abdominal Ultrasound (76700-76705)
('76700', 'K80.00', 95, 'Cholelithiasis - abdominal US'),
('76700', 'K80.20', 95, 'Gallbladder stone with cholecystitis'),
('76700', 'R10.11', 85, 'RUQ pain'),
('76700', 'R10.13', 80, 'Epigastric pain'),
('76700', 'K76.0', 90, 'Fatty liver'),
('76700', 'B19.20', 90, 'Hepatitis C'),
('76705', 'K80.00', 90, 'Gallbladder stone - limited US'),

-- Pelvic Ultrasound (76856-76857)
('76856', 'N92.0', 90, 'Menorrhagia - pelvic US'),
('76856', 'N92.1', 90, 'Metrorrhagia'),
('76856', 'N80.0', 90, 'Endometriosis uterus'),
('76856', 'D25.9', 90, 'Uterine leiomyoma'),
('76856', 'N83.20', 90, 'Ovarian cyst'),
('76856', 'N94.6', 85, 'Dysmenorrhea'),

-- =====================================================
-- INFUSIONS / INJECTIONS
-- =====================================================

-- IV Infusions (96365-96379)
('96365', 'D50.9', 95, 'Iron deficiency anemia - iron infusion'),
('96365', 'M06.9', 95, 'Rheumatoid arthritis - biologic infusion'),
('96365', 'K50.90', 95, 'Crohn disease - biologic infusion'),
('96365', 'K51.90', 95, 'Ulcerative colitis - biologic infusion'),
('96365', 'L40.50', 95, 'Psoriatic arthritis - biologic infusion'),
('96365', 'G35', 95, 'Multiple sclerosis - infusion'),
('96413', 'C50.919', 95, 'Breast cancer - chemotherapy'),
('96413', 'C34.90', 95, 'Lung cancer - chemotherapy'),

-- Trigger Point Injections (20552-20553)
('20552', 'M79.1', 90, 'Myalgia - trigger point injection'),
('20552', 'M54.2', 90, 'Cervicalgia - trigger point'),
('20552', 'M54.5', 90, 'Low back pain - trigger point'),
('20553', 'M79.1', 90, 'Myalgia - trigger points 3+ muscles'),

-- =====================================================
-- WEAK SUPPORT - LIKELY DENIALS (More codes)
-- =====================================================

('95810', 'Z00.00', 25, 'Routine exam - sleep study not indicated'),
('92133', 'Z00.00', 20, 'Routine exam - OCT not indicated'),
('70551', 'Z00.00', 15, 'Routine exam - brain MRI not indicated'),
('72148', 'Z00.00', 15, 'Routine exam - lumbar MRI not indicated'),
('93880', 'Z00.00', 20, 'Routine exam - carotid duplex not indicated'),
('93970', 'Z00.00', 20, 'Routine exam - venous duplex not indicated'),
('52000', 'Z00.00', 15, 'Routine exam - cystoscopy not indicated'),
('43239', 'R10.9', 60, 'Abdominal pain alone - weak EGD support'),
('74176', 'Z00.00', 15, 'Routine exam - CT abdomen not indicated'),
('97110', 'Z00.00', 20, 'Routine exam - PT not indicated')

ON CONFLICT ON CONSTRAINT medical_necessity_cpt_icd_unique DO UPDATE SET
  necessity_score = EXCLUDED.necessity_score,
  notes = EXCLUDED.notes;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.medical_necessity_matrix;
  
  RAISE NOTICE '✅ Extended Medical Necessity Matrix Complete:';
  RAISE NOTICE '   Total mappings: %', total_count;
  RAISE NOTICE '   New specialties: Neurology, Vascular, Derm, Urology, Ophthalmology, ENT, Sleep, Allergy, PT, Imaging';
END $$;