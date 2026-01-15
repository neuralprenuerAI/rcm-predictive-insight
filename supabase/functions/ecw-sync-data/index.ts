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

// Helper: Fetch all patients using search terms (fast mode)
async function fetchAllPatients(fhirBaseUrl: string, accessToken: string): Promise<any[]> {
  console.log("=== Fetching ALL patients (comprehensive mode) ===");
  
  const isStaging = fhirBaseUrl.toLowerCase().includes('staging');
  const allPatients: any[] = [];
  const seenIds = new Set<string>();
  
  // For staging: use multiple search terms for maximum coverage
  // j=282, test=203, s=151, a=145 patients found in sandbox
  // For production: search common starting letters for full alphabet coverage
  const STAGING_SEARCH_TERMS = ['j', 'test', 's', 'a', 'e', 'i', 'o', 'u'];
  const PRODUCTION_SEARCH_TERMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'w'];
  
  const searchTerms = isStaging ? STAGING_SEARCH_TERMS : PRODUCTION_SEARCH_TERMS;
  
  console.log(`Environment: ${isStaging ? 'STAGING' : 'PRODUCTION'}`);
  console.log(`Using ${searchTerms.length} search terms: ${searchTerms.join(', ')}`);
  
  for (const term of searchTerms) {
    try {
      const searchUrl = `${fhirBaseUrl}/Patient?name=${term}`;
      console.log(`Searching: ?name=${term}`);
      
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
          let newCount = 0;
          for (const entry of data.entry) {
            const patientId = entry.resource?.id;
            if (patientId && !seenIds.has(patientId)) {
              seenIds.add(patientId);
              allPatients.push(entry);
              newCount++;
            }
          }
          console.log(`  Found ${count} patients for "${term}", ${newCount} new (total: ${allPatients.length})`);
        } else {
          console.log(`  Found 0 patients for "${term}"`);
        }
      } else {
        console.error(`  Error searching "${term}": ${response.status}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`  Exception searching "${term}":`, err);
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

    // Determine scope - for ServiceRequest, we need Patient scope too
    let scopeOverride: string | undefined;
    if (resource === "ServiceRequest") {
      const currentScope = credentials.scope || "";
      if (!currentScope.includes("system/Patient.read")) {
        scopeOverride = `system/Patient.read ${currentScope}`.trim();
        console.log("ServiceRequest needs Patient scope, using override:", scopeOverride);
      }
    }

    // Get fresh access token
    console.log("Getting fresh access token...");
    const tokenResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ecw-get-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify({ connectionId, scopeOverride }),
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
        // Default: all time for maximum coverage
        authoredFrom = "2000-01-01";
      }
      
      console.log(`ServiceRequest date range: ${authoredFrom} to ${authoredTo}`);
      
      if (fetchAll) {
        console.log("=== Fetching ServiceRequests (CHUNKED MODE) ===");
        
        // Get pagination params (for resume functionality)
        const startIndex = parseInt(searchParams.startIndex || "0");
        const chunkSize = 100; // Process 100 patients per request (safe for 60sec timeout)
        
        // Get patients from DATABASE (already synced)
        const { data: allPatients, error: patientsError } = await supabaseClient
          .from('patients')
          .select('external_id, first_name, last_name')
          .eq('source', 'ecw')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (patientsError || !allPatients?.length) {
          throw new Error("No patients found. Please sync Patients first.");
        }

        const totalPatients = allPatients.length;
        const patientsChunk = allPatients.slice(startIndex, startIndex + chunkSize);
        const endIndex = startIndex + patientsChunk.length;
        const hasMore = endIndex < totalPatients;
        
        console.log(`Processing patients ${startIndex + 1} to ${endIndex} of ${totalPatients}`);

        // Build URLs for this chunk
        const categoryCode = category && SERVICE_CATEGORIES[category] 
          ? SERVICE_CATEGORIES[category] 
          : null;

        // Process patients in parallel batches of 10
        const BATCH_SIZE = 10;
        const allServiceRequests: any[] = [];
        const seenIds = new Set<string>();
        let processedCount = 0;

        for (let i = 0; i < patientsChunk.length; i += BATCH_SIZE) {
          const batch = patientsChunk.slice(i, i + BATCH_SIZE);
          
          const batchPromises = batch.map(async (patient) => {
            const patientId = patient.external_id;
            const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
            
            let url = `${fhirBaseUrl}/ServiceRequest?patient=${patientId}&authored=ge${authoredFrom}&authored=le${authoredTo}`;
            if (categoryCode) {
              url += `&category=${categoryCode}`;
            }
            
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
                  return data.entry.map((entry: any) => ({
                    ...entry,
                    resource: {
                      ...entry.resource,
                      _patientName: patientName,
                      _patientExternalId: patientId
                    }
                  }));
                }
              }
              return [];
            } catch (err) {
              console.error(`Error for patient ${patientId}:`, err);
              return [];
            }
          });

          const batchResults = await Promise.all(batchPromises);
          
          for (const results of batchResults) {
            for (const entry of results) {
              const entryId = entry.resource?.id;
              if (entryId && !seenIds.has(entryId)) {
                seenIds.add(entryId);
                allServiceRequests.push(entry);
              }
            }
          }
          
          processedCount += batch.length;
          console.log(`Progress: ${startIndex + processedCount}/${totalPatients} patients, ${allServiceRequests.length} orders found`);
          
          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`=== Chunk complete: ${allServiceRequests.length} ServiceRequests found ===`);

        // Update last_sync timestamp only on final chunk
        if (!hasMore) {
          await supabaseClient
            .from("api_connections")
            .update({ last_sync: new Date().toISOString() })
            .eq("id", connectionId);
        }

        return new Response(
          JSON.stringify({
            success: true,
            resource: "ServiceRequest",
            category,
            dateRange: { from: authoredFrom, to: authoredTo },
            total: allServiceRequests.length,
            
            // Pagination info for auto-resume
            pagination: {
              startIndex,
              endIndex,
              totalPatients,
              hasMore,
              nextStartIndex: hasMore ? endIndex : null,
              processedInThisChunk: patientsChunk.length,
            },
            
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
