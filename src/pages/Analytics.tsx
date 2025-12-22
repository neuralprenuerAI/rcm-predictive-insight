import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  Shield,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Loader2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

interface ClaimInfo {
  patient_name?: string;
  payer?: string;
  procedures?: { cpt_code: string; units: number }[];
  icd_codes?: string[];
  billed_amount?: number;
}

interface ScrubResult {
  id: string;
  denial_risk_score: number;
  risk_level: string;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  mue_issues: any[] | null;
  ncci_issues: any[] | null;
  modifier_issues: any[] | null;
  necessity_issues: any[] | null;
  payer_issues: any[] | null;
  claim_info: ClaimInfo | null;
  created_at: string;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("30");

  const { data: scrubs, isLoading } = useQuery({
    queryKey: ['scrub-analytics', timeRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const daysAgo = parseInt(timeRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      const { data, error } = await supabase
        .from('claim_scrub_results')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Analytics fetch error:', error);
        return [];
      }
      return (data || []).map(item => ({
        ...item,
        claim_info: item.claim_info as ClaimInfo | null,
        mue_issues: (item.mue_issues || []) as any[],
        ncci_issues: (item.ncci_issues || []) as any[],
        modifier_issues: (item.modifier_issues || []) as any[],
        necessity_issues: (item.necessity_issues || []) as any[],
        payer_issues: (item.payer_issues || []) as any[],
      })) as ScrubResult[];
    },
  });

  // Calculate analytics data
  const analytics = {
    total: scrubs?.length || 0,
    avgRisk: scrubs?.length 
      ? Math.round(scrubs.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / scrubs.length)
      : 0,
    totalIssues: scrubs?.reduce((sum, s) => sum + (s.total_issues || 0), 0) || 0,
    cleanClaims: scrubs?.filter(s => s.total_issues === 0).length || 0,
    criticalCount: scrubs?.reduce((sum, s) => sum + (s.critical_count || 0), 0) || 0,
    highCount: scrubs?.reduce((sum, s) => sum + (s.high_count || 0), 0) || 0,
    
    // Risk distribution
    riskDistribution: [
      { name: 'Critical', value: scrubs?.filter(s => s.risk_level === 'critical').length || 0, color: '#ef4444' },
      { name: 'High', value: scrubs?.filter(s => s.risk_level === 'high').length || 0, color: '#f97316' },
      { name: 'Medium', value: scrubs?.filter(s => s.risk_level === 'medium').length || 0, color: '#eab308' },
      { name: 'Low', value: scrubs?.filter(s => s.risk_level === 'low').length || 0, color: '#22c55e' },
    ],

    // Issue type breakdown
    issueTypes: [
      { name: 'MUE', value: scrubs?.reduce((sum, s) => sum + (s.mue_issues?.length || 0), 0) || 0 },
      { name: 'NCCI', value: scrubs?.reduce((sum, s) => sum + (s.ncci_issues?.length || 0), 0) || 0 },
      { name: 'Modifier', value: scrubs?.reduce((sum, s) => sum + (s.modifier_issues?.length || 0), 0) || 0 },
      { name: 'Necessity', value: scrubs?.reduce((sum, s) => sum + (s.necessity_issues?.length || 0), 0) || 0 },
      { name: 'Payer', value: scrubs?.reduce((sum, s) => sum + (s.payer_issues?.length || 0), 0) || 0 },
    ],
  };

  // Daily trend data
  const getDailyTrend = () => {
    if (!scrubs || scrubs.length === 0) return [];

    const days = parseInt(timeRange);
    const interval = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date(),
    });

    return interval.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayScrubs = scrubs.filter(s => {
        const scrubDate = new Date(s.created_at);
        return scrubDate >= dayStart && scrubDate < dayEnd;
      });

      const avgRisk = dayScrubs.length > 0
        ? Math.round(dayScrubs.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / dayScrubs.length)
        : 0;

      return {
        date: format(date, 'MMM d'),
        scrubs: dayScrubs.length,
        avgRisk,
        issues: dayScrubs.reduce((sum, s) => sum + (s.total_issues || 0), 0),
      };
    });
  };

  const dailyTrend = getDailyTrend();

  // Payer breakdown
  const getPayerBreakdown = () => {
    if (!scrubs || scrubs.length === 0) return [];

    const payerMap = new Map<string, { count: number; totalRisk: number; issues: number }>();
    
    scrubs.forEach(s => {
      const payer = s.claim_info?.payer || 'Unknown';
      const existing = payerMap.get(payer) || { count: 0, totalRisk: 0, issues: 0 };
      payerMap.set(payer, {
        count: existing.count + 1,
        totalRisk: existing.totalRisk + (s.denial_risk_score || 0),
        issues: existing.issues + (s.total_issues || 0),
      });
    });

    return Array.from(payerMap.entries())
      .map(([name, data]) => ({
        name,
        claims: data.count,
        avgRisk: Math.round(data.totalRisk / data.count),
        issues: data.issues,
      }))
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 6);
  };

  const payerBreakdown = getPayerBreakdown();

  // Estimated savings (avg $50 per prevented denial)
  const estimatedSavings = analytics.totalIssues * 50;

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Insights and trends from your claim scrubbing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/scrubber')}>
            <Shield className="h-4 w-4 mr-2" />
            New Scrub
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">Scrubbed</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{analytics.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Avg Risk</span>
                </div>
                <p className={`text-2xl font-bold ${
                  analytics.avgRisk >= 50 ? 'text-red-600' :
                  analytics.avgRisk >= 25 ? 'text-yellow-600' : 'text-green-600'
                }`}>{analytics.avgRisk}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Issues Found</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{analytics.totalIssues}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs">Clean Claims</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{analytics.cleanClaims}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Critical+High</span>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {analytics.criticalCount + analytics.highCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Est. Savings</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  ${estimatedSavings.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  Daily Scrub Trend
                </CardTitle>
                <CardDescription>Claims scrubbed and average risk over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="scrubs" name="Scrubs" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" />
                      <Line yAxisId="right" type="monotone" dataKey="avgRisk" name="Avg Risk %" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data for selected period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Distribution Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="h-5 w-5" />
                  Risk Distribution
                </CardTitle>
                <CardDescription>Breakdown by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.riskDistribution.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {analytics.riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data for selected period
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issue Types Bar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5" />
                  Issues by Type
                </CardTitle>
                <CardDescription>Most common issue categories</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.issueTypes.some(t => t.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.issueTypes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No issues found - great job!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payer Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5" />
                  Risk by Payer
                </CardTitle>
                <CardDescription>Average risk score per payer</CardDescription>
              </CardHeader>
              <CardContent>
                {payerBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={payerBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={80} />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="claims" name="Claims" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="avgRisk" name="Avg Risk %" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No payer data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5" />
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Clean Rate */}
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Clean Claim Rate</p>
                  <p className={`text-3xl font-bold ${
                    analytics.total > 0 && (analytics.cleanClaims / analytics.total) >= 0.7 
                      ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {analytics.total > 0 
                      ? Math.round((analytics.cleanClaims / analytics.total) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">of claims pass with no issues</p>
                </div>

                {/* Top Issue */}
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Most Common Issue</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {analytics.issueTypes.sort((a, b) => b.value - a.value)[0]?.name || 'None'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.issueTypes.sort((a, b) => b.value - a.value)[0]?.value || 0} occurrences
                  </p>
                </div>

                {/* Riskiest Payer */}
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Highest Risk Payer</p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {payerBreakdown.sort((a, b) => b.avgRisk - a.avgRisk)[0]?.name || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payerBreakdown.sort((a, b) => b.avgRisk - a.avgRisk)[0]?.avgRisk || 0}% avg risk
                  </p>
                </div>

                {/* Potential Savings */}
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                  <p className="text-3xl font-bold text-primary">
                    ${estimatedSavings.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">by preventing {analytics.totalIssues} issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
