import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityItem {
  id: string;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  created_at: string;
}

export function useRecentActivity(limit: number = 10) {
  return useQuery({
    queryKey: ["recent-activity", limit],
    queryFn: async (): Promise<ActivityItem[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Error fetching activity:", error);
        return [];
      }

      return data || [];
    },
    refetchInterval: 15000,
  });
}

export default useRecentActivity;
