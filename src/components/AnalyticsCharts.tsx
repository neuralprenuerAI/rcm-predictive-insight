import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";

export default function AnalyticsCharts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics & Reporting</h1>
        <p className="text-muted-foreground">Real-time revenue cycle performance insights</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Denial Trends
            </CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs mt-1">Real-time denial rate tracking</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-success" />
              Collections Performance
            </CardTitle>
            <CardDescription>Monthly collections vs target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs mt-1">Target: $2.1M | Actual: $1.8M (86%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-warning" />
              AR Aging
            </CardTitle>
            <CardDescription>Outstanding receivables by age bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs mt-1">0-30: $850K | 31-60: $420K | 61-90: $280K | 90+: $850K</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Payer Performance
            </CardTitle>
            <CardDescription>Days to payment by payer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs mt-1">Avg: 28.3 days across all payers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
