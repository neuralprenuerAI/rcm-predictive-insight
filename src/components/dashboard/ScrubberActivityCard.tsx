import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  ArrowRight,
  FileCheck,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface ClaimInfo {
  patientName?: string;
  payer?: string;
  procedures?: Array<{ cptCode?: string }>;
}

export function ScrubberActivityCard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalScrubbed: 0,
    issuesFound: 0,
    highRisk: 0,
    clean: 0,
    avgRiskScore: 0,
    trend: 'stable' as 'improving' | 'worsening' | 'stable'
  });
  const [recentScrubs, setRecentScrubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScrub, setSelectedScrub] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: scrubs, error } = await supabase
        .from('claim_scrub_results')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const totalScrubbed = scrubs?.length || 0;
      let issuesFound = 0;
      let highRisk = 0;
      let clean = 0;
      let totalRisk = 0;

      scrubs?.forEach(s => {
        const issues = (s.critical_count || 0) + (s.high_count || 0) + 
                      (s.medium_count || 0) + (s.low_count || 0);
        issuesFound += issues;
        const riskScore = s.denial_risk_score || 0;
        totalRisk += riskScore;
        
        if (riskScore >= 50) highRisk++;
        else if (riskScore < 25) clean++;
      });

      const avgRiskScore = totalScrubbed > 0 ? Math.round(totalRisk / totalScrubbed) : 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentItems = scrubs?.filter(s => new Date(s.created_at) >= sevenDaysAgo) || [];
      const olderItems = scrubs?.filter(s => new Date(s.created_at) < sevenDaysAgo) || [];
      
      const recentAvg = recentItems.length > 0 
        ? recentItems.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / recentItems.length 
        : 0;
      const olderAvg = olderItems.length > 0 
        ? olderItems.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / olderItems.length 
        : avgRiskScore;

      let trend: 'improving' | 'worsening' | 'stable' = 'stable';
      if (recentAvg < olderAvg - 5) trend = 'improving';
      else if (recentAvg > olderAvg + 5) trend = 'worsening';

      setStats({ totalScrubbed, issuesFound, highRisk, clean, avgRiskScore, trend });
      setRecentScrubs(scrubs?.slice(0, 5) || []);

    } catch (error) {
      console.error('Error fetching scrubber data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClaimInfo = (scrub: any): ClaimInfo => {
    const info = scrub.claim_info as ClaimInfo | null;
    return {
      patientName: info?.patientName || 'Unknown Patient',
      payer: info?.payer || 'Unknown Payer',
      procedures: info?.procedures || []
    };
  };

  const handleViewScrub = (scrub: any) => {
    setSelectedScrub(scrub);
    setDetailModalOpen(true);
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-destructive bg-destructive/10';
    if (score >= 50) return 'text-orange-600 bg-orange-100';
    if (score >= 25) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRiskIcon = (score: number) => {
    if (score >= 50) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading scrubber data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" />
              Scrubber Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/scrubber')}
              className="text-primary"
            >
              Open
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-semibold">{stats.totalScrubbed}</p>
                <p className="text-xs text-muted-foreground">Scrubbed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-lg font-semibold">{stats.issuesFound}</p>
                <p className="text-xs text-muted-foreground">Issues Found</p>
              </div>
            </div>
          </div>

          {/* Risk Summary */}
          <div className="flex gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-3 w-3 mr-1" />
              High Risk: {stats.highRisk}
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Clean: {stats.clean}
            </Badge>
          </div>

          {/* Average Risk Score */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg. Risk Score</span>
              <span className={`font-semibold ${
                stats.avgRiskScore >= 50 ? 'text-orange-600' : 'text-green-600'
              }`}>
                {stats.avgRiskScore}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  stats.avgRiskScore >= 70 ? 'bg-destructive' :
                  stats.avgRiskScore >= 50 ? 'bg-orange-500' :
                  stats.avgRiskScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${stats.avgRiskScore}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {stats.trend === 'improving' && (
                <>
                  <TrendingDown className="h-3 w-3 text-green-500" />
                  <span>Risk scores improving</span>
                </>
              )}
              {stats.trend === 'worsening' && (
                <>
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                  <span>Risk scores increasing</span>
                </>
              )}
              {stats.trend === 'stable' && (
                <span>Risk scores stable</span>
              )}
            </div>
          </div>

          {recentScrubs.length > 0 && <hr className="border-border" />}

          {/* Recent Scrubs List */}
          {recentScrubs.length > 0 && (
            <div className="space-y-2">
              {recentScrubs.map((scrub) => {
                const claimInfo = getClaimInfo(scrub);
                const riskScore = scrub.denial_risk_score || 0;
                const cptCodes = claimInfo.procedures?.map(p => p.cptCode).filter(Boolean).join(', ') || 'No CPT';
                
                return (
                  <div 
                    key={scrub.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewScrub(scrub)}
                  >
                    <div className="flex items-center gap-3">
                      {getRiskIcon(riskScore)}
                      <div>
                        <p className="text-sm font-medium">
                          {claimInfo.patientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cptCodes} • {claimInfo.payer}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRiskColor(riskScore)}>
                        {riskScore}%
                      </Badge>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {recentScrubs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No scrubs yet. Use the Claim Scrubber to analyze claims.
            </p>
          )}

          {recentScrubs.length > 0 && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/scrub-history')}
            >
              View All Scrubs
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scrub Result Details</DialogTitle>
          </DialogHeader>
          {selectedScrub && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{getClaimInfo(selectedScrub).patientName}</p>
                  <p className="text-sm text-muted-foreground">{getClaimInfo(selectedScrub).payer}</p>
                </div>
                <Badge className={getRiskColor(selectedScrub.denial_risk_score || 0)}>
                  {selectedScrub.denial_risk_score || 0}% Risk
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-red-50 rounded">
                  <p className="font-semibold text-red-600">{selectedScrub.critical_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="p-2 bg-orange-50 rounded">
                  <p className="font-semibold text-orange-600">{selectedScrub.high_count || 0}</p>
                  <p className="text-xs text-muted-foreground">High</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded">
                  <p className="font-semibold text-yellow-600">{selectedScrub.medium_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Medium</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="font-semibold text-blue-600">{selectedScrub.low_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Low</p>
                </div>
              </div>

              {selectedScrub.all_issues?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Issues Found:</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {(selectedScrub.all_issues as any[]).map((issue: any, idx: number) => (
                      <div key={idx} className="p-2 bg-muted/50 rounded text-sm">
                        <p>{issue.message}</p>
                        {issue.correction && (
                          <p className="text-xs text-primary mt-1">💡 {issue.correction}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Scrubbed {formatDistanceToNow(new Date(selectedScrub.created_at))} ago
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ScrubberActivityCard;
