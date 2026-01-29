import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { logError, logOperation } from "../_shared/safeLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PatientUpdateRequest {
  connectionId: string;
  patientExternalId: string;
  accountNumber: string;
  patientLocalId?: string;
  data: {
    prefix?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    dateOfBirth: string;
    gender: string;
    active?: boolean;
    deceased?: boolean;
    maritalStatus?: string;
    phoneHome?: string;
    phoneWork?: string;
    phoneMobile?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    race?: string;
    ethnicity?: string;
    birthSex?: string;
    preferredLanguage?: string;
    emergencyContactName?: string;
    emergencyContactRelationship?: string;
    emergencyContactPhone?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: PatientUpdateRequest = await req.json();
    const { connectionId, patientExternalId, accountNumber, patientLocalId, data } = requestData;

    logOperation("ecw-patient-update", { 
      userId: user.id, 
      resourceType: "patient", 
      status: "started" 
    });

    // Validate required fields
    if (!data.firstName || !data.lastName) {
      throw new Error("First name and last name are required");
    }
    if (!data.gender) {
      throw new Error("Gender is required");
    }
    if (!data.dateOfBirth) {
      throw new Error("Date of birth is required for ECW patient matching");
    }
    if (!accountNumber && !patientExternalId) {
      throw new Error("Account number or patient external ID is required");
    }

    // Get connection credentials
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    const credentials = connection.credentials as {
      client_id: string;
      private_key: string;
      issuer_url: string;
      kid?: string;
      scope?: string;
    };
    
    const fhirBaseUrl = credentials.issuer_url;

    if (!fhirBaseUrl) {
      throw new Error("FHIR base URL not configured in connection");
    }

    // Get OAuth token with Patient.write scope
    console.log("Requesting token with Patient.write scope...");
    const tokenResponse = await supabaseClient.functions.invoke("ecw-get-token", {
      body: {
        connectionId,
        scopeOverride: "system/Patient.write system/Patient.read"
      }
    });

    if (tokenResponse.error || !tokenResponse.data?.access_token) {
      logError("Token error", tokenResponse.error || tokenResponse.data);
      throw new Error("Failed to get access token");
    }

    const accessToken = tokenResponse.data.access_token;

    // Build FHIR Patient resource per ECW documentation
    const patientResource = buildEcwPatientResourceForUpdate(
      patientExternalId || accountNumber,
      accountNumber,
      data
    );

    // Build the Bundle - MUST use method: "PUT" for update
    const bundle = {
      resourceType: "Bundle",
      id: "",
      meta: {
        lastUpdated: new Date().toISOString()
      },
      type: "transaction",
      entry: [{
        resource: patientResource,
        request: {
          method: "PUT",
          url: "Patient"
        }
      }]
    };

    console.log("Sending Patient Update Bundle to ECW FHIR API");

    // Send to ECW FHIR API
    const fhirResponse = await fetch(fhirBaseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/fhir+json",
        "Accept": "application/fhir+json"
      },
      body: JSON.stringify(bundle)
    });

    const responseText = await fhirResponse.text();
    console.log("ECW Response Status:", fhirResponse.status);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      throw new Error(`ECW returned invalid JSON: ${responseText.substring(0, 500)}`);
    }
    
    logOperation("ecw-patient-update", { 
      userId: user.id, 
      resourceType: "patient", 
      status: fhirResponse.ok ? "success" : "failed" 
    });

    // Check for errors
    if (!fhirResponse.ok) {
      const errorCode = responseData?.entry?.[0]?.response?.status || fhirResponse.status;
      let errorMessage = "Failed to update patient";
      
      switch (errorCode.toString()) {
        case "100":
          errorMessage = "Patient not found in ECW. Check account number and date of birth.";
          break;
        case "103":
          errorMessage = "Invalid patient ID. The patient ID could not be decrypted.";
          break;
        case "203":
          errorMessage = "Invalid characters in data or data truncation error.";
          break;
        case "401":
          errorMessage = "Authentication failed. Please reconnect to ECW.";
          break;
        case "403":
          errorMessage = "Not authorized. Check that Patient.write scope is enabled.";
          break;
        case "408":
          errorMessage = "Request timed out. Please try again.";
          break;
        case "500":
          errorMessage = "ECW server error. Please try again later.";
          break;
      }
      
      throw new Error(errorMessage);
    }

    // Check response status in Bundle
    const responseStatus = responseData?.entry?.[0]?.response?.status;
    if (responseStatus && responseStatus !== "1" && responseStatus !== "200" && responseStatus !== "201") {
      throw new Error(`ECW returned error status: ${responseStatus}`);
    }

    // Get the updated patient location/ID
    const updatedPatientLocation = responseData?.entry?.[0]?.response?.location;

    // Update local patient record sync timestamp if we have a local ID
    if (patientLocalId) {
      await supabaseClient
        .from("patients")
        .update({
          last_synced_at: new Date().toISOString()
        })
        .eq("id", patientLocalId);

      // Log to patient audit
      await supabaseClient
        .from("patient_audit_log")
        .insert({
          user_id: user.id,
          patient_id: patientLocalId,
          patient_external_id: patientExternalId,
          action: "update",
          source: "ecw",
          status: "success",
          after_data: data
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Patient updated successfully",
        patientLocation: updatedPatientLocation
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    logError("Patient update error", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update patient";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

function buildEcwPatientResourceForUpdate(
  patientExternalId: string,
  accountNumber: string,
  data: PatientUpdateRequest["data"]
): Record<string, unknown> {
  const resource: Record<string, unknown> = {
    resourceType: "Patient",
    id: patientExternalId,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
    },
    extension: [] as unknown[],
    identifier: [
      {
        use: "usual",
        system: "urn:oid:2.16.840.1.113883.4.391.326070",
        value: patientExternalId
      },
      {
        use: "secondary",
        system: "urn:oid:2.16.840.1.113883.4.391.326070",
        value: accountNumber
      }
    ],
    active: data.active !== undefined ? data.active : true,
    name: [{
      family: data.lastName,
      given: [data.firstName, data.middleName].filter(Boolean),
      prefix: data.prefix ? [data.prefix] : [],
      suffix: data.suffix ? [data.suffix] : []
    }],
    birthDate: data.dateOfBirth,
    gender: data.gender,
    telecom: [] as unknown[],
    address: [] as unknown[]
  };

  // Add telecom (phone numbers and email)
  const telecom = resource.telecom as unknown[];
  if (data.phoneHome) {
    telecom.push({ system: "phone", value: data.phoneHome, use: "home" });
  }
  if (data.phoneWork) {
    telecom.push({ system: "phone", value: data.phoneWork, use: "work" });
  }
  if (data.phoneMobile) {
    telecom.push({ system: "phone", value: data.phoneMobile, use: "mobile" });
  }
  if (data.email) {
    telecom.push({ system: "email", value: data.email, use: "home" });
  }

  // Add address if any address field is provided
  if (data.addressLine1 || data.city || data.state || data.postalCode) {
    const addressLines = [data.addressLine1, data.addressLine2].filter(Boolean);
    (resource.address as unknown[]).push({
      use: "home",
      line: addressLines,
      city: data.city || "",
      state: data.state || "",
      postalCode: data.postalCode || "",
      country: data.country || "US"
    });
  }

  // Add marital status if provided
  if (data.maritalStatus) {
    const maritalCodes: Record<string, string> = {
      "single": "S", "married": "M", "divorced": "D", "widowed": "W"
    };
    resource.maritalStatus = {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
        code: maritalCodes[data.maritalStatus.toLowerCase()] || data.maritalStatus
      }]
    };
  }

  // Add deceased if provided
  if (data.deceased !== undefined) {
    resource.deceasedBoolean = data.deceased;
  }

  // Add preferred language if provided
  if (data.preferredLanguage) {
    resource.communication = [{
      language: {
        coding: [{
          system: "urn:ietf:bcp:47",
          code: data.preferredLanguage,
          display: data.preferredLanguage
        }],
        text: data.preferredLanguage
      }
    }];
  }

  // Add US Core extensions
  const extensions = resource.extension as unknown[];

  // Race extension
  if (data.race) {
    extensions.push({
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      extension: [
        {
          url: "ombCategory",
          valueCoding: {
            system: "urn:oid:2.16.840.1.113883.6.238",
            code: getRaceCode(data.race),
            display: data.race
          }
        },
        { url: "text", valueString: data.race }
      ]
    });
  }

  // Ethnicity extension
  if (data.ethnicity) {
    extensions.push({
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
      extension: [
        {
          url: "ombCategory",
          valueCoding: {
            system: "urn:oid:2.16.840.1.113883.6.238",
            code: getEthnicityCode(data.ethnicity),
            display: data.ethnicity
          }
        },
        { url: "text", valueString: data.ethnicity }
      ]
    });
  }

  // Birth sex extension
  if (data.birthSex) {
    extensions.push({
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
      valueCode: data.birthSex
    });
  }

  // Add emergency contact if provided
  if (data.emergencyContactName) {
    const nameParts = data.emergencyContactName.split(" ");
    const contactFamily = nameParts.pop() || "";
    const contactGiven = nameParts;
    
    resource.contact = [{
      relationship: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v2-0131",
          code: data.emergencyContactRelationship || "E"
        }]
      }],
      name: {
        use: "usual",
        family: contactFamily,
        given: contactGiven
      },
      telecom: data.emergencyContactPhone ? [{
        system: "phone",
        value: data.emergencyContactPhone,
        use: "mobile"
      }] : []
    }];
  }

  // Clean up empty arrays
  if (extensions.length === 0) delete resource.extension;
  if ((resource.telecom as unknown[]).length === 0) delete resource.telecom;
  if ((resource.address as unknown[]).length === 0) delete resource.address;

  return resource;
}

function getRaceCode(race: string): string {
  const codes: Record<string, string> = {
    "white": "2106-3", "black": "2054-5", "asian": "2028-9",
    "american indian": "1002-5", "alaska native": "1002-5",
    "native hawaiian": "2076-8", "pacific islander": "2076-8",
    "other": "2131-1", "declined": "ASKU", "unknown": "UNK"
  };
  return codes[race.toLowerCase()] || "UNK";
}

function getEthnicityCode(ethnicity: string): string {
  const codes: Record<string, string> = {
    "hispanic": "2135-2", "latino": "2135-2",
    "hispanic or latino": "2135-2",
    "not hispanic": "2186-5", "not hispanic or latino": "2186-5",
    "declined": "ASKU", "unknown": "UNK"
  };
  return codes[ethnicity.toLowerCase()] || "UNK";
}
