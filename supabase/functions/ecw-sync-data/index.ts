import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to fetch FHIR bundle with pagination
async function fetchFHIRResource(fhirBase: string, resource: string, accessToken: string, maxPages = 5): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${fhirBase}/${resource}?_count=100`;
  let pageCount = 0;

  while (url && pageCount < maxPages) {
    console.log(`Fetching ${resource} page ${pageCount + 1}:`, url);
    
    const fetchResponse: Response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/fhir+json",
      },
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error(`FHIR ${resource} fetch failed:`, fetchResponse.status, errorText);
      throw new Error(`FHIR ${resource} fetch failed: ${fetchResponse.status}`);
    }

    const bundle: any = await fetchResponse.json();
    console.log(`${resource} bundle total:`, bundle.total, "entries:", bundle.entry?.length || 0);

    if (bundle.entry) {
      results.push(...bundle.entry.map((e: any) => e.resource));
    }

    // Handle pagination
    const nextLink: any = bundle.link?.find((l: any) => l.relation === "next");
    url = nextLink?.url || null;
    pageCount++;
  }

  return results;
}

// Transform FHIR Claim to our claims table format
function transformClaim(fhirClaim: any, userId: string) {
  return {
    user_id: userId,
    claim_id: fhirClaim.identifier?.[0]?.value || `ECW-${fhirClaim.id}`,
    patient_name: fhirClaim.patient?.display || "Unknown Patient",
    date_of_service: fhirClaim.billablePeriod?.start || fhirClaim.created?.split("T")[0] || new Date().toISOString().split("T")[0],
    billed_amount: fhirClaim.total?.value || 0,
    status: fhirClaim.status === "active" ? "pending" : (fhirClaim.status || "pending"),
    payer: fhirClaim.insurer?.display || fhirClaim.insurance?.[0]?.coverage?.display || null,
    provider: fhirClaim.provider?.display || "Unknown Provider",
    diagnosis_code: fhirClaim.diagnosis?.map((d: any) => d.diagnosisCodeableConcept?.coding?.[0]?.code).filter(Boolean).join(", ") || null,
    procedure_code: fhirClaim.item?.map((i: any) => i.productOrService?.coding?.[0]?.code).filter(Boolean).join(", ") || null,
    fhir_id: fhirClaim.id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, environment = "sandbox", options = {} } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    console.log("Starting ECW sync for connection:", connectionId);

    // Get access token by calling the ecw-get-token function
    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/ecw-get-token`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connectionId, environment }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error || "Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("No access token received");
    }

    // Fetch connection to get dynamic FHIR URL from credentials
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    // Get FHIR base URL from credentials
    const credentials = connection.credentials as any;
    const FHIR_BASE = credentials?.issuer_url?.replace(/\/$/, "") || "https://staging-fhir.ecwcloud.com/fhir/r4/FFBJCD";

    console.log("Access token obtained, fetching FHIR resources from:", FHIR_BASE);

    const summary = {
      patients: 0,
      encounters: 0,
      claims: 0,
      coverages: 0,
      errors: [] as string[],
    };

    // Sync Claims
    const syncClaims = options.syncClaims !== false;
    if (syncClaims) {
      try {
        console.log("Fetching Claims from FHIR...");
        const fhirClaims = await fetchFHIRResource(FHIR_BASE, "Claim", accessToken);
        console.log(`Retrieved ${fhirClaims.length} claims`);

        if (fhirClaims.length > 0) {
          const transformedClaims = fhirClaims.map(claim => transformClaim(claim, user.id));

          // Upsert claims (use fhir_id + user_id as unique constraint)
          for (const claim of transformedClaims) {
            const { error } = await supabaseClient
              .from("claims")
              .upsert(claim, {
                onConflict: "fhir_id,user_id",
                ignoreDuplicates: false,
              });

            if (error) {
              console.error("Error upserting claim:", error);
              summary.errors.push(`Claim ${claim.claim_id}: ${error.message}`);
            } else {
              summary.claims++;
            }
          }
        }
      } catch (err) {
        console.error("Error syncing claims:", err);
        summary.errors.push(`Claims sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Sync Patients (for reference)
    const syncPatients = options.syncPatients !== false;
    if (syncPatients) {
      try {
        console.log("Fetching Patients from FHIR...");
        const fhirPatients = await fetchFHIRResource(FHIR_BASE, "Patient", accessToken, 2);
        summary.patients = fhirPatients.length;
        console.log(`Retrieved ${fhirPatients.length} patients`);
      } catch (err) {
        console.error("Error syncing patients:", err);
        summary.errors.push(`Patients sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Sync Encounters
    const syncEncounters = options.syncEncounters !== false;
    if (syncEncounters) {
      try {
        console.log("Fetching Encounters from FHIR...");
        const fhirEncounters = await fetchFHIRResource(FHIR_BASE, "Encounter", accessToken, 2);
        summary.encounters = fhirEncounters.length;
        console.log(`Retrieved ${fhirEncounters.length} encounters`);
      } catch (err) {
        console.error("Error syncing encounters:", err);
        summary.errors.push(`Encounters sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Sync Coverages
    const syncCoverages = options.syncCoverages !== false;
    if (syncCoverages) {
      try {
        console.log("Fetching Coverages from FHIR...");
        const fhirCoverages = await fetchFHIRResource(FHIR_BASE, "Coverage", accessToken, 2);
        summary.coverages = fhirCoverages.length;
        console.log(`Retrieved ${fhirCoverages.length} coverages`);
      } catch (err) {
        console.error("Error syncing coverages:", err);
        summary.errors.push(`Coverages sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Update last_sync timestamp on the connection
    await supabaseClient
      .from("api_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("id", connectionId);

    console.log("ECW sync completed:", summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ecw-sync-data:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
