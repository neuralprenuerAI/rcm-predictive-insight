import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminError {
  id: string;
  user_id: string | null;
  user_email: string | null;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  component: string | null;
  action: string | null;
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  severity: "info" | "warning" | "error" | "critical";
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export function useAdminErrors(filters?: {
  severity?: string;
  resolved?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["admin-errors", filters],
    queryFn: async (): Promise<AdminError[]> => {
      let query = supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.severity && filters.severity !== "all") {
        query = query.eq("severity", filters.severity);
      }

      if (filters?.resolved !== undefined) {
        query = query.eq("resolved", filters.resolved);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching error logs:", error);
        return [];
      }

      return (data || []) as AdminError[];
    },
    refetchInterval: 15000,
  });
}

export default useAdminErrors;
