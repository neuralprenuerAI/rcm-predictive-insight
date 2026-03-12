/**
 * colombiaApi.ts
 * API wrapper for all mediflow- Lambda functions.
 * Same pattern as awsApi.ts — uses API Gateway prod stage.
 */

import { supabase } from "@/integrations/supabase/client";
import { registerApiCall, unregisterApiCall } from "@/hooks/useIdleTimeout";

const API_BASE = import.meta.env.VITE_AWS_API_URL || "https://c7hp082ru5.execute-api.us-east-2.amazonaws.com/prod";

export const colombiaApi = {
  /**
   * invoke(functionName, body)
   * POST /functions/v1/{functionName}
   * Returns parsed JSON body from Lambda response.
   * Injects user_id + Authorization from Supabase session (same as awsApi).
   */
  async invoke(functionName: string, body: Record<string, unknown> = {}): Promise<any> {
    const url = `${API_BASE}/functions/v1/${functionName}`;

    registerApiCall();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Inject user_id if we have a session (don't override if already provided)
      const requestBody: Record<string, unknown> = { ...body };
      if (userId && !requestBody.user_id) {
        requestBody.user_id = userId;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errJson = JSON.parse(text);
          msg = errJson.error || errJson.message || msg;
        } catch { /* use default msg */ }
        throw new Error(msg);
      }

      const json = await res.json();
      // Unwrap Lambda proxy response if needed
      if (json?.body && typeof json.body === "string") {
        try { return JSON.parse(json.body); } catch { return json; }
      }
      return json;
    } finally {
      unregisterApiCall();
    }
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

/** mediflow-glosa-fetcher */
export const fetchGlosas = (ips_id: string) =>
  colombiaApi.invoke("mediflow-glosa-fetcher", { ips_id });

/** mediflow-glosa-classifier */
export const classifyGlosa = (glosa_id: string, ips_id: string) =>
  colombiaApi.invoke("mediflow-glosa-classifier", { glosa_id, ips_id });

/** mediflow-glosa-responder */
export const respondGlosa = (glosa_id: string, ips_id: string, auto_submit = false) =>
  colombiaApi.invoke("mediflow-glosa-responder", { glosa_id, ips_id, auto_submit });
