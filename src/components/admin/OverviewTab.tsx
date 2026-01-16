import React from "react";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useRecentErrors } from "@/hooks/useRecentErrors";
import { 
  Users, 
  Plug, 
  UserCheck,
  AlertTriangle, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color,
}: { 
  title: string; 
  value: number | string; 
  subtitle?: string;
  icon: React.ElementType; 
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-full p-3 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function SystemHealth({ stats }: { stats: ReturnType<typeof useAdminStats>["data"] }) {
  if (!stats) return null;
  
  let status: "healthy" | "warning" | "critical" = "healthy";
  let message = "All systems operational";
  
  if (stats.unresolvedErrors > 5) {
    status = "critical";
    message = `${stats.unresolvedErrors} unresolved errors need attention`;
  } else if (stats.unresolvedErrors > 0) {
    status = "warning";
    message = `${stats.unresolvedErrors} unresolved error(s)`;
  } else if (stats.activeConnections === 0 && stats.totalConnections > 0) {
    status = "warning";
    message = "No active API connections";
  }

  const statusConfig = {
    healthy: { bg: "bg-green-50 dark:bg-green-950", border: "border-green-200 dark:border-green-800", text: "text-green-800 dark:text-green-200", icon: CheckCircle, iconColor: "text-green-500" },
    warning: { bg: "bg-yellow-50 dark:bg-yellow-950", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-800 dark:text-yellow-200", icon: AlertTriangle, iconColor: "text-yellow-500" },
    critical: { bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-800", text: "text-red-800 dark:text-red-200", icon: XCircle, iconColor: "text-red-500" },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4 mb-6`}>
      <div className="flex items-center gap-3">
        <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
        <div>
          <p className={`font-medium ${config.text}`}>
            System Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityItemRow({ activity }: { activity: ReturnType<typeof useRecentActivity>["data"] extends (infer T)[] ? T : never }) {
  const actionLabels: Record<string, string> = {
    user_login: "logged in",
    user_logout: "logged out",
    patient_create: "created a patient",
    patient_update: "updated a patient",
    patient_sync: "synced patients",
    patient_view: "viewed a patient",
    connection_create: "created an API connection",
    connection_update: "updated an API connection",
    connection_delete: "deleted an API connection",
    connection_test: "tested an API connection",
    connection_sync: "synced data",
    procedure_sync: "synced procedures",
    admin_access: "accessed Admin Center",
    role_change: "changed a user role",
    error_resolved: "resolved an error",
  };

  const label = actionLabels[activity.action] || activity.action;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <div className="rounded-full bg-primary/10 p-2 mt-0.5">
        <Activity className="h-3 w-3 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.user_email || "Unknown user"}</span>
          {" "}{label}
        </p>
        <p className="text-xs text-muted-foreground">
          {activity.created_at ? formatDistanceToNow(new Date(activity.created_at), { addSuffix: true }) : "Unknown time"}
        </p>
      </div>
    </div>
  );
}

function ErrorItemRow({ error }: { error: ReturnType<typeof useRecentErrors>["data"] extends (infer T)[] ? T : never }) {
  const severityConfig: Record<string, { bg: string; text: string }> = {
    critical: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-800 dark:text-red-200" },
    error: { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-800 dark:text-orange-200" },
    warning: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-800 dark:text-yellow-200" },
    info: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-800 dark:text-blue-200" },
  };

  const config = severityConfig[error.severity || "error"] || severityConfig.error;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <div className="rounded-full bg-destructive/10 p-2 mt-0.5">
        <AlertTriangle className="h-3 w-3 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {error.error_message}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className={`px-1.5 py-0.5 rounded text-xs ${config.bg} ${config.text}`}>
            {error.severity || "error"}
          </span>
          <span className="truncate">
            {error.user_email || "System"}
          </span>
          <span>
            {error.created_at ? formatDistanceToNow(new Date(error.created_at), { addSuffix: true }) : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAdminStats();
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity(8);
  const { data: errors, isLoading: errorsLoading } = useRecentErrors(5);

  const handleRefresh = () => {
    refetchStats();
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">Real-time system statistics</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {stats && <SystemHealth stats={stats} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          subtitle={`${stats?.activitiesToday || 0} activities today`}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="API Connections"
          value={stats?.totalConnections || 0}
          subtitle={`${stats?.activeConnections || 0} active`}
          icon={Plug}
          color="bg-green-500"
        />
        <StatCard
          title="Total Patients"
          value={stats?.totalPatients || 0}
          icon={UserCheck}
          color="bg-purple-500"
        />
        <StatCard
          title="Unresolved Errors"
          value={stats?.unresolvedErrors || 0}
          subtitle={`${stats?.errorsToday || 0} today`}
          icon={AlertTriangle}
          color={stats?.unresolvedErrors ? "bg-red-500" : "bg-gray-400"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Recent Activity</h3>
            </div>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities && activities.length > 0 ? (
              activities.map((activity) => (
                <ActivityItemRow key={activity.id} activity={activity} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Unresolved Errors</h3>
            </div>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {errorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : errors && errors.length > 0 ? (
              errors.map((error) => (
                <ErrorItemRow key={error.id} error={error} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No unresolved errors</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;
