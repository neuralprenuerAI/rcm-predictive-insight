-- SHARED_DOCUMENTS TABLE - Store document metadata for admin uploads
CREATE TABLE IF NOT EXISTS shared_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  file_type text DEFAULT 'application/pdf',
  category text DEFAULT 'general',
  is_public boolean DEFAULT false,
  uploaded_by uuid NOT NULL,
  uploaded_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shared_documents_uploaded_by ON shared_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_shared_documents_category ON shared_documents(category);
CREATE INDEX IF NOT EXISTS idx_shared_documents_is_public ON shared_documents(is_public);

-- SHARED_DOCUMENT_ASSIGNMENTS TABLE - Track user access
CREATE TABLE IF NOT EXISTS shared_document_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES shared_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  viewed_at timestamptz,
  downloaded_at timestamptz,
  UNIQUE(document_id, user_id)
);

ALTER TABLE shared_document_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_shared_doc_assignments_document ON shared_document_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_shared_doc_assignments_user ON shared_document_assignments(user_id);

-- RLS POLICIES FOR SHARED_DOCUMENTS
CREATE POLICY "Admins can view all shared documents" ON shared_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can view assigned or public shared documents" ON shared_documents
  FOR SELECT USING (
    is_public = true
    OR
    EXISTS (
      SELECT 1 FROM shared_document_assignments 
      WHERE shared_document_assignments.document_id = shared_documents.id 
      AND shared_document_assignments.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert shared documents" ON shared_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update shared documents" ON shared_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins can delete shared documents" ON shared_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- RLS POLICIES FOR SHARED_DOCUMENT_ASSIGNMENTS
CREATE POLICY "Admins can view all shared document assignments" ON shared_document_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can view own shared document assignments" ON shared_document_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage shared document assignments" ON shared_document_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can update own shared document assignments" ON shared_document_assignments
  FOR UPDATE USING (auth.uid() = user_id);

-- STORAGE BUCKET for shared documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-documents',
  'shared-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
) ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES
CREATE POLICY "Admins can upload shared documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'shared-documents'
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Authenticated users can read shared documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'shared-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can delete shared documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'shared-documents'
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );