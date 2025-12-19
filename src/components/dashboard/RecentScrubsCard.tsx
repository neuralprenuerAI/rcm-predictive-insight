import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  ArrowRight, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  FileText,
  Calendar,
  Stethoscope,
  User,
  Building2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ClaimInfo {
  patient_name?: string;
  payer?: string;
  procedures?: { cpt_code: string; units: number }[];
  icd_codes?: string[];
  billed_amount?: number;
}

interface ScrubResult {
  id: string;
  denial_risk_score: number | null;
  risk_level: string | null;
  total_issues: number | null;
  critical_count: number | null;
  high_count: number | null;
  medium_count: number | null;
  low_count: number | null;
  all_issues: any[] | null;
  corrections: any[] | null;
  claim_info: ClaimInfo | null;
  created_at: string | null;
  status: string | null;
}

export function RecentScrubsCard() {
  const navigate = useNavigate();
  const [selectedScrub, setSelectedScrub] = useState<ScrubResult | null>(null);

  const { data: scrubs, isLoading } = useQuery({
    queryKey: ['recent-scrubs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('claim_scrub_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Scrubs fetch error:', error);
        return [];
      }
      return (data || []) as ScrubResult[];
    },
  });

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'high': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default: return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
  };

  const getRiskBadge = (score: number, level: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return (
      <Badge variant="outline" className={`font-mono text-xs ${colors[level] || colors.low}`}>
        {score}%
      </Badge>
    );
  };

  const getClaimInfo = (scrub: ScrubResult): ClaimInfo => {
    return (scrub.claim_info || {}) as ClaimInfo;
  };

  const getPatientName = (scrub: ScrubResult) => {
    return getClaimInfo(scrub).patient_name || 'Unknown Patient';
  };

  const getProcedureCodes = (scrub: ScrubResult) => {
    const procedures = getClaimInfo(scrub).procedures || [];
    if (procedures.length === 0) return 'N/A';
    if (procedures.length <= 2) {
      return procedures.map(p => p.cpt_code).join(', ');
    }
    return `${procedures[0].cpt_code} +${procedures.length - 1} more`;
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Recent Scrubs
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/scrubber')}
              className="h-7 text-xs"
            >
              New Scrub
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : scrubs && scrubs.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {scrubs.map((scrub) => (
                  <div
                    key={scrub.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedScrub(scrub)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {getRiskIcon(scrub.risk_level || 'low')}
                        <div className="space-y-1">
                          <p className="font-medium text-sm leading-none">
                            {getPatientName(scrub)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {getProcedureCodes(scrub)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRiskBadge(scrub.denial_risk_score || 0, scrub.risk_level || 'low')}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScrub(scrub);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {scrub.total_issues || 0} issues
                        </span>
                        <span>
                          {getClaimInfo(scrub).payer || 'Unknown Payer'}
                        </span>
                      </div>
                      <span>
                        {scrub.created_at ? formatDistanceToNow(new Date(scrub.created_at), { addSuffix: true }) : 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-sm">No scrubs yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Scrub your first claim to prevent denials
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => navigate('/scrubber')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Scrub First Claim
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedScrub} onOpenChange={() => setSelectedScrub(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedScrub && getRiskIcon(selectedScrub.risk_level || 'low')}
              Scrub Results
            </DialogTitle>
          </DialogHeader>
          
          {selectedScrub && (
            <div className="space-y-6">
              {/* Risk Score Header */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Denial Risk Score</p>
                  <p className={`text-4xl font-bold ${
                    (selectedScrub.denial_risk_score || 0) >= 70 ? 'text-red-600' :
                    (selectedScrub.denial_risk_score || 0) >= 50 ? 'text-orange-500' :
                    (selectedScrub.denial_risk_score || 0) >= 25 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {selectedScrub.denial_risk_score || 0}%
                  </p>
                </div>
                <Badge className={`text-sm px-3 py-1 ${
                  selectedScrub.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                  selectedScrub.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                  selectedScrub.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {(selectedScrub.risk_level || 'low').toUpperCase()} RISK
                </Badge>
              </div>

              {/* Claim Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Patient
                  </p>
                  <p className="font-medium">{getPatientName(selectedScrub)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Payer
                  </p>
                  <p className="font-medium">{getClaimInfo(selectedScrub).payer || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPT Codes</p>
                  <p className="font-mono text-xs">
                    {getClaimInfo(selectedScrub).procedures?.map(p => p.cpt_code).join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">ICD Codes</p>
                  <p className="font-mono text-xs">
                    {getClaimInfo(selectedScrub).icd_codes?.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Scrubbed
                  </p>
                  <p className="text-xs">
                    {selectedScrub.created_at ? format(new Date(selectedScrub.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Issue Counts */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded bg-red-50 border border-red-100">
                  <p className="text-lg font-bold text-red-600">{selectedScrub.critical_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="p-2 rounded bg-orange-50 border border-orange-100">
                  <p className="text-lg font-bold text-orange-600">{selectedScrub.high_count || 0}</p>
                  <p className="text-xs text-muted-foreground">High</p>
                </div>
                <div className="p-2 rounded bg-yellow-50 border border-yellow-100">
                  <p className="text-lg font-bold text-yellow-600">{selectedScrub.medium_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Medium</p>
                </div>
                <div className="p-2 rounded bg-green-50 border border-green-100">
                  <p className="text-lg font-bold text-green-600">{selectedScrub.low_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Low</p>
                </div>
              </div>

              {/* Issues List */}
              {selectedScrub.all_issues && selectedScrub.all_issues.length > 0 ? (
                <div className="space-y-3">
                  <p className="font-medium text-sm">Issues Found</p>
                  <ScrollArea className="h-[200px]">
                    {selectedScrub.all_issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded border mb-2 last:mb-0"
                      >
                        <div className="flex items-start gap-2">
                          {issue.severity === 'critical' ? <XCircle className="h-4 w-4 text-red-600 mt-0.5" /> :
                           issue.severity === 'high' ? <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" /> :
                           issue.severity === 'medium' ? <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" /> :
                           <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />}
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {issue.code || issue.code_pair?.join(' + ') || issue.type}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {issue.message}
                            </p>
                            {issue.correction && (
                              <p className="text-xs text-green-700 bg-green-50 p-2 rounded mt-2">
                                💡 {issue.correction}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-6 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800">All Checks Passed!</p>
                  <p className="text-sm text-green-600">Claim is ready to submit</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/scrubber')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  New Scrub
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setSelectedScrub(null)}
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
