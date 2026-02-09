import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  FileText, 
  Trash2, 
  Eye, 
  FileEdit,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Plus,
  Download,
  Copy,
  Shield
} from "lucide-react";
import { format } from "date-fns";

interface Claim {
  id: string;
  claim_id: string;
  patient_name: string;
  procedure_code: string | null;
  diagnosis_code: string | null;
  billed_amount: number | null;
  payer: string | null;
  status: string | null;
  approval_probability: number | null;
  risk_category: string | null;
  documentation_score: number | null;
  executive_summary: string | null;
  clinical_findings: string[] | null;
  ai_recommendations: string[] | null;
  ai_analysis: any;
  claim_filename: string | null;
  notes_filename: string | null;
  ai_reviewed_at: string | null;
  created_at: string | null;
}

export default function Claims() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [deleteClaimId, setDeleteClaimId] = useState<string | null>(null);
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<string | null>(null);
  const [letterPreview, setLetterPreview] = useState<{ letter: string; claimId: string; patientName: string } | null>(null);

  // Fetch claims
  const { data: claims, isLoading } = useQuery({
    queryKey: ['all-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', user.id)
        .order('ai_reviewed_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      return data as Claim[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.delete('claims', { id: claimId }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-claims'] });
      queryClient.invalidateQueries({ queryKey: ['recent-claims'] });
      toast.success("Claim deleted");
      setDeleteClaimId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    },
  });

  // Download letter helper
  const downloadLetter = (letter: string, patientName: string) => {
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Appeal_Letter_${patientName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Patient'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Generate letter function
  const handleGenerateLetter = async (claim: Claim, directDownload = false) => {
    setIsGeneratingLetter(claim.id);
    
    try {
      const { data, error } = await awsApi.invoke('generate-appeal-letter', {
        body: {
          claimId: claim.id,
          patientName: claim.patient_name,
          procedureCode: claim.procedure_code,
          diagnosisCode: claim.diagnosis_code,
          payer: claim.payer,
          billedAmount: claim.billed_amount,
          analysis: claim.ai_analysis,
          clinicalFindings: claim.clinical_findings,
          recommendations: claim.ai_recommendations,
          executiveSummary: claim.executive_summary,
          letterType: 'appeal',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate letter');

      if (directDownload) {
        downloadLetter(data.letter, claim.patient_name);
        toast.success("Appeal letter downloaded!");
      } else {
        setLetterPreview({ 
          letter: data.letter, 
          claimId: claim.id,
          patientName: claim.patient_name 
        });
        toast.success("Letter generated! Review before downloading.");
      }
    } catch (error) {
      console.error("Generate letter error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate letter");
    } finally {
      setIsGeneratingLetter(null);
    }
  };

  // Risk badge component
  const RiskBadge = ({ level, probability }: { level: string | null; probability: number | null }) => {
    const config: Record<string, { bg: string; icon: typeof CheckCircle2 }> = {
      low: { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
      medium: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertTriangle },
      high: { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: AlertOctagon },
      critical: { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
    };
    
    const levelKey = level?.toLowerCase() || 'medium';
    const { bg, icon: Icon } = config[levelKey] || config.medium;
    
    return (
      <Badge className={`${bg} gap-1`}>
        <Icon className="h-3 w-3" />
        {probability ?? 0}%
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Saved Claims</h1>
            <p className="text-muted-foreground">
              View and manage your analyzed claims
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/scrubber')}>
            <Shield className="h-4 w-4 mr-2" />
            Scrub New Claim
          </Button>
          <Button onClick={() => navigate('/upload')}>
            <Plus className="h-4 w-4 mr-2" />
            New Claim Analysis
          </Button>
        </div>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Claims ({claims?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : claims && claims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      {claim.patient_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-1 py-0.5 rounded text-sm">
                        {claim.procedure_code || 'N/A'}
                      </code>
                    </TableCell>
                    <TableCell>{claim.payer || 'Unknown'}</TableCell>
                    <TableCell>
                      ${(claim.billed_amount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <RiskBadge 
                        level={claim.risk_category} 
                        probability={claim.approval_probability}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {claim.ai_reviewed_at 
                        ? format(new Date(claim.ai_reviewed_at), 'MMM d, yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedClaim(claim)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleGenerateLetter(claim)}
                          disabled={isGeneratingLetter === claim.id}
                          title="Generate Appeal Letter"
                        >
                          {isGeneratingLetter === claim.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileEdit className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteClaimId(claim.id)}
                          className="text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No saved claims yet</p>
              <p className="text-sm">Upload and analyze a claim to get started</p>
              <Button 
                className="mt-4"
                onClick={() => navigate('/upload')}
              >
                Upload First Claim
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Claim Details
            </DialogTitle>
            <DialogDescription>
              {selectedClaim?.patient_name} - {selectedClaim?.procedure_code}
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {selectedClaim.approval_probability ?? 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Approval</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold">
                    {selectedClaim.documentation_score ?? 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Doc Score</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <RiskBadge 
                    level={selectedClaim.risk_category} 
                    probability={selectedClaim.approval_probability}
                  />
                  <p className="text-sm text-muted-foreground mt-1">Risk Level</p>
                </div>
              </div>

              {/* Executive Summary */}
              {selectedClaim.executive_summary && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-medium mb-2">Executive Summary</h4>
                  <p className="text-sm">{selectedClaim.executive_summary}</p>
                </div>
              )}

              {/* Clinical Findings */}
              {selectedClaim.clinical_findings && selectedClaim.clinical_findings.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">Clinical Findings</h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 list-disc list-inside space-y-1">
                    {selectedClaim.clinical_findings.map((finding: string, i: number) => (
                      <li key={i}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {selectedClaim.ai_recommendations && selectedClaim.ai_recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recommendations</h4>
                  {selectedClaim.ai_recommendations.map((rec: string, i: number) => (
                    <div key={i} className="p-3 bg-muted rounded">
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Next Steps from ai_analysis */}
              {selectedClaim.ai_analysis?.next_steps && selectedClaim.ai_analysis.next_steps.length > 0 && (
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-medium mb-2">Next Steps</h4>
                  <ol className="space-y-2">
                    {selectedClaim.ai_analysis.next_steps.map((step: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={() => handleGenerateLetter(selectedClaim)}
                  disabled={isGeneratingLetter === selectedClaim.id}
                  className="flex-1"
                >
                  {isGeneratingLetter === selectedClaim.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><FileEdit className="h-4 w-4 mr-2" /> Generate Appeal Letter</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedClaim(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteClaimId} onOpenChange={() => setDeleteClaimId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the claim and its analysis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClaimId && deleteMutation.mutate(deleteClaimId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Letter Preview Dialog */}
      <Dialog open={!!letterPreview} onOpenChange={() => setLetterPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              Appeal Letter Preview
            </DialogTitle>
            <DialogDescription>
              Review the generated letter before downloading
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-card">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {letterPreview?.letter}
            </pre>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => {
                if (letterPreview) {
                  downloadLetter(letterPreview.letter, letterPreview.patientName);
                  toast.success("Letter downloaded!");
                }
              }}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Letter
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (letterPreview) {
                  navigator.clipboard.writeText(letterPreview.letter);
                  toast.success("Letter copied to clipboard!");
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" onClick={() => setLetterPreview(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
