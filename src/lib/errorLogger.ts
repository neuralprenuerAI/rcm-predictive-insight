import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import type { Json } from "@/integrations/supabase/types";

interface LogErrorParams {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  component?: string;
  action?: string;
  requestData?: Json;
  responseData?: Json;
  severity?: "info" | "warning" | "error" | "critical";
}

export async function logError({
  errorType,
  errorMessage,
  errorStack,
  component,
  action,
  requestData,
  responseData,
  severity = "error",
}: LogErrorParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    await awsCrud.insert("error_logs", {
      user_id: user?.id || null,
      user_email: user?.email || null,
      error_type: errorType,
      error_message: errorMessage,
      error_stack: errorStack,
      component,
      action,
      request_data: requestData ?? null,
      response_data: responseData ?? null,
      severity,
    }, userId);
  } catch (err) {
    console.error("Failed to log error:", err);
  }
}

// Pre-defined error types for consistency
export const ErrorTypes = {
  AUTH_ERROR: "auth_error",
  API_ERROR: "api_error",
  ECW_ERROR: "ecw_error",
  DATABASE_ERROR: "database_error",
  VALIDATION_ERROR: "validation_error",
  NETWORK_ERROR: "network_error",
  UNKNOWN_ERROR: "unknown_error",
};
