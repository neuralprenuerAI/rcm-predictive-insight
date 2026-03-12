/**
 * colombiaApi.ts
 * API wrapper for all mediflow- Lambda functions.
 * Same pattern as awsApi.ts — uses API Gateway prod stage.
 */

const API_BASE = import.meta.env.VITE_AWS_API_URL || "https://c7hp082ru5.execute-api.us-east-2.amazonaws.com/prod";

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}

export const colombiaApi = {
  /**
   * invoke(functionName, body)
   * POST /functions/v1/{functionName}
   * Returns parsed JSON body from Lambda response.
   */
  async invoke(functionName: string, body: Record<string, unknown> = {}): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/functions/v1/${functionName}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    // Unwrap Lambda proxy response if needed
    if (json?.body && typeof json.body === "string") {
      try { return JSON.parse(json.body); } catch { return json; }
    }
    return json;
  },
};

// ── Typed helpers — keeps components clean ────────────────────────────────

/** mediflow-eligibility */
export const checkEligibility = (cedula: string, tipo_documento = "CC") =>
  colombiaApi.invoke("mediflow-eligibility", { cedula, tipo_documento });

/** mediflow-patient-search */
export const searchPatient = (cedula: string, tipo_documento = "CC") =>
  colombiaApi.invoke("mediflow-patient-search", { cedula, tipo_documento });

/** mediflow-schedule-appointment */
export const scheduleAppointment = (payload: Record<string, unknown>) =>
  colombiaApi.invoke("mediflow-schedule-appointment", payload);

/** mediflow-encounters-list */
export const listEncounters = (ips_id: string, status?: string) =>
  colombiaApi.invoke("mediflow-encounters-list", { ips_id, status });

/** mediflow-rips-generator */
export const generateRips = (encounter_ids: string[], ips_id: string, periodo: string) =>
  colombiaApi.invoke("mediflow-rips-generator", { encounter_ids, ips_id, periodo_facturacion: periodo });

/** mediflow-factramed-submit */
export const submitRadicacion = (radicacion_id: string, ips_id: string) =>
  colombiaApi.invoke("mediflow-factramed-submit", { radicacion_id, ips_id });

/** mediflow-radicaciones-list */
export const listRadicaciones = (ips_id: string, status?: string, periodo?: string) =>
  colombiaApi.invoke("mediflow-radicaciones-list", { ips_id, status, periodo });

/** mediflow-billing-status-poller — manual trigger */
export const runBillingPoller = (ips_id: string, dry_run = false) =>
  colombiaApi.invoke("mediflow-billing-status-poller", { ips_id, dry_run });

/** mediflow-billing-auto-fix — manual trigger from UI */
export const triggerAutoFix = (radicacion_id: string, ips_id: string, error_codes: string[]) =>
  colombiaApi.invoke("mediflow-billing-auto-fix", { radicacion_id, ips_id, error_codes });

/** mediflow-dashboard-stats */
export const getDashboardStats = (ips_id: string) =>
  colombiaApi.invoke("mediflow-dashboard-stats", { ips_id });

/** mediflow-notifications */
export const sendNotification = (payload: Record<string, unknown>) =>
  colombiaApi.invoke("mediflow-notifications", payload);

/** mediflow-glosa-fetcher (Week 3 Day 4) */
export const fetchGlosas = (ips_id: string) =>
  colombiaApi.invoke("mediflow-glosa-fetcher", { ips_id });

/** mediflow-glosa-classifier (Week 3 Day 5) */
export const classifyGlosa = (glosa_id: string, ips_id: string) =>
  colombiaApi.invoke("mediflow-glosa-classifier", { glosa_id, ips_id });

/** mediflow-glosa-responder (Week 4) */
export const respondGlosa = (glosa_id: string, ips_id: string, auto_submit = false) =>
  colombiaApi.invoke("mediflow-glosa-responder", { glosa_id, ips_id, auto_submit });
