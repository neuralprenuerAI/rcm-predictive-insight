import { supabase } from "@/integrations/supabase/client";

/**
 * Finds the ECW connection that has the required scope for a given action.
 * Connections store their scope in credentials.scope as a space-separated string.
 */

export type EcwAction =
  | "Patient.create"
  | "Patient.update"
  | "Patient.read"
  | "Procedure.read"
  | "ServiceRequest.read"
  | "Encounter.read"
  | "Claim.read"
  | "Coverage.read"
  | "Observation.read";

interface EcwConnection {
  id: string;
  name: string | null;
  connection_name: string;
  credentials: { scope?: string; selected_scopes?: string[] } | null;
}

/**
 * Resolves the best ECW connection for a given required scope.
 * @param requiredScope - e.g. "Patient.create", "Procedure.read"
 * @returns The connection ID, or null if none found
 */
export async function findEcwConnectionByScope(
  requiredScope: EcwAction
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: connections } = await supabase
    .from("api_connections")
    .select("id, name, connection_name, credentials")
    .eq("connection_type", "ecw")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!connections || connections.length === 0) return null;

  const fullScope = `system/${requiredScope}`;

  for (const conn of connections) {
    const creds = conn.credentials as EcwConnection["credentials"];
    const scopeStr = creds?.scope || "";
    if (scopeStr.includes(fullScope)) {
      return conn.id;
    }
  }

  return null;
}

/**
 * Gets all ECW connections for the current user with their scopes.
 */
export async function getAllEcwConnections(): Promise<EcwConnection[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("api_connections")
    .select("id, name, connection_name, credentials")
    .eq("connection_type", "ecw")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return (data || []) as EcwConnection[];
}
