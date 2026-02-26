import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";

export default function AnalyticsCharts() {
  const { data: scrubData = [] } = useQuery({
    queryKey: ['analytics-charts'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return [];
      return await awsCrud.select('claim_scrub_results', user.id);
    }
  });

  const totalScrubs = scrubData.length;
  const highRisk = scrubData.filter((s: any) => s.risk_level === 'high' || s.risk_level === 'critical').length;
  const clean = scrubData.filter((s: any) => s.risk_level === 'low' && (s.total_issues || 0) === 0).length;
  const avgRisk = totalScrubs > 0
    ? Math.round(scrubData.reduce((sum: number, s: any) => sum + (s.denial_risk_score || 0), 0) / totalScrubs)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-1">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Performance Overview
            </CardTitle>
            <CardDescription>
              {totalScrubs} scrubs analyzed · Avg risk {avgRisk}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalScrubs > 0 ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold">{totalScrubs}</p>
                  <p className="text-xs text-muted-foreground">Total Scrubs</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-destructive">{highRisk}</p>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{clean}</p>
                  <p className="text-xs text-muted-foreground">Clean</p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">No scrub data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
