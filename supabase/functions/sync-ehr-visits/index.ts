import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch API connection details
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError) throw connError;
    if (!connection.is_active) throw new Error("Connection is not active");

    // Make API call to EHR system (this is a generic example)
    // In production, you'd implement specific EHR integrations (Epic, Cerner, etc.)
    const ehrResponse = await fetch(`${connection.api_url}/upcoming-visits`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${connection.api_key_encrypted}`, // In production, decrypt this
        "Content-Type": "application/json",
      },
    });

    if (!ehrResponse.ok) {
      throw new Error(`EHR API error: ${ehrResponse.statusText}`);
    }

    const visits = await ehrResponse.json();

    // Process each visit and check for prior auth requirements
    const processedVisits = [];
    for (const visit of visits.data || []) {
      // Analyze CPT codes using our function
      const cptAnalysis = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-cpt-requirements`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cptCodes: visit.cpt_codes || [],
          payer: visit.insurance?.payer_name,
          patientInfo: {
            insurance: visit.insurance?.plan_name,
            demographics: visit.patient
          }
        }),
      });

      const analysis = await cptAnalysis.json();
      const requiresPriorAuth = analysis.analysis?.some((a: any) => a.requires_prior_auth);

      processedVisits.push({
        ...visit,
        requires_prior_auth: requiresPriorAuth,
        cpt_analysis: analysis.analysis
      });

      // If prior auth needed, create authorization request
      if (requiresPriorAuth) {
        await supabaseClient.from("authorizations").insert({
          user_id: user.id,
          patient_name: `${visit.patient?.first_name} ${visit.patient?.last_name}`,
          payer: visit.insurance?.payer_name,
          service: visit.appointment_type || "Office Visit",
          cpt_codes: visit.cpt_codes,
          diagnosis_codes: visit.diagnosis_codes,
          request_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          notes: `Auto-generated from EHR sync for visit on ${visit.appointment_date}`
        });
      }
    }

    // Update last sync time
    await supabaseClient
      .from("api_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId);

    return new Response(
      JSON.stringify({ 
        visits: processedVisits,
        sync_time: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
