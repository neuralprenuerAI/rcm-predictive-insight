-- =====================================================
-- FREQUENCY LIMITS TABLE
-- Defines how often procedures can be performed
-- =====================================================

CREATE TABLE IF NOT EXISTS public.frequency_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpt_code VARCHAR(10) NOT NULL,
  description TEXT,
  
  -- Frequency rules
  max_per_day INTEGER DEFAULT 1,
  max_per_week INTEGER,
  max_per_month INTEGER,
  max_per_year INTEGER,
  
  -- Conditions
  requires_interval_days INTEGER,
  reset_on_diagnosis_change BOOLEAN DEFAULT false,
  
  -- Exceptions
  exception_modifiers TEXT[],
  exception_diagnoses TEXT[],
  exception_note TEXT,
  
  -- Payer specifics
  payer VARCHAR(100) DEFAULT 'all',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT freq_cpt_payer_unique UNIQUE(cpt_code, payer)
);

-- Enable RLS
ALTER TABLE public.frequency_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read frequency_limits"
  ON public.frequency_limits
  FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_freq_cpt ON public.frequency_limits(cpt_code);
CREATE INDEX IF NOT EXISTS idx_freq_payer ON public.frequency_limits(payer);

-- =====================================================
-- SEED FREQUENCY LIMITS DATA
-- =====================================================

INSERT INTO public.frequency_limits (cpt_code, description, max_per_day, max_per_week, max_per_month, max_per_year, requires_interval_days, exception_note, payer) VALUES

-- E/M Visits
('99202', 'Office visit new patient level 2', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99203', 'Office visit new patient level 3', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99204', 'Office visit new patient level 4', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99205', 'Office visit new patient level 5', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99211', 'Office visit established level 1', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99212', 'Office visit established level 2', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99213', 'Office visit established level 3', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99214', 'Office visit established level 4', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),
('99215', 'Office visit established level 5', 1, NULL, NULL, NULL, NULL, 'One E/M per day per provider', 'all'),

-- Cardiac Monitoring
('93224', 'Holter monitor 24hr', 1, NULL, NULL, 2, 180, 'Typically 2 per year, 6 months apart unless clinical change', 'Medicare'),
('93225', 'Holter recording', 1, NULL, NULL, 2, 180, 'Component of Holter service', 'Medicare'),
('93226', 'Holter scanning', 1, NULL, NULL, 2, 180, 'Component of Holter service', 'Medicare'),
('93227', 'Holter review', 1, NULL, NULL, 2, 180, 'Component of Holter service', 'Medicare'),
('93228', 'Mobile cardiac telemetry with review', 1, NULL, NULL, 2, 90, '30-day episodes, typically 2 per year', 'Medicare'),
('93229', 'Mobile cardiac telemetry technical', 1, NULL, NULL, 2, 90, '30-day episodes, typically 2 per year', 'Medicare'),
('93241', 'External ECG recording 24-48hr', 1, NULL, NULL, 2, 180, 'Similar to Holter limits', 'Medicare'),
('93242', 'External ECG transmission 24-48hr', 1, NULL, NULL, 2, 180, 'Similar to Holter limits', 'Medicare'),
('93243', 'External ECG analysis 24-48hr', 1, NULL, NULL, 2, 180, 'Similar to Holter limits', 'Medicare'),
('93244', 'External ECG review 24-48hr', 1, NULL, NULL, 2, 180, 'Similar to Holter limits', 'Medicare'),
('93245', 'External ECG recording >48hr', 1, NULL, NULL, 2, 180, 'Extended monitoring limits', 'Medicare'),
('93246', 'External ECG transmission >48hr', 1, NULL, NULL, 2, 180, 'Extended monitoring limits', 'Medicare'),
('93247', 'External ECG analysis >48hr', 1, NULL, NULL, 2, 180, 'Extended monitoring limits', 'Medicare'),
('93248', 'External ECG review >48hr', 1, NULL, NULL, 2, 180, 'Extended monitoring limits', 'Medicare'),

-- Echocardiography
('93306', 'TTE complete with Doppler', 1, NULL, NULL, 1, 365, 'Once per year unless documented clinical change', 'Medicare'),
('93307', 'TTE complete', 1, NULL, NULL, 1, 365, 'Once per year unless documented clinical change', 'Medicare'),
('93308', 'TTE follow-up or limited', 1, NULL, NULL, 2, 180, 'Follow-up echo may be more frequent', 'Medicare'),
('93312', 'TEE', 1, NULL, NULL, 2, NULL, 'As clinically indicated', 'Medicare'),
('93350', 'Stress echo complete', 1, NULL, NULL, 1, 365, 'Once per year unless symptoms change', 'Medicare'),
('93351', 'Stress echo with contrast', 1, NULL, NULL, 1, 365, 'Once per year unless symptoms change', 'Medicare'),

-- ECG
('93000', 'ECG complete', 2, NULL, NULL, NULL, NULL, 'Typically 1-2 per encounter as indicated', 'all'),
('93005', 'ECG tracing only', 2, NULL, NULL, NULL, NULL, 'Component code', 'all'),
('93010', 'ECG interpretation only', 2, NULL, NULL, NULL, NULL, 'Component code', 'all'),

-- Labs - Annual
('80061', 'Lipid panel', 1, NULL, NULL, 1, 365, 'Once per year for screening, more for treatment monitoring', 'Medicare'),
('83036', 'HbA1c', 1, NULL, NULL, 4, 90, 'Every 3 months if not at goal, 2x/year if stable', 'Medicare'),
('84443', 'TSH', 1, NULL, NULL, 2, 180, 'Every 6 months for stable thyroid disease', 'Medicare'),
('82306', 'Vitamin D', 1, NULL, NULL, 1, 365, 'Once per year unless treating deficiency', 'Medicare'),
('84153', 'PSA', 1, NULL, NULL, 1, 365, 'Annual screening', 'Medicare'),

-- Labs - As Needed
('80053', 'CMP', 1, NULL, NULL, 4, 90, 'Quarterly for chronic disease monitoring', 'Medicare'),
('80048', 'BMP', 1, NULL, NULL, 4, 90, 'Quarterly for chronic disease monitoring', 'Medicare'),
('85025', 'CBC with diff', 1, NULL, NULL, 4, 90, 'As clinically indicated', 'Medicare'),

-- Imaging
('71046', 'Chest X-ray 2 views', 2, NULL, NULL, NULL, NULL, 'As clinically indicated', 'all'),
('71250', 'CT chest without contrast', 1, NULL, NULL, 2, 180, 'Not routine, requires indication', 'Medicare'),
('71260', 'CT chest with contrast', 1, NULL, NULL, 2, 180, 'Not routine, requires indication', 'Medicare'),
('71270', 'CT chest with and without', 1, NULL, NULL, 2, 180, 'Not routine, requires indication', 'Medicare'),

-- Preventive
('99381', 'Preventive visit new 0-1yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99382', 'Preventive visit new 1-4yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99383', 'Preventive visit new 5-11yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99384', 'Preventive visit new 12-17yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99385', 'Preventive visit new 18-39yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99386', 'Preventive visit new 40-64yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99387', 'Preventive visit new 65+yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99391', 'Preventive visit est 0-1yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99392', 'Preventive visit est 1-4yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99393', 'Preventive visit est 5-11yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99394', 'Preventive visit est 12-17yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99395', 'Preventive visit est 18-39yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99396', 'Preventive visit est 40-64yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all'),
('99397', 'Preventive visit est 65+yr', 1, NULL, NULL, 1, 365, 'Well visit limits', 'all')

ON CONFLICT ON CONSTRAINT freq_cpt_payer_unique DO UPDATE SET
  max_per_day = EXCLUDED.max_per_day,
  max_per_week = EXCLUDED.max_per_week,
  max_per_month = EXCLUDED.max_per_month,
  max_per_year = EXCLUDED.max_per_year,
  requires_interval_days = EXCLUDED.requires_interval_days,
  exception_note = EXCLUDED.exception_note;