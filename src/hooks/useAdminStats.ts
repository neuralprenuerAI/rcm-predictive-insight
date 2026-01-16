import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Fetch all stats in parallel
      const [
        usersResult,
        connectionsResult,
        activeConnectionsResult,
        patientsResult,
        claimsResult,
        errorsTodayResult,
        unresolvedErrorsResult,
        activitiesTodayResult,
      ] = await Promise.all([
        // Total users
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
        // Total connections
        supabase.from("api_connections").select("id", { count: "exact", head: true }),
        // Active connections
        supabase.from("api_connections").select("id", { count: "exact", head: true }).eq("is_active", true),
        // Total patients
        supabase.from("patients").select("id", { count: "exact", head: true }),
        // Total claims
        supabase.from("claims").select("id", { count: "exact", head: true }),
        // Errors today
        supabase.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        // Unresolved errors
        supabase.from("error_logs").select("id", { count: "exact", head: true }).eq("resolved", false),
        // Activities today
        supabase.from("activity_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      ]);

      return {
        totalUsers: usersResult.count || 0,
        activeUsersToday: 0,
        activeUsersWeek: 0,
        newUsersMonth: 0,
        totalConnections: connectionsResult.count || 0,
        activeConnections: activeConnectionsResult.count || 0,
        totalPatients: patientsResult.count || 0,
        totalClaims: claimsResult.count || 0,
        errorsToday: errorsTodayResult.count || 0,
        unresolvedErrors: unresolvedErrorsResult.count || 0,
        activitiesToday: activitiesTodayResult.count || 0,
      };
    },
    refetchInterval: 30000,
  });
}

export default useAdminStats;
