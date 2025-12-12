import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ECW ServiceRequest category codes (from ECW documentation)
const SERVICE_CATEGORIES: Record<string, string> = {
  labs: "108252007",
  imaging: "363679005",
  procedures: "387713003"
};

// Helper: Fetch all patients using search terms
async function fetchAllPatients(fhirBaseUrl: string, accessToken: string): Promise<any[]> {
  console.log("=== Fetching ALL patients ===");
  
  // Include "test" since ECW sandbox has test patients
  const searchTerms = [
    "test",  // ECW sandbox test data
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
  ];
  
  const allPatients: any[] = [];
  const seenIds = new Set<string>();
  
  for (const term of searchTerms) {
    try {
      const searchUrl = `${fhirBaseUrl}/Patient?name=${term}`;
      console.log(`Searching: name=${term}`);
      
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/fhir+json",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const count = data.entry?.length || 0;
        
        if (data.entry) {
          for (const entry of data.entry) {
            if (!seenIds.has(entry.resource.id)) {
              seenIds.add(entry.resource.id);
              allPatients.push(entry);
            }
          }
        }
        
        console.log(`  "${term}": found ${count}, total unique: ${allPatients.length}`);
      } else {
        console.log(`  "${term}": ${response.status} error`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Error searching "${term}":`, err);
    }
  }
  
  console.log(`=== Total unique patients: ${allPatients.length} ===`);
  return allPatients;
}

// Helper: Format date for ECW (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: Get date X days ago
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

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
      fetchAll = false,
      dateRange = null  // "last30days", "last90days", "lastyear", "all" or { from: "2024-01-01", to: "2024-12-31" }
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

    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) throw new Error("Connection not found");

    const credentials = connection.credentials as any;
    const fhirBaseUrl = credentials?.issuer_url || credentials?.fhir_base_url;
    if (!fhirBaseUrl) throw new Error("FHIR Base URL not configured");

    // Get fresh access token
    console.log("Getting fresh access token...");
    const tokenResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ecw-get-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ connectionId }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Token error: ${error.error}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log("Access token obtained");

    // ========== HANDLE PATIENT ==========
    if (resource === "Patient") {
      if (fetchAll) {
        const allPatients = await fetchAllPatients(fhirBaseUrl, access_token);
        
        // Update last_sync timestamp
        await supabaseClient
          .from("api_connections")
          .update({ last_sync: new Date().toISOString() })
          .eq("id", connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            resource: "Patient",
            total: allPatients.length,
            data: {
              resourceType: "Bundle",
              type: "searchset",
              total: allPatients.length,
              entry: allPatients,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Single search - use name parameter
      const searchName = searchParams.name || "a";
      const fhirUrl = `${fhirBaseUrl}/Patient?name=${encodeURIComponent(searchName)}`;
      console.log("Fetching patients:", fhirUrl);
      
      const response = await fetch(fhirUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Accept": "application/fhir+json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("FHIR Error:", response.status, errorText);
        throw new Error(`FHIR error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update last_sync timestamp
      await supabaseClient
        .from("api_connections")
        .update({ last_sync: new Date().toISOString() })
        .eq("id", connectionId);

      return new Response(
        JSON.stringify({
          success: true,
          resource: "Patient",
          total: data.total || data.entry?.length || 0,
          data,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== HANDLE SERVICE REQUEST ==========
    if (resource === "ServiceRequest") {
      // Determine date range
      let authoredFrom: string;
      let authoredTo: string = formatDate(new Date());
      
      if (dateRange === "last30days") {
        authoredFrom = getDaysAgo(30);
      } else if (dateRange === "last90days") {
        authoredFrom = getDaysAgo(90);
      } else if (dateRange === "lastyear") {
        authoredFrom = getDaysAgo(365);
      } else if (dateRange === "all") {
        authoredFrom = "2000-01-01";
      } else if (typeof dateRange === "object" && dateRange?.from) {
        authoredFrom = dateRange.from;
        authoredTo = dateRange.to || authoredTo;
      } else {
        // Default: last 90 days
        authoredFrom = getDaysAgo(90);
      }
      
      console.log(`ServiceRequest date range: ${authoredFrom} to ${authoredTo}`);
      
      if (fetchAll) {
        console.log("=== Fetching ALL ServiceRequests ===");
        
        // First get all patients
        const allPatients = await fetchAllPatients(fhirBaseUrl, access_token);
        
        const allServiceRequests: any[] = [];
        const seenIds = new Set<string>();
        let processedCount = 0;
        
        // Process patients (limit to avoid timeout)
        const patientsToProcess = allPatients.slice(0, 200);
        console.log(`Processing ${patientsToProcess.length} patients for ServiceRequests...`);
        
        for (const patientEntry of patientsToProcess) {
          const patientId = patientEntry.resource.id;
          
          // Build URL per ECW docs: patient + category + authored
          let url = `${fhirBaseUrl}/ServiceRequest?patient=${patientId}`;
          
          // Add category if specified
          if (category && SERVICE_CATEGORIES[category]) {
            url += `&category=${SERVICE_CATEGORIES[category]}`;
          }
          
          // Add authored date range
          url += `&authored=ge${authoredFrom}&authored=le${authoredTo}`;
          
          try {
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${access_token}`,
                "Accept": "application/fhir+json",
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.entry) {
                for (const entry of data.entry) {
                  if (!seenIds.has(entry.resource.id)) {
                    seenIds.add(entry.resource.id);
                    // Add patient info to ServiceRequest for display
                    const patientName = patientEntry.resource.name?.[0];
                    entry.resource._patientName = patientName 
                      ? `${patientName.given?.join(' ') || ''} ${patientName.family || ''}`.trim()
                      : 'Unknown';
                    allServiceRequests.push(entry);
                  }
                }
              }
            } else {
              const errorText = await response.text();
              console.log(`Patient ${patientId}: ${response.status} - ${errorText.slice(0, 100)}`);
            }
          } catch (err) {
            console.error(`Error fetching SR for patient ${patientId}:`, err);
          }
          
          processedCount++;
          if (processedCount % 25 === 0) {
            console.log(`Progress: ${processedCount}/${patientsToProcess.length} patients, ${allServiceRequests.length} ServiceRequests found`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log(`=== Total ServiceRequests found: ${allServiceRequests.length} ===`);
        
        // Update last_sync timestamp
        await supabaseClient
          .from("api_connections")
          .update({ last_sync: new Date().toISOString() })
          .eq("id", connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            resource: "ServiceRequest",
            category,
            dateRange: { from: authoredFrom, to: authoredTo },
            total: allServiceRequests.length,
            patientsProcessed: patientsToProcess.length,
            data: {
              resourceType: "Bundle",
              type: "searchset",
              total: allServiceRequests.length,
              entry: allServiceRequests,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Single patient ServiceRequest search
      if (!searchParams.patient) {
        throw new Error("ServiceRequest requires a patient ID. Use 'Fetch All' to get all service requests.");
      }
      
      let url = `${fhirBaseUrl}/ServiceRequest?patient=${searchParams.patient}`;
      if (category && SERVICE_CATEGORIES[category]) {
        url += `&category=${SERVICE_CATEGORIES[category]}`;
      }
      url += `&authored=ge${authoredFrom}&authored=le${authoredTo}`;
      
      console.log("ServiceRequest URL:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Accept": "application/fhir+json",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FHIR error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Update last_sync timestamp
      await supabaseClient
        .from("api_connections")
        .update({ last_sync: new Date().toISOString() })
        .eq("id", connectionId);

      return new Response(
        JSON.stringify({
          success: true,
          resource: "ServiceRequest",
          category,
          total: data.total || data.entry?.length || 0,
          data,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== OTHER RESOURCES ==========
    throw new Error(`Resource type '${resource}' not yet supported. Currently supports: Patient, ServiceRequest`);

  } catch (error) {
    console.error("Error in ecw-sync-data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
