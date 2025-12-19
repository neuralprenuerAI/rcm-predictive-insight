import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  FileCheck,
  Loader2
} from "lucide-react";

export function ScrubberStatsCard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['scrubber-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('claim_scrub_results')
        .select('denial_risk_score, risk_level, critical_count, high_count, total_issues, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Stats fetch error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          total: 0,
          highRisk: 0,
          clean: 0,
          avgRisk: 0,
          totalIssues: 0,
          recentTrend: 'neutral'
        };
      }

      const total = data.length;
      const highRisk = data.filter(d => d.risk_level === 'high' || d.risk_level === 'critical').length;
      const clean = data.filter(d => d.risk_level === 'low' && d.total_issues === 0).length;
      const avgRisk = Math.round(data.reduce((sum, d) => sum + (d.denial_risk_score || 0), 0) / total);
      const totalIssues = data.reduce((sum, d) => sum + (d.total_issues || 0), 0);

      const midpoint = Math.floor(total / 2);
      const recentAvg = data.slice(0, midpoint).reduce((sum, d) => sum + (d.denial_risk_score || 0), 0) / Math.max(midpoint, 1);
      const olderAvg = data.slice(midpoint).reduce((sum, d) => sum + (d.denial_risk_score || 0), 0) / Math.max(total - midpoint, 1);
      const recentTrend = recentAvg < olderAvg ? 'improving' : recentAvg > olderAvg ? 'worsening' : 'neutral';

      return { total, highRisk, clean, avgRisk, totalIssues, recentTrend };
    },
  });

  const getRiskColor = (risk: number) => {
    if (risk >= 70) return 'text-red-600';
    if (risk >= 50) return 'text-orange-500';
    if (risk >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (risk: number) => {
    if (risk >= 70) return 'bg-red-500';
    if (risk >= 50) return 'bg-orange-500';
    if (risk >= 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Claim Scrubber
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/scrubber')}
            className="h-7 text-xs"
          >
            Open
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats && stats.total > 0 ? (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <FileCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Scrubbed</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold">{stats.totalIssues}</p>
                <p className="text-xs text-muted-foreground">Issues Found</p>
              </div>
            </div>

            {/* Risk Breakdown */}
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  High Risk
                </span>
                <span className="font-medium">{stats.highRisk}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Clean
                </span>
                <span className="font-medium">{stats.clean}</span>
              </div>
            </div>

            {/* Average Risk Score */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg. Risk Score</span>
                <span className={`font-medium ${getRiskColor(stats.avgRisk)}`}>
                  {stats.avgRisk}%
                </span>
              </div>
              <div className="relative">
                <Progress value={stats.avgRisk} className="h-2" />
                <div 
                  className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(stats.avgRisk)}`}
                  style={{ width: `${stats.avgRisk}%` }}
                />
              </div>
              {stats.recentTrend === 'improving' && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Risk scores improving
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No scrubs yet</p>
            <p className="text-xs text-muted-foreground mb-3">Start scrubbing claims to see stats</p>
            <Button
              size="sm"
              onClick={() => navigate('/scrubber')}
            >
              <FileCheck className="h-4 w-4 mr-1" />
              Scrub First Claim
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
