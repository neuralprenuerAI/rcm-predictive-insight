import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Paperclip, 
  FileText, 
  Trash2, 
  Plus,
  File,
  Loader2
} from "lucide-react";

interface ClaimDocumentLinkerProps {
  claimId: string;
  onDocumentsChanged?: () => void;
}

const DOCUMENT_ROLES = [
  { value: 'clinical_note', label: 'Clinical Note' },
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'operative_report', label: 'Operative Report' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'imaging_report', label: 'Imaging Report' },
  { value: 'referral', label: 'Referral' },
  { value: 'prior_auth', label: 'Prior Authorization' },
  { value: 'medical_record', label: 'Medical Record' },
  { value: 'supporting', label: 'Supporting Document' },
  { value: 'other', label: 'Other' },
];

export function ClaimDocumentLinker({ claimId, onDocumentsChanged }: ClaimDocumentLinkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('supporting');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch linked documents
  const { data: linkedDocs, isLoading: loadingLinked } = useQuery({
    queryKey: ['claim-documents', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_documents')
        .select(`
          id,
          document_role,
          documents (
            id,
            filename,
            document_type,
            status
          )
        `)
        .eq('claim_id', claimId);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch available documents (not yet linked to this claim)
  const { data: availableDocs, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-documents', claimId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all user documents
      const { data: allDocs, error: docsError } = await supabase
        .from('documents')
        .select('id, filename, document_type, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Get already linked document IDs
      const { data: linkedIds, error: linkedError } = await supabase
        .from('claim_documents')
        .select('document_id')
        .eq('claim_id', claimId);

      if (linkedError) throw linkedError;

      const linkedIdSet = new Set(linkedIds?.map(l => l.document_id) || []);
      
      // Filter out already linked
      return allDocs?.filter(doc => !linkedIdSet.has(doc.id)) || [];
    },
    enabled: isOpen,
  });

  // Link documents mutation
  const linkMutation = useMutation({
    mutationFn: async ({ documentIds, role }: { documentIds: string[], role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const inserts = documentIds.map(docId => ({
        user_id: user.id,
        claim_id: claimId,
        document_id: docId,
        document_role: role,
      }));

      await awsCrud.bulkInsert('claim_documents', inserts, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-documents', claimId] });
      queryClient.invalidateQueries({ queryKey: ['available-documents', claimId] });
      setSelectedDocs([]);
      toast({
        title: "Documents Linked",
        description: `${selectedDocs.length} document(s) linked to claim.`,
      });
      onDocumentsChanged?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to link documents",
        variant: "destructive",
      });
    },
  });

  // Unlink document mutation
  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await awsCrud.delete('claim_documents', { id: linkId }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-documents', claimId] });
      queryClient.invalidateQueries({ queryKey: ['available-documents', claimId] });
      toast({
        title: "Document Unlinked",
        description: "Document removed from claim.",
      });
      onDocumentsChanged?.();
    },
  });

  const handleLinkDocuments = () => {
    if (selectedDocs.length === 0) return;
    linkMutation.mutate({ documentIds: selectedDocs, role: selectedRole });
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Linked Documents List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Linked Documents ({linkedDocs?.length || 0})
          </h4>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Link Documents
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Link Documents to Claim</DialogTitle>
                <DialogDescription>
                  Select clinical documents to attach to this claim for AI review.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Role Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Document Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Available Documents */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Available Documents</label>
                  
                  {loadingAvailable ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableDocs && availableDocs.length > 0 ? (
                    <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                      {availableDocs.map(doc => (
                        <div 
                          key={doc.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleDocSelection(doc.id)}
                        >
                          <Checkbox 
                            checked={selectedDocs.includes(doc.id)}
                            onCheckedChange={() => toggleDocSelection(doc.id)}
                          />
                          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.document_type || 'Unknown type'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No available documents</p>
                      <p className="text-xs">Upload documents first to link them to claims</p>
                    </div>
                  )}
                </div>

                {/* Link Button */}
                <Button 
                  onClick={handleLinkDocuments}
                  disabled={selectedDocs.length === 0 || linkMutation.isPending}
                  className="w-full"
                >
                  {linkMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Link {selectedDocs.length} Document{selectedDocs.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Linked Documents */}
        {loadingLinked ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : linkedDocs && linkedDocs.length > 0 ? (
          <div className="space-y-2">
            {linkedDocs.map((link: any) => (
              <div 
                key={link.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {link.documents?.filename || 'Unknown'}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {DOCUMENT_ROLES.find(r => r.value === link.document_role)?.label || link.document_role}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => unlinkMutation.mutate(link.id)}
                  disabled={unlinkMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No documents linked. Add clinical notes for better AI analysis.
          </p>
        )}
      </div>
    </div>
  );
}
