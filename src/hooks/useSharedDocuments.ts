import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SharedDocument {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string;
  category: string;
  is_public: boolean;
  uploaded_by: string;
  uploaded_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssignment {
  id: string;
  document_id: string;
  user_id: string;
  user_email?: string;
  assigned_by: string | null;
  assigned_at: string;
  viewed_at: string | null;
  downloaded_at: string | null;
}

// Fetch all documents (for admins)
export function useAdminDocuments() {
  return useQuery({
    queryKey: ["admin-shared-documents"],
    queryFn: async (): Promise<SharedDocument[]> => {
      const { data, error } = await supabase
        .from("shared_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch documents assigned to current user
export function useMyDocuments() {
  return useQuery({
    queryKey: ["my-shared-documents"],
    queryFn: async (): Promise<SharedDocument[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get public documents
      const { data: publicDocs } = await supabase
        .from("shared_documents")
        .select("*")
        .eq("is_public", true);

      // Get assigned documents
      const { data: assignments } = await supabase
        .from("shared_document_assignments")
        .select("document_id")
        .eq("user_id", user.id);

      const assignedIds = (assignments || []).map(a => a.document_id);
      
      let assignedDocs: SharedDocument[] = [];
      if (assignedIds.length > 0) {
        const { data } = await supabase
          .from("shared_documents")
          .select("*")
          .in("id", assignedIds);
        assignedDocs = data || [];
      }

      // Combine and deduplicate
      const allDocs = [...(publicDocs || []), ...assignedDocs];
      const uniqueDocs = allDocs.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );

      return uniqueDocs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });
}

// Fetch assignments for a document
export function useDocumentAssignments(documentId: string) {
  return useQuery({
    queryKey: ["shared-document-assignments", documentId],
    queryFn: async (): Promise<DocumentAssignment[]> => {
      const { data: assignments, error } = await supabase
        .from("shared_document_assignments")
        .select("*")
        .eq("document_id", documentId);

      if (error) throw error;

      // Get user emails
      const userIds = (assignments || []).map(a => a.user_id);
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, email")
        .in("user_id", userIds);

      const emailMap = new Map((userRoles || []).map(u => [u.user_id, u.email]));

      return (assignments || []).map(a => ({
        ...a,
        user_email: emailMap.get(a.user_id) || "Unknown",
      }));
    },
    enabled: !!documentId,
  });
}

// Upload document
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      file, 
      title, 
      description, 
      category, 
      isPublic,
      assignedUserIds 
    }: { 
      file: File; 
      title: string; 
      description?: string;
      category?: string;
      isPublic?: boolean;
      assignedUserIds?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("shared-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: doc, error: docError } = await supabase
        .from("shared_documents")
        .insert({
          title,
          description: description || null,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          category: category || "general",
          is_public: isPublic || false,
          uploaded_by: user.id,
          uploaded_by_email: user.email,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Create assignments if not public and users specified
      if (!isPublic && assignedUserIds && assignedUserIds.length > 0) {
        const assignments = assignedUserIds.map(userId => ({
          document_id: doc.id,
          user_id: userId,
          assigned_by: user.id,
        }));

        const { error: assignError } = await supabase
          .from("shared_document_assignments")
          .insert(assignments);

        if (assignError) throw assignError;
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shared-documents"] });
      queryClient.invalidateQueries({ queryKey: ["my-shared-documents"] });
    },
  });
}

// Delete document
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      // Get document to find file path
      const { data: doc } = await supabase
        .from("shared_documents")
        .select("file_path")
        .eq("id", documentId)
        .single();

      if (doc?.file_path) {
        // Delete from storage
        await supabase.storage
          .from("shared-documents")
          .remove([doc.file_path]);
      }

      // Delete document (assignments cascade)
      const { error } = await supabase
        .from("shared_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-shared-documents"] });
      queryClient.invalidateQueries({ queryKey: ["my-shared-documents"] });
    },
  });
}

// Assign document to users
export function useAssignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      documentId, 
      userIds 
    }: { 
      documentId: string; 
      userIds: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const assignments = userIds.map(userId => ({
        document_id: documentId,
        user_id: userId,
        assigned_by: user?.id,
      }));

      const { error } = await supabase
        .from("shared_document_assignments")
        .upsert(assignments, { onConflict: "document_id,user_id" });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shared-document-assignments", variables.documentId] });
    },
  });
}

// Remove assignment
export function useRemoveAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      documentId, 
      userId 
    }: { 
      documentId: string; 
      userId: string;
    }) => {
      const { error } = await supabase
        .from("shared_document_assignments")
        .delete()
        .eq("document_id", documentId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shared-document-assignments", variables.documentId] });
    },
  });
}

// Get download URL
export async function getDocumentUrl(filePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("shared-documents")
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}
