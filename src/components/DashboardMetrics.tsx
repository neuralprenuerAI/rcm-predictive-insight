import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function DashboardMetrics() {
  const { data: metrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const { data: claims } = await (supabase as any).from('claims').select('*');
      const { data: denials } = await (supabase as any).from('denials').select('*');
      
      const totalClaims = claims?.length || 0;
      const totalDenials = denials?.length || 0;
      const denialRate = totalClaims > 0 ? ((totalDenials / totalClaims) * 100).toFixed(1) : '8.2';
      
      return [
        { label: "Days in A/R", value: "42.5", trend: "↓ 2.1 days", positive: true },
        { label: "Denial Rate", value: `${denialRate}%`, trend: "↓ 1.3%", positive: true },
        { label: "Clean Claim Rate", value: "91.8%", trend: "↑ 2.5%", positive: true },
        { label: "Net Collection Rate", value: "96.7%", trend: "↑ 0.8%", positive: true },
        { label: "Cost to Collect", value: "$3.2", trend: "↓ $0.15", positive: true },
        { label: "First Pass Resolution", value: "89.3%", trend: "↑ 1.7%", positive: true },
        { label: "Avg Payment Time", value: "28.4 days", trend: "↓ 3.2 days", positive: true },
        { label: "Auth Approval Rate", value: "87.6%", trend: "↑ 2.1%", positive: true }
      ];
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics?.map((metric, index) => (
        <Card key={index} className="border-border shadow-[var(--shadow-card)]">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">{metric.label}</div>
            <div className="text-3xl font-bold text-foreground mb-1">{metric.value}</div>
            <div className={`flex items-center gap-1 text-sm ${metric.positive ? 'text-green-600' : 'text-red-600'}`}>
              {metric.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{metric.trend}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
