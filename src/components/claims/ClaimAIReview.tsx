import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Loader2, 
  RefreshCw, 
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { AIRiskBadge } from "./AIRiskBadge";
import { ClaimDocumentLinker } from "./ClaimDocumentLinker";
import { AIRecommendations } from "./AIRecommendations";
import { formatDistanceToNow } from "date-fns";

interface ClaimAIReviewProps {
  claimId: string;
  claimStatus?: string;
}

export function ClaimAIReview({ claimId, claimStatus }: ClaimAIReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing AI analysis
  const { data: claim, isLoading: loadingClaim } = useQuery({
    queryKey: ['claim-ai-analysis', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('ai_analysis, deniability_probability, risk_category, ai_reviewed_at')
        .eq('id', claimId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // AI Review mutation
  const reviewMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const isDenied = claimStatus?.toLowerCase().includes('denied');

      const response = await awsApi.invoke('ai-claim-review', {
        body: {
          claimId,
          includeAppealStrategy: isDenied,
          denialReasons: isDenied ? [claimStatus] : [],
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claim-ai-analysis', claimId] });
      setIsExpanded(true);
      toast({
        title: "AI Review Complete",
        description: `Approval probability: ${data.review.approval_probability}%`,
      });
    },
    onError: (error) => {
      toast({
        title: "Review Failed",
        description: error instanceof Error ? error.message : "Failed to complete AI review",
        variant: "destructive",
      });
    },
  });

  const analysis = claim?.ai_analysis as any;
  const hasAnalysis = !!analysis;

  // Map risk_category to risk level
  const getRiskLevel = () => {
    if (claim?.risk_category) {
      const category = claim.risk_category.toLowerCase();
      if (category === 'low') return 'low';
      if (category === 'medium') return 'medium';
      if (category === 'high') return 'high';
      if (category === 'critical') return 'critical';
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Claim Review
          </CardTitle>
          <div className="flex items-center gap-2">
            <AIRiskBadge 
              riskScore={claim?.deniability_probability} 
              riskLevel={getRiskLevel() as any}
              isLoading={reviewMutation.isPending}
            />
            <Button
              variant={hasAnalysis ? "outline" : "default"}
              size="sm"
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : hasAnalysis ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-analyze
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Run AI Review
                </>
              )}
            </Button>
          </div>
        </div>
        
        {claim?.ai_reviewed_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last reviewed {formatDistanceToNow(new Date(claim.ai_reviewed_at), { addSuffix: true })}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Document Linker */}
        <ClaimDocumentLinker 
          claimId={claimId}
          onDocumentsChanged={() => {
            // Optionally re-run analysis when documents change
          }}
        />
        
        <Separator />

        {/* Analysis Results */}
        {loadingClaim ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasAnalysis ? (
          <div className="space-y-4">
            {/* Summary Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold text-green-600">
                  {analysis.approval_probability}%
                </p>
                <p className="text-xs text-muted-foreground">Approval Rate</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">
                  {analysis.clinical_support_analysis?.documentation_score || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Doc Score</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <p className="text-2xl font-bold">
                  {analysis.coding_analysis?.coding_score || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Coding Score</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-2xl font-bold">
                  {analysis.critical_issues?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Issues Found</p>
              </div>
            </div>

            {/* Executive Summary */}
            {analysis.executive_summary && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">
                  {analysis.executive_summary}
                </p>
              </div>
            )}

            {/* Expandable Details */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Hide Details" : "Show Full Analysis"}
            </Button>

            {isExpanded && (
              <AIRecommendations
                criticalIssues={analysis.critical_issues}
                recommendations={analysis.recommendations}
                missingDocumentation={analysis.missing_documentation}
                nextSteps={analysis.next_steps}
                appealStrategy={analysis.appeal_strategy}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No AI analysis yet</p>
            <p className="text-sm">
              Link clinical documents and click "Run AI Review" to get insights
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
