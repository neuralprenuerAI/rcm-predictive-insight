import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function RecentClaims() {
  const navigate = useNavigate();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['recent-claims'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('claims')
        .select('id, claim_id, patient_name, procedure_code, approval_probability, risk_category, ai_reviewed_at')
        .eq('user_id', user.id)
        .order('ai_reviewed_at', { ascending: false, nullsFirst: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  const getRiskIcon = (level: string | null) => {
    switch (level?.toLowerCase()) {
      case 'low': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'high': return <AlertOctagon className="h-4 w-4 text-orange-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
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
              <div key={i} className="flex gap-4 items-center p-3 bg-muted/50 rounded-lg">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-12 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Claims
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/claims')}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
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
          <div className="space-y-3">
            {claims.map((claim) => (
              <div 
                key={claim.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate('/claims')}
              >
                <div className="flex items-center gap-3">
                  {getRiskIcon(claim.risk_category)}
                  <div>
                    <p className="font-medium text-sm">{claim.patient_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {claim.procedure_code || 'N/A'} • {claim.ai_reviewed_at 
                        ? format(new Date(claim.ai_reviewed_at), 'MMM d')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    (claim.approval_probability ?? 0) >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    (claim.approval_probability ?? 0) >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }
                >
                  {claim.approval_probability ?? 0}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
