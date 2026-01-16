import React, { useState } from "react";
import { 
  usePatientTrends, 
  useActivityTrends, 
  useErrorTrends, 
  useUserStats 
} from "@/hooks/useAdminAnalytics";
import { SimpleChart } from "./SimpleChart";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  Users,
  Database,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  Calendar,
  Plug
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Trend Indicator Component
function TrendIndicator({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length < 7) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  const lastWeek = data.slice(-7);
  const previousWeek = data.slice(-14, -7);
  
  const lastWeekTotal = lastWeek.reduce((sum, d) => sum + d.count, 0);
  const previousWeekTotal = previousWeek.reduce((sum, d) => sum + d.count, 0);
  
  if (lastWeekTotal > previousWeekTotal) {
    const increase = previousWeekTotal > 0 
      ? Math.round(((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100)
      : 100;
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <TrendingUp className="h-4 w-4" />
        +{increase}%
      </span>
    );
  } else if (lastWeekTotal < previousWeekTotal) {
    const decrease = Math.round(((previousWeekTotal - lastWeekTotal) / previousWeekTotal) * 100);
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <TrendingDown className="h-4 w-4" />
        -{decrease}%
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
      <Minus className="h-4 w-4" />
      No change
    </span>
  );
}

// Stat Summary Card with Chart
function ChartCard({ 
  title, 
  data, 
  color, 
  icon: Icon,
  total 
}: { 
  title: string; 
  data: { date: string; count: number }[]; 
  color: string;
  icon: React.ElementType;
  total: number;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
          </div>
        </div>
        <TrendIndicator data={data} />
      </div>
      <SimpleChart data={data} color={color} height={100} showLabels={false} />
    </div>
  );
}

// Main Analytics Tab Component
export function AnalyticsTab() {
  const [timeRange, setTimeRange] = useState(30);
  
  const { data: patientTrends, isLoading: patientsLoading, refetch: refetchPatients } = usePatientTrends(timeRange);
  const { data: activityTrends, isLoading: activityLoading, refetch: refetchActivity } = useActivityTrends(timeRange);
  const { data: errorTrends, isLoading: errorsLoading, refetch: refetchErrors } = useErrorTrends(timeRange);
  const { data: userStats, isLoading: usersLoading, refetch: refetchUsers } = useUserStats();

  const isLoading = patientsLoading || activityLoading || errorsLoading || usersLoading;

  const handleRefresh = () => {
    refetchPatients();
    refetchActivity();
    refetchErrors();
    refetchUsers();
  };

  // Calculate totals
  const totalPatients = patientTrends?.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalActivities = activityTrends?.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalErrors = errorTrends?.reduce((sum, d) => sum + d.count, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Analytics & Trends</h2>
          <p className="text-sm text-muted-foreground">System usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard
          title={`Patients Added (${timeRange}d)`}
          data={patientTrends || []}
          color="#3b82f6"
          icon={Database}
          total={totalPatients}
        />
        <ChartCard
          title={`User Activities (${timeRange}d)`}
          data={activityTrends || []}
          color="#22c55e"
          icon={Activity}
          total={totalActivities}
        />
        <ChartCard
          title={`Errors Logged (${timeRange}d)`}
          data={errorTrends || []}
          color="#ef4444"
          icon={AlertTriangle}
          total={totalErrors}
        />
      </div>

      {/* User Statistics */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Statistics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Patients</TableHead>
                <TableHead className="text-right">Connections</TableHead>
                <TableHead className="text-right">Activities</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(userStats || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No user data available
                  </TableCell>
                </TableRow>
              ) : (
                (userStats || [])
                  .sort((a, b) => b.patient_count - a.patient_count)
                  .map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.user_email}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" />
                          {user.patient_count.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <Plug className="h-3 w-3 text-muted-foreground" />
                          {user.connection_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1">
                          <Activity className="h-3 w-3 text-muted-foreground" />
                          {user.activity_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_active
                          ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true })
                          : "Never"
                        }
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary Insights */}
      <div className="bg-muted/30 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">📊 Insights</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• {(userStats || []).length} total users registered</p>
          <p>• {totalPatients.toLocaleString()} patients added in the last {timeRange} days</p>
          <p>• {totalActivities} user activities logged</p>
          {totalErrors > 0 ? (
            <p>• ⚠️ {totalErrors} errors logged - review in Errors tab</p>
          ) : (
            <p>• ✅ No errors in the last {timeRange} days</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsTab;
