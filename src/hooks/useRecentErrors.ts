import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ErrorItem {
  id: string;
  user_email: string | null;
  error_type: string;
  error_message: string;
  severity: string | null;
  component: string | null;
  resolved: boolean | null;
  created_at: string | null;
}

export function useRecentErrors(limit: number = 5) {
  return useQuery({
    queryKey: ["recent-errors", limit],
    queryFn: async (): Promise<ErrorItem[]> => {
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching errors:", error);
        return [];
      }

      return data || [];
    },
    refetchInterval: 15000,
  });
}

export default useRecentErrors;
