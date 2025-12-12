import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ECW ServiceRequest category codes (from ECW documentation)
const SERVICE_CATEGORIES: Record<string, string> = {
  labs: "108252007",      // Labs
  imaging: "363679005",   // DI (Diagnostic Imaging)
  procedures: "387713003" // Procedures
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      connectionId, 
      resource = "Patient",
      searchParams = {},
      category = null,
      patientId = null
    } = await req.json();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get connection details
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    const credentials = connection.credentials as any;
    const fhirBaseUrl = credentials?.issuer_url || credentials?.fhir_base_url;
    
    if (!fhirBaseUrl) {
      throw new Error("FHIR Base URL not configured in connection");
    }

    // Step 1: Get fresh access token
    console.log("=== ECW Sync: Getting fresh access token ===");
    const tokenResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ecw-get-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({ connectionId }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Failed to get token: ${error.error}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log("Access token obtained successfully");

    // Step 2: Build search parameters based on resource type
    let finalSearchParams: Record<string, string> = { ...searchParams };
    
    // For ServiceRequest, add category filter (per ECW docs)
    if (resource === "ServiceRequest" && category && SERVICE_CATEGORIES[category]) {
      finalSearchParams.category = SERVICE_CATEGORIES[category];
    }
    
    // For ServiceRequest with patient filter
    if (resource === "ServiceRequest" && patientId) {
      finalSearchParams.patient = patientId;
    }

    // Step 3: Build FHIR URL (per ECW documentation format)
    const queryString = new URLSearchParams(finalSearchParams).toString();
    const fhirUrl = `${fhirBaseUrl}/${resource}${queryString ? '?' + queryString : ''}`;
    
    console.log("=== ECW Sync: Fetching FHIR Data ===");
    console.log("Resource:", resource);
    console.log("Category:", category || "N/A");
    console.log("Full URL:", fhirUrl);

    // Step 4: Fetch from ECW FHIR API (using headers from ECW docs)
    const fhirResponse = await fetch(fhirUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/json+fhir",  // Per ECW documentation
      },
    });

    console.log("FHIR Response Status:", fhirResponse.status);

    if (!fhirResponse.ok) {
      const errorText = await fhirResponse.text();
      console.error("FHIR Error Response:", errorText);
      
      // Handle specific ECW error codes (from documentation)
      if (fhirResponse.status === 401) {
        throw new Error("Unauthorized: Invalid or expired Access Token");
      }
      if (fhirResponse.status === 403) {
        throw new Error(`Forbidden: The scope for '${resource}' is not authorized. Request this scope from ECW.`);
      }
      if (fhirResponse.status === 404) {
        throw new Error("Not found: Unknown resource type or resource not found");
      }
      if (fhirResponse.status === 408) {
        throw new Error("Request timeout: Too much data or communication issue");
      }
      if (fhirResponse.status === 429) {
        throw new Error("Rate limited: Too many requests. Please wait and try again.");
      }
      
      throw new Error(`FHIR request failed with status ${fhirResponse.status}`);
    }

    const fhirData = await fhirResponse.json();
    const totalRecords = fhirData.total || fhirData.entry?.length || 0;
    
    console.log("=== ECW Sync: Data Retrieved Successfully ===");
    console.log("Resource Type:", fhirData.resourceType);
    console.log("Total Records:", totalRecords);

    // Update last_sync timestamp on the connection
    await supabaseClient
      .from("api_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        resource,
        category: category || null,
        total: totalRecords,
        data: fhirData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ecw-sync-data:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
