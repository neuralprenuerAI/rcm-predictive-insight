import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface LogActivityParams {
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Json;
}

export async function logActivity({
  action,
  resourceType,
  resourceId,
  details,
}: LogActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase.from("activity_logs").insert([{
      user_id: user.id,
      user_email: user.email,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ?? null,
    }]);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// Pre-defined actions for consistency
export const ActivityActions = {
  // Auth
  LOGIN: "user_login",
  LOGOUT: "user_logout",
  
  // Patients
  PATIENT_VIEW: "patient_view",
  PATIENT_CREATE: "patient_create",
  PATIENT_UPDATE: "patient_update",
  PATIENT_SYNC: "patient_sync",
  
  // Connections
  CONNECTION_CREATE: "connection_create",
  CONNECTION_UPDATE: "connection_update",
  CONNECTION_DELETE: "connection_delete",
  CONNECTION_TEST: "connection_test",
  CONNECTION_SYNC: "connection_sync",
  
  // Procedures
  PROCEDURE_SYNC: "procedure_sync",
  
  // Admin
  ADMIN_ACCESS: "admin_access",
  ROLE_CHANGE: "role_change",
  ERROR_RESOLVED: "error_resolved",
};
