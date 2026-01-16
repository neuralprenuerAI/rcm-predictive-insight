-- Create patient audit log table for tracking patient updates
CREATE TABLE IF NOT EXISTS patient_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  patient_external_id text,
  user_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb,
  before_data jsonb,
  after_data jsonb,
  source text DEFAULT 'ecw',
  status text DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE patient_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to manage their own audit logs
CREATE POLICY "Users can manage their own audit logs" ON patient_audit_log
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_patient_audit_patient_id ON patient_audit_log(patient_id);
CREATE INDEX idx_patient_audit_user_id ON patient_audit_log(user_id);
CREATE INDEX idx_patient_audit_created_at ON patient_audit_log(created_at DESC);