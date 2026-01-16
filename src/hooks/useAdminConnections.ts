import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminConnection {
  id: string;
  name: string | null;
  connection_name: string;
  connection_type: string;
  is_active: boolean;
  user_id: string;
  user_email: string;
  api_url: string;
  configuration: Record<string, unknown> | null;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdminConnections() {
  return useQuery({
    queryKey: ["admin-connections"],
    queryFn: async (): Promise<AdminConnection[]> => {
      // Get all connections
      const { data: connections, error: connError } = await supabase
        .from("api_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (connError) {
        console.error("Error fetching connections:", connError);
        return [];
      }

      // Get user emails from user_roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, email");

      const userEmailMap = new Map(
        (userRoles || []).map((u) => [u.user_id, u.email])
      );

      // Combine data
      return (connections || []).map((conn) => ({
        id: conn.id,
        name: conn.name,
        connection_name: conn.connection_name,
        connection_type: conn.connection_type,
        is_active: conn.is_active ?? false,
        user_id: conn.user_id,
        user_email: userEmailMap.get(conn.user_id) || "Unknown",
        api_url: conn.api_url,
        configuration: conn.configuration as Record<string, unknown> | null,
        last_sync: conn.last_sync,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
      }));
    },
    refetchInterval: 30000,
  });
}

export default useAdminConnections;
