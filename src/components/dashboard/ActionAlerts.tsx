import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { awsCrud } from '@/lib/awsCrud';
import { 
  AlertTriangle, 
  Clock, 
  FileX, 
  Shield,
  ChevronRight,
  Bell,
  CheckCircle,
  X,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface ActionAlert {
  id: string;
  type: 'critical_risk' | 'high_risk' | 'needs_correction' | 'pending_outcome' | 'filing_deadline';
  priority: 'urgent' | 'high' | 'medium';
  title: string;
  description: string;
  patient_name?: string;
  payer?: string;
  risk_score?: number;
  created_at: string;
  action_url?: string;
  scrub_id?: string;
  dismissed?: boolean;
}

export function ActionAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<ActionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (userId) {
      fetchAlerts();
    }
  }, [userId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const alertsList: ActionAlert[] = [];

      const [allScrubs, allOutcomes] = await Promise.all([
        awsCrud.select('claim_scrub_results', userId),
        awsCrud.select('denial_outcomes', userId),
      ]);

      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      const recentScrubs = (allScrubs || []).filter(s => s.created_at >= sevenDaysAgo);

      // 1. Critical risk scrubs (score >= 70, last 7 days)
      const criticalScrubs = recentScrubs
        .filter(s => (s.denial_risk_score || 0) >= 70)
        .sort((a, b) => (b.denial_risk_score || 0) - (a.denial_risk_score || 0))
        .slice(0, 5);

      criticalScrubs.forEach(scrub => {
        const claimInfo = scrub.claim_info as any;
        alertsList.push({
          id: `critical-${scrub.id}`,
          type: 'critical_risk',
          priority: 'urgent',
          title: 'Critical Risk Claim',
          description: `${scrub.denial_risk_score}% denial risk - requires review before submission`,
          patient_name: claimInfo?.patient_name,
          payer: claimInfo?.payer,
          risk_score: scrub.denial_risk_score || 0,
          created_at: scrub.created_at || '',
          scrub_id: scrub.id
        });
      });

      // 2. High risk scrubs needing correction (score 50-70, last 7 days)
      const highRiskScrubs = recentScrubs
        .filter(s => (s.denial_risk_score || 0) >= 50 && (s.denial_risk_score || 0) < 70)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      highRiskScrubs.forEach(scrub => {
        const issueCount = (scrub.critical_count || 0) + (scrub.high_count || 0) +
                          (scrub.medium_count || 0) + (scrub.low_count || 0);
        if (issueCount > 0) {
          const claimInfo = scrub.claim_info as any;
          alertsList.push({
            id: `high-${scrub.id}`,
            type: 'needs_correction',
            priority: 'high',
            title: 'Corrections Needed',
            description: `${issueCount} issue${issueCount > 1 ? 's' : ''} found - apply corrections before billing`,
            patient_name: claimInfo?.patient_name,
            payer: claimInfo?.payer,
            risk_score: scrub.denial_risk_score || 0,
            created_at: scrub.created_at || '',
            scrub_id: scrub.id
          });
        }
      });

      // 3. Older scrubs needing outcome tracking (14-30 days old)
      const olderScrubs = (allScrubs || [])
        .filter(s => s.created_at >= thirtyDaysAgo && s.created_at <= fourteenDaysAgo)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      if (olderScrubs.length > 0) {
        const outcomeIds = new Set((allOutcomes || []).map((o: any) => o.scrub_result_id));
        olderScrubs.filter(s => !outcomeIds.has(s.id)).slice(0, 3).forEach(scrub => {
          const claimInfo = scrub.claim_info as any;
          alertsList.push({
            id: `outcome-${scrub.id}`,
            type: 'pending_outcome',
            priority: 'medium',
            title: 'Record Outcome',
            description: 'Claim submitted 14-30 days ago - record the payer outcome',
            patient_name: claimInfo?.patient_name,
            payer: claimInfo?.payer,
            risk_score: scrub.denial_risk_score || 0,
            created_at: scrub.created_at || '',
            scrub_id: scrub.id
          });
        });
      }

      setAlerts(alertsList.sort((a, b) => {
        const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (priority[a.priority] || 3) - (priority[b.priority] || 3);
      }));
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
  };

  const handleAction = (alert: ActionAlert) => {
    if (alert.scrub_id) {
      navigate('/scrub-history');
    }
  };

  const getAlertIcon = (type: ActionAlert['type']) => {
    switch (type) {
      case 'critical_risk':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'high_risk':
        return <Shield className="h-5 w-5 text-orange-500" />;
      case 'needs_correction':
        return <FileX className="h-5 w-5 text-orange-500" />;
      case 'pending_outcome':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'filing_deadline':
        return <Zap className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityStyles = (priority: ActionAlert['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-l-destructive bg-destructive/5';
      case 'high':
        return 'border-l-4 border-l-orange-500 bg-orange-500/5';
      case 'medium':
        return 'border-l-4 border-l-blue-500 bg-blue-500/5';
      default:
        return 'border-l-4 border-l-muted bg-muted/50';
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">All Clear!</h3>
              <p className="text-sm text-muted-foreground">
                No action items requiring attention right now.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Action Required</CardTitle>
            <Badge variant="destructive" className="ml-1">
              {visibleAlerts.length}
            </Badge>
          </div>
          {visibleAlerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => navigate('/scrub-history')}
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {visibleAlerts.slice(0, 5).map(alert => (
            <div
              key={alert.id}
              className={`relative group p-3 rounded-lg transition-all ${getPriorityStyles(alert.priority)}`}
            >
              <button
                onClick={() => handleDismiss(alert.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background/50 rounded"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {alert.title}
                    </span>
                    {alert.risk_score && (
                      <Badge
                        variant={alert.risk_score >= 70 ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {alert.risk_score}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {alert.description}
                  </p>
                  {alert.patient_name && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {alert.patient_name} • {alert.payer}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(alert)}
                  className="shrink-0"
                >
                  Review
                </Button>
              </div>
            </div>
          ))}

          {visibleAlerts.length > 5 && (
            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => navigate('/scrub-history')}
            >
              +{visibleAlerts.length - 5} more alerts
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ActionAlerts;
