import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileText, 
  Eye, 
  Loader2,
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  XCircle 
} from "lucide-react";

interface Claim {
  id: string;
  claim_id: string;
  patient_name: string | null;
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
  ai_analysis: any;
}

export default function RecentClaims() {
  const navigate = useNavigate();
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['recent-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', user.id)
        .order('ai_reviewed_at', { ascending: false, nullsFirst: false })
        .limit(5);
      
      if (error) throw error;
      return (data || []) as Claim[];
    }
  });

  const ApprovalBadge = ({ probability, riskLevel }: { probability: number | null; riskLevel: string | null }) => {
    if (probability === null && probability !== 0) {
      return <Badge variant="outline" className="text-muted-foreground">Not Analyzed</Badge>;
    }

    const config: Record<string, { bg: string; icon: typeof CheckCircle2 }> = {
      low: { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
      medium: { bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertTriangle },
      high: { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: AlertOctagon },
      critical: { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
    };

    const prob = probability ?? 0;
    const level = riskLevel?.toLowerCase() || 
      (prob >= 70 ? 'low' : prob >= 50 ? 'medium' : prob >= 30 ? 'high' : 'critical');
    
    const { bg, icon: Icon } = config[level] || config.medium;

    return (
      <Badge className={`${bg} gap-1`}>
        <Icon className="h-3 w-3" />
        {prob}%
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Claims
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-14 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Claims
          </CardTitle>
          <Button 
            onClick={() => navigate('/claims')}
            size="sm"
          >
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No claims analyzed yet</p>
              <Button 
                variant="link" 
                size="sm"
                onClick={() => navigate('/upload')}
              >
                Upload your first claim
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-mono text-sm">
                      {claim.claim_id?.substring(0, 12) || `CLM-${claim.id?.substring(0, 6)}`}
                    </TableCell>
                    <TableCell className="font-medium">
                      {claim.patient_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      ${(claim.billed_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge 
                        probability={claim.approval_probability} 
                        riskLevel={claim.risk_category}
                      />
                    </TableCell>
                    <TableCell>{claim.payer || '-'}</TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedClaim(claim)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Claim Details Dialog */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Claim Details
            </DialogTitle>
            <DialogDescription>
              {selectedClaim?.patient_name} - {selectedClaim?.procedure_code || 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {selectedClaim.approval_probability ?? 'N/A'}%
                  </p>
                  <p className="text-xs text-muted-foreground">Approval</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">
                    {selectedClaim.documentation_score ?? 'N/A'}%
                  </p>
                  <p className="text-xs text-muted-foreground">Doc Score</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <ApprovalBadge 
                    probability={selectedClaim.approval_probability}
                    riskLevel={selectedClaim.risk_category}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Risk</p>
                </div>
              </div>

              {/* Claim Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="ml-2 font-medium">{selectedClaim.patient_name || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Payer:</span>
                  <span className="ml-2 font-medium">{selectedClaim.payer || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Procedure:</span>
                  <span className="ml-2 font-mono">{selectedClaim.procedure_code || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Diagnosis:</span>
                  <span className="ml-2 font-mono">{selectedClaim.diagnosis_code || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Billed:</span>
                  <span className="ml-2 font-medium">
                    ${(selectedClaim.billed_amount ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="ml-2">
                    {selectedClaim.status || 'pending'}
                  </Badge>
                </div>
              </div>

              {/* Executive Summary */}
              {selectedClaim.executive_summary && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm font-medium mb-1">Executive Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedClaim.executive_summary}
                  </p>
                </div>
              )}

              {/* Clinical Findings */}
              {selectedClaim.clinical_findings && selectedClaim.clinical_findings.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">Clinical Findings</p>
                  <ul className="text-sm text-green-700 dark:text-green-300 list-disc list-inside">
                    {selectedClaim.clinical_findings.map((finding: string, i: number) => (
                      <li key={i}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps from ai_analysis */}
              {selectedClaim.ai_analysis?.next_steps && selectedClaim.ai_analysis.next_steps.length > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium mb-2">Next Steps</p>
                  <ol className="space-y-1">
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

              {/* No Analysis Message */}
              {!selectedClaim.approval_probability && !selectedClaim.executive_summary && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>This claim hasn't been analyzed yet.</p>
                  <Button 
                    variant="link"
                    onClick={() => {
                      setSelectedClaim(null);
                      navigate('/upload');
                    }}
                  >
                    Re-upload to get AI analysis
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedClaim(null);
                    navigate('/claims');
                  }}
                >
                  View All Claims
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
    </>
  );
}
