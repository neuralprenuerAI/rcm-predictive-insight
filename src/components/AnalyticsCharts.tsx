import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp } from "lucide-react";

export default function AnalyticsCharts() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-1">
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Claim Status Distribution</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
