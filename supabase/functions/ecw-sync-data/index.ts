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
    // ECW FHIR API requires specific search parameters - not just _count
    let finalSearchParams: Record<string, string> = { ...searchParams };

    // For Patient - ECW requires a search parameter like name
    if (resource === "Patient") {
      if (Object.keys(finalSearchParams).length === 0) {
        // Use family name search with partial match to get patients
        // ECW typically requires at least one search parameter
        finalSearchParams.family = ""; // Empty string may work for "starts with"
      }
    }

    // For ServiceRequest
    if (resource === "ServiceRequest") {
      if (patientId) {
        finalSearchParams.patient = patientId;
      }
      // Don't add category parameter - ECW doesn't support it based on error logs
      // The category filter would need to be done client-side
    }

    // For Encounter - try date-based search
    if (resource === "Encounter") {
      if (Object.keys(finalSearchParams).length === 0) {
        // Try with date range for recent encounters
        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        finalSearchParams.date = `ge${yearAgo.toISOString().split('T')[0]}`;
      }
    }

    // For Claim
    if (resource === "Claim") {
      if (Object.keys(finalSearchParams).length === 0) {
        // Try with created date
        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        finalSearchParams.created = `ge${yearAgo.toISOString().split('T')[0]}`;
      }
    }

    // For Coverage
    if (resource === "Coverage") {
      if (Object.keys(finalSearchParams).length === 0 && patientId) {
        finalSearchParams.patient = patientId;
      }
    }

    // For Observation
    if (resource === "Observation") {
      if (Object.keys(finalSearchParams).length === 0) {
        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        finalSearchParams.date = `ge${yearAgo.toISOString().split('T')[0]}`;
      }
    }

    // Step 3: Build FHIR URL
    // If no search params after our logic, try without any (some endpoints may support it)
    const queryString = Object.keys(finalSearchParams).length > 0 
      ? new URLSearchParams(finalSearchParams).toString() 
      : "";
    const fhirUrl = `${fhirBaseUrl}/${resource}${queryString ? '?' + queryString : ''}`;
    
    console.log("=== ECW Sync: Fetching FHIR Data ===");
    console.log("Resource:", resource);
    console.log("Category:", category || "N/A");
    console.log("Search Params:", JSON.stringify(finalSearchParams));
    console.log("Full URL:", fhirUrl);

    // Step 4: Fetch from ECW FHIR API
    const fhirResponse = await fetch(fhirUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/fhir+json",
      },
    });

    console.log("FHIR Response Status:", fhirResponse.status);

    if (!fhirResponse.ok) {
      const errorText = await fhirResponse.text();
      console.error("=== ECW FHIR Error Details ===");
      console.error("Status:", fhirResponse.status);
      console.error("Response:", errorText);
      console.error("Request URL was:", fhirUrl);
      
      // Try to parse error for better message
      let errorMessage = `FHIR request failed with status ${fhirResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.issue?.[0]?.diagnostics) {
          errorMessage = errorJson.issue[0].diagnostics;
        }
      } catch (e) {
        // Use raw text if not JSON
        if (errorText.length < 200) {
          errorMessage = errorText;
        }
      }
      
      // Add helpful context for common errors
      if (fhirResponse.status === 401) {
        errorMessage = "Unauthorized: Invalid or expired Access Token";
      } else if (fhirResponse.status === 403) {
        errorMessage = `Forbidden: The scope for '${resource}' is not authorized. Request this scope from ECW.`;
      } else if (fhirResponse.status === 404) {
        errorMessage = "Not found: Unknown resource type or resource not found";
      } else if (fhirResponse.status === 408) {
        errorMessage = "Request timeout: Too much data or communication issue";
      } else if (fhirResponse.status === 429) {
        errorMessage = "Rate limited: Too many requests. Please wait and try again.";
      }
      
      throw new Error(errorMessage);
    }

    const fhirData = await fhirResponse.json();
    const totalRecords = fhirData.total || fhirData.entry?.length || 0;
    
    console.log("=== ECW Sync: Data Retrieved Successfully ===");
    console.log("Resource Type:", fhirData.resourceType);
    console.log("Total Records:", totalRecords);
    console.log("Entries returned:", fhirData.entry?.length || 0);

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
