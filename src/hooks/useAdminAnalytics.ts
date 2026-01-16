import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, eachDayOfInterval } from "date-fns";

export interface DailyCount {
  date: string;
  count: number;
}

export interface UserStats {
  user_id: string;
  user_email: string;
  patient_count: number;
  connection_count: number;
  activity_count: number;
  last_active: string | null;
}

// Get patient sync trends (last N days)
export function usePatientTrends(days: number = 30) {
  return useQuery({
    queryKey: ["patient-trends", days],
    queryFn: async (): Promise<DailyCount[]> => {
      const startDate = subDays(new Date(), days);
      
      const { data, error } = await supabase
        .from("patients")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching patient trends:", error);
        return [];
      }

      // Group by day
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      const countsByDay = new Map<string, number>();
      dateRange.forEach((date) => {
        countsByDay.set(format(date, "yyyy-MM-dd"), 0);
      });

      (data || []).forEach((patient) => {
        const day = format(new Date(patient.created_at), "yyyy-MM-dd");
        countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
      });

      return Array.from(countsByDay.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    },
  });
}

// Get activity trends (last N days)
export function useActivityTrends(days: number = 30) {
  return useQuery({
    queryKey: ["activity-trends", days],
    queryFn: async (): Promise<DailyCount[]> => {
      const startDate = subDays(new Date(), days);
      
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching activity trends:", error);
        return [];
      }

      // Group by day
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      const countsByDay = new Map<string, number>();
      dateRange.forEach((date) => {
        countsByDay.set(format(date, "yyyy-MM-dd"), 0);
      });

      (data || []).forEach((activity) => {
        const day = format(new Date(activity.created_at!), "yyyy-MM-dd");
        countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
      });

      return Array.from(countsByDay.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    },
  });
}

// Get error trends (last N days)
export function useErrorTrends(days: number = 30) {
  return useQuery({
    queryKey: ["error-trends", days],
    queryFn: async (): Promise<DailyCount[]> => {
      const startDate = subDays(new Date(), days);
      
      const { data, error } = await supabase
        .from("error_logs")
        .select("created_at")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching error trends:", error);
        return [];
      }

      // Group by day
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      const countsByDay = new Map<string, number>();
      dateRange.forEach((date) => {
        countsByDay.set(format(date, "yyyy-MM-dd"), 0);
      });

      (data || []).forEach((err) => {
        const day = format(new Date(err.created_at!), "yyyy-MM-dd");
        countsByDay.set(day, (countsByDay.get(day) || 0) + 1);
      });

      return Array.from(countsByDay.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    },
  });
}

// Get user statistics
export function useUserStats() {
  return useQuery({
    queryKey: ["user-stats"],
    queryFn: async (): Promise<UserStats[]> => {
      // Get all users
      const { data: users, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id, email");

      if (usersError) {
        console.error("Error fetching users:", usersError);
        return [];
      }

      // Get patient counts by user
      const { data: patientCounts } = await supabase
        .from("patients")
        .select("user_id");

      const patientCountMap = new Map<string, number>();
      (patientCounts || []).forEach((p) => {
        if (p.user_id) {
          patientCountMap.set(p.user_id, (patientCountMap.get(p.user_id) || 0) + 1);
        }
      });

      // Get connection counts by user
      const { data: connectionCounts } = await supabase
        .from("api_connections")
        .select("user_id");

      const connectionCountMap = new Map<string, number>();
      (connectionCounts || []).forEach((c) => {
        if (c.user_id) {
          connectionCountMap.set(c.user_id, (connectionCountMap.get(c.user_id) || 0) + 1);
        }
      });

      // Get activity counts by user
      const { data: activityCounts } = await supabase
        .from("activity_logs")
        .select("user_id, created_at")
        .order("created_at", { ascending: false });

      const activityCountMap = new Map<string, number>();
      const lastActivityMap = new Map<string, string>();
      (activityCounts || []).forEach((a) => {
        if (a.user_id) {
          activityCountMap.set(a.user_id, (activityCountMap.get(a.user_id) || 0) + 1);
          if (!lastActivityMap.has(a.user_id) && a.created_at) {
            lastActivityMap.set(a.user_id, a.created_at);
          }
        }
      });

      return (users || []).map((user) => ({
        user_id: user.user_id,
        user_email: user.email || "Unknown",
        patient_count: patientCountMap.get(user.user_id) || 0,
        connection_count: connectionCountMap.get(user.user_id) || 0,
        activity_count: activityCountMap.get(user.user_id) || 0,
        last_active: lastActivityMap.get(user.user_id) || null,
      }));
    },
  });
}

export default { usePatientTrends, useActivityTrends, useErrorTrends, useUserStats };
