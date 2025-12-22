import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  Shield,
  FileWarning,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DigestStats {
  totalScrubbed: number;
  criticalCount: number;
  highRiskCount: number;
  cleanCount: number;
  avgRiskScore: number;
  topIssues: { type: string; count: number }[];
  needsReview: any[];
  trend: 'improving' | 'worsening' | 'stable';
  previousDayTotal: number;
}

export function DailyDigest() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DigestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | 'week'>('yesterday');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (userId) {
      fetchDigestData();
    }
  }, [userId, selectedPeriod]);

  const fetchDigestData = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;
      let previousStartDate: Date;
      let previousEndDate: Date;

      const now = new Date();

      if (selectedPeriod === 'today') {
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        previousStartDate = startOfDay(subDays(now, 1));
        previousEndDate = endOfDay(subDays(now, 1));
      } else if (selectedPeriod === 'yesterday') {
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        previousStartDate = startOfDay(subDays(now, 2));
        previousEndDate = endOfDay(subDays(now, 2));
      } else {
        startDate = startOfDay(subDays(now, 7));
        endDate = endOfDay(now);
        previousStartDate = startOfDay(subDays(now, 14));
        previousEndDate = endOfDay(subDays(now, 7));
      }

      // Fetch current period scrubs
      const { data: scrubs, error } = await supabase
        .from('claim_scrub_results')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('denial_risk_score', { ascending: false });

      if (error) throw error;

      // Fetch previous period for comparison
      const { data: previousScrubs } = await supabase
        .from('claim_scrub_results')
        .select('id, denial_risk_score')
        .eq('user_id', userId)
        .gte('created_at', previousStartDate.toISOString())
        .lte('created_at', previousEndDate.toISOString());

      // Calculate stats
      const totalScrubbed = scrubs?.length || 0;
      const criticalCount = scrubs?.filter(s => (s.denial_risk_score || 0) >= 70).length || 0;
      const highRiskCount = scrubs?.filter(s => (s.denial_risk_score || 0) >= 50 && (s.denial_risk_score || 0) < 70).length || 0;
      const cleanCount = scrubs?.filter(s => (s.denial_risk_score || 0) < 25).length || 0;
      const avgRiskScore = totalScrubbed > 0
        ? Math.round(scrubs!.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / totalScrubbed)
        : 0;

      // Calculate trend
      const previousAvg = previousScrubs && previousScrubs.length > 0
        ? previousScrubs.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / previousScrubs.length
        : avgRiskScore;

      let trend: 'improving' | 'worsening' | 'stable' = 'stable';
      if (avgRiskScore < previousAvg - 5) trend = 'improving';
      else if (avgRiskScore > previousAvg + 5) trend = 'worsening';

      // Count issue types
      const issueCounts: Record<string, number> = {};
      scrubs?.forEach(s => {
        const issues = (s.all_issues as any[]) || [];
        issues.forEach((issue: any) => {
          const type = issue.type || 'OTHER';
          issueCounts[type] = (issueCounts[type] || 0) + 1;
        });
      });

      const topIssues = Object.entries(issueCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get claims needing review (high risk, not yet reviewed)
      const needsReview = scrubs?.filter(s => (s.denial_risk_score || 0) >= 50).slice(0, 5) || [];

      setStats({
        totalScrubbed,
        criticalCount,
        highRiskCount,
        cleanCount,
        avgRiskScore,
        topIssues,
        needsReview,
        trend,
        previousDayTotal: previousScrubs?.length || 0
      });

    } catch (error) {
      console.error('Error fetching digest:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatIssueType = (type: string) => {
    const mapping: Record<string, string> = {
      'MUE_EXCEEDED': 'MUE Limit',
      'NCCI_BUNDLE_VIOLATION': 'NCCI Bundle',
      'MODIFIER_REQUIRED': 'Missing Modifier',
      'MODIFIER_INVALID': 'Invalid Modifier',
      'MEDICAL_NECESSITY': 'Medical Necessity',
      'FREQUENCY_LIMIT_EXCEEDED': 'Frequency Limit',
      'FREQUENCY_INTERVAL_VIOLATION': 'Too Soon',
      'PAYER_RULE_VIOLATION': 'Payer Rule',
      'LCD_NCD_VIOLATION': 'LCD/NCD Issue'
    };
    return mapping[type] || type.replace(/_/g, ' ');
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'today') return "Today's";
    if (selectedPeriod === 'yesterday') return "Yesterday's";
    return "This Week's";
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalScrubbed === 0) {
    return (
      <Card className="bg-gradient-to-br from-muted/50 to-background border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-xl">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{getPeriodLabel()} Digest</h3>
                <p className="text-sm text-muted-foreground">
                  No claims scrubbed {selectedPeriod === 'today' ? 'today' : selectedPeriod === 'yesterday' ? 'yesterday' : 'this week'}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/scrubber')} className="bg-primary hover:bg-primary/90">
              <Shield className="h-4 w-4 mr-2" />
              Scrub a Claim
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">
                {getPeriodLabel()} Digest
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(selectedPeriod === 'today' ? new Date() : subDays(new Date(), selectedPeriod === 'yesterday' ? 1 : 7), 'EEEE, MMMM d')}
                {selectedPeriod === 'week' && ' - Today'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={selectedPeriod === 'today' ? 'default' : 'ghost'}
              onClick={() => setSelectedPeriod('today')}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={selectedPeriod === 'yesterday' ? 'default' : 'ghost'}
              onClick={() => setSelectedPeriod('yesterday')}
            >
              Yesterday
            </Button>
            <Button
              size="sm"
              variant={selectedPeriod === 'week' ? 'default' : 'ghost'}
              onClick={() => setSelectedPeriod('week')}
            >
              Week
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{stats.totalScrubbed}</p>
            <p className="text-xs text-muted-foreground">Claims Scrubbed</p>
          </div>
          <div className="text-center p-4 bg-destructive/10 rounded-lg">
            <p className="text-2xl font-bold text-destructive">{stats.criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical Risk</p>
          </div>
          <div className="text-center p-4 bg-orange-500/10 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{stats.highRiskCount}</p>
            <p className="text-xs text-muted-foreground">High Risk</p>
          </div>
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.cleanCount}</p>
            <p className="text-xs text-muted-foreground">Clean</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-foreground">{stats.avgRiskScore}%</p>
              {stats.trend === 'improving' && <TrendingDown className="h-4 w-4 text-green-500" />}
              {stats.trend === 'worsening' && <TrendingUp className="h-4 w-4 text-destructive" />}
            </div>
            <p className="text-xs text-muted-foreground">Avg Risk</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Issues */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              Top Issues Found
            </div>
            {stats.topIssues.length > 0 ? (
              <div className="space-y-2">
                {stats.topIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">{formatIssueType(issue.type)}</span>
                    <Badge variant="secondary">{issue.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No issues found - great job! 🎉</p>
            )}
          </div>

          {/* Needs Review */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Needs Review
            </div>
            {stats.needsReview.length > 0 ? (
              <div className="space-y-2">
                {stats.needsReview.map((claim, idx) => {
                  const claimInfo = claim.claim_info as any;
                  const patientName = claimInfo?.patient_name || 'Unknown';
                  const riskScore = claim.denial_risk_score || 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          riskScore >= 70 ? 'bg-destructive' : 'bg-orange-500'
                        }`} />
                        <span className="text-foreground truncate max-w-[150px]">
                          {patientName}
                        </span>
                      </div>
                      <Badge variant={riskScore >= 70 ? 'destructive' : 'secondary'}>
                        {riskScore}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                All claims look good!
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {stats.trend === 'improving' && (
              <span className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-4 w-4" />
                Risk scores improving vs previous period
              </span>
            )}
            {stats.trend === 'worsening' && (
              <span className="flex items-center gap-1 text-destructive">
                <TrendingUp className="h-4 w-4" />
                Risk scores higher than previous period
              </span>
            )}
            {stats.trend === 'stable' && (
              <span>Risk scores stable</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/scrub-history')}>
              <Calendar className="h-4 w-4 mr-1" />
              View All
            </Button>
            {stats.criticalCount > 0 && (
              <Button size="sm" onClick={() => navigate('/scrub-history')}>
                Review {stats.criticalCount} Critical
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DailyDigest;
