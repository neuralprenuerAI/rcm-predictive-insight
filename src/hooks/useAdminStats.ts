import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";

export interface AdminStats {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  newUsersMonth: number;
  totalConnections: number;
  activeConnections: number;
  totalPatients: number;
  totalClaims: number;
  errorsToday: number;
  unresolvedErrors: number;
  activitiesToday: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return {
        totalUsers: 0, activeUsersToday: 0, activeUsersWeek: 0, newUsersMonth: 0,
        totalConnections: 0, activeConnections: 0, totalPatients: 0, totalClaims: 0,
        errorsToday: 0, unresolvedErrors: 0, activitiesToday: 0,
      };

      const [userRoles, apiConnections, patients, claims, errorLogs, activityLogs] = await Promise.all([
        awsCrud.select('user_roles', undefined),
        awsCrud.select('api_connections', undefined),
        awsCrud.select('patients', undefined),
        awsCrud.select('claims', undefined),
        awsCrud.select('error_logs', undefined),
        awsCrud.select('activity_logs', undefined),
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      return {
        totalUsers: (userRoles || []).length,
        activeUsersToday: 0,
        activeUsersWeek: 0,
        newUsersMonth: 0,
        totalConnections: (apiConnections || []).length,
        activeConnections: (apiConnections || []).filter((c: any) => c.is_active).length,
        totalPatients: (patients || []).length,
        totalClaims: (claims || []).length,
        errorsToday: (errorLogs || []).filter((e: any) => new Date(e.created_at) >= todayStart).length,
        unresolvedErrors: (errorLogs || []).filter((e: any) => !e.resolved).length,
        activitiesToday: (activityLogs || []).filter((a: any) => new Date(a.created_at) >= todayStart).length,
      };
    },
    refetchInterval: 30000,
  });
}

export default useAdminStats;
