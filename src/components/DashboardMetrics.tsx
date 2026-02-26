import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [claims, denials, payments, patients, authorizations] = await Promise.all([
        awsCrud.select('claims', user.id),
        awsCrud.select('denial_queue', user.id),
        awsCrud.select('payments', user.id),
        awsCrud.select('patients', user.id),
        awsCrud.select('authorizations', user.id),
      ]);

      const patientCount = patients?.length || 0;
      const authorizationCount = authorizations?.length || 0;

      const totalClaims = claims?.length || 0;
      const totalBilled = claims?.reduce((sum, c) => sum + (Number(c.billed_amount) || 0), 0) || 0;
      const totalCollected = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
      const totalDenials = denials?.length || 0;
      const denialRate = totalClaims > 0 ? (totalDenials / totalClaims * 100).toFixed(1) : "0.0";
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled * 100).toFixed(0) : "0";

      return [
        { label: "Total Patients", value: (patientCount || 0).toString(), trend: "From ECW", positive: true },
        { label: "Total Claims", value: totalClaims.toString(), trend: "All time", positive: true },
        { label: "Total Authorizations", value: (authorizationCount || 0).toString(), trend: "All time", positive: true },
        { label: "Total Billed", value: `$${totalBilled.toLocaleString()}`, trend: `${collectionRate}% collected`, positive: true },
        { label: "Denial Rate", value: `${denialRate}%`, trend: `${totalDenials} denials`, positive: Number(denialRate) < 15 },
      ];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="border-border shadow-[var(--shadow-card)]">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
