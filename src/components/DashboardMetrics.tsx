import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend?: "up" | "down";
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  const isPositive = trend === "up" ? change > 0 : change < 0;
  
  return (
    <Card className="border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          <span className={`text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-xs text-muted-foreground ml-1">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardMetrics() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Total AR Outstanding"
        value="$2.4M"
        change={-12.5}
        trend="down"
        icon={<DollarSign className="h-4 w-4 text-primary" />}
      />
      <MetricCard
        title="Denial Rate"
        value="8.2%"
        change={-15.3}
        trend="down"
        icon={<AlertCircle className="h-4 w-4 text-destructive" />}
      />
      <MetricCard
        title="Clean Claim Rate"
        value="94.5%"
        change={6.2}
        trend="up"
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
      />
      <MetricCard
        title="Avg Days to Payment"
        value="28.3"
        change={-8.1}
        trend="down"
        icon={<Clock className="h-4 w-4 text-warning" />}
      />
      <MetricCard
        title="Collections This Month"
        value="$1.8M"
        change={11.4}
        trend="up"
        icon={<DollarSign className="h-4 w-4 text-success" />}
      />
      <MetricCard
        title="Pending Appeals"
        value="142"
        change={-22.0}
        trend="down"
        icon={<AlertCircle className="h-4 w-4 text-warning" />}
      />
    </div>
  );
}
