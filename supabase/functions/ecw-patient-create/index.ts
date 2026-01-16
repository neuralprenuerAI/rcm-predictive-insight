import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PatientCreateRequest {
  connectionId: string;
  accountNumber: string;
  data: {
    prefix?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    birthDate: string;
    gender: string;
    active?: boolean;
    maritalStatus?: string;
    homePhone?: string;
    workPhone?: string;
    mobilePhone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    race?: { code: string; display: string };
    ethnicity?: { code: string; display: string };
    birthSex?: string;
    preferredLanguage?: { code: string; display: string };
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

    const requestData: PatientCreateRequest = await req.json();
    const { connectionId, accountNumber, data } = requestData;

    if (!accountNumber || !accountNumber.trim()) {
      throw new Error("Account number is required for creating a new patient");
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

    const credentials = connection.credentials as Record<string, unknown>;
    const fhirBaseUrl = credentials.issuer_url as string;

    // Get OAuth token with Patient.create scope
    const tokenResponse = await supabaseClient.functions.invoke("ecw-get-token", {
      body: {
        connectionId,
        scopeOverride: "system/Patient.create system/Patient.read"
      }
    });

    if (tokenResponse.error || !tokenResponse.data?.access_token) {
      throw new Error("Failed to get access token: " + JSON.stringify(tokenResponse.error));
    }

    const accessToken = tokenResponse.data.access_token;

    // Build FHIR Patient resource per ECW documentation
    const patientResource: Record<string, unknown> = {
      resourceType: "Patient",
      id: accountNumber,
      meta: {
        lastUpdated: new Date().toISOString(),
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
      },
      extension: [],
      identifier: [
        {
          use: "usual",
          system: "urn:oid:2.16.840.1.113883.4.391.326070",
          value: accountNumber
        },
        {
          use: "secondary",
          system: "urn:oid:2.16.840.1.113883.4.391.326070",
          value: accountNumber
        }
      ],
      active: data.active !== undefined ? data.active : true,
      name: [{
        text: `${data.firstName} ${data.lastName}`,
        family: data.lastName,
        given: [data.firstName, data.middleName].filter(Boolean),
        prefix: data.prefix ? [data.prefix] : [],
        suffix: data.suffix ? [data.suffix] : []
      }],
      birthDate: data.birthDate,
      gender: data.gender,
      telecom: [],
      address: []
    };

    const extensions = patientResource.extension as Record<string, unknown>[];
    const telecom = patientResource.telecom as Record<string, unknown>[];
    const address = patientResource.address as Record<string, unknown>[];

    // Add race extension if provided
    if (data.race && data.race.code !== "unspecified") {
      extensions.push({
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
        extension: [
          {
            url: "ombCategory",
            valueCoding: {
              system: "urn:oid:2.16.840.1.113883.6.238",
              code: data.race.code,
              display: data.race.display
            }
          },
          {
            url: "text",
            valueString: data.race.display
          }
        ]
      });
    }

    // Add ethnicity extension if provided
    if (data.ethnicity && data.ethnicity.code !== "unspecified") {
      extensions.push({
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
        extension: [
          {
            url: "ombCategory",
            valueCoding: {
              system: "urn:oid:2.16.840.1.113883.6.238",
              code: data.ethnicity.code,
              display: data.ethnicity.display
            }
          },
          {
            url: "text",
            valueString: data.ethnicity.display
          }
        ]
      });
    }

    // Add birth sex extension if provided
    if (data.birthSex && data.birthSex !== "unspecified") {
      extensions.push({
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
        valueCode: data.birthSex
      });
    }

    // Add telecom (phone numbers and email)
    if (data.homePhone) {
      telecom.push({
        system: "phone",
        value: data.homePhone,
        use: "home"
      });
    }
    if (data.workPhone) {
      telecom.push({
        system: "phone",
        value: data.workPhone,
        use: "work"
      });
    }
    if (data.mobilePhone) {
      telecom.push({
        system: "phone",
        value: data.mobilePhone,
        use: "mobile"
      });
    }
    if (data.email) {
      telecom.push({
        system: "email",
        value: data.email,
        use: "home"
      });
    }

    // Add address if any address field is provided
    if (data.addressLine1 || data.city || data.state || data.postalCode) {
      const addressLines = [data.addressLine1, data.addressLine2].filter(Boolean);
      address.push({
        use: "home",
        text: addressLines.join(", ") + (data.city ? `, ${data.city}` : "") + (data.state ? `, ${data.state}` : "") + (data.postalCode ? ` ${data.postalCode}` : ""),
        line: addressLines,
        city: data.city || "",
        state: data.state || "",
        postalCode: data.postalCode || "",
        country: data.country || "US"
      });
    }

    // Add marital status if provided
    if (data.maritalStatus && data.maritalStatus !== "unspecified") {
      patientResource.maritalStatus = {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
          code: data.maritalStatus
        }]
      };
    }

    // Add preferred language if provided
    if (data.preferredLanguage && data.preferredLanguage.code !== "unspecified") {
      patientResource.communication = [{
        language: {
          coding: [{
            system: "urn:ietf:bcp:47",
            code: data.preferredLanguage.code,
            display: data.preferredLanguage.display
          }],
          text: data.preferredLanguage.display
        }
      }];
    }

    // Add emergency contact if provided
    if (data.emergencyContactName) {
      const nameParts = data.emergencyContactName.split(" ");
      const contactFamily = nameParts.pop() || "";
      const contactGiven = nameParts;
      
      patientResource.contact = [{
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

    // Build the Bundle per ECW documentation - NOTE: method is POST for create
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
          method: "POST",
          url: "Patient"
        }
      }]
    };

    console.log("Sending Patient Create Bundle:", JSON.stringify(bundle, null, 2));

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

    const responseData = await fhirResponse.json();
    console.log("ECW Response:", JSON.stringify(responseData, null, 2));

    // Check for errors
    if (!fhirResponse.ok) {
      const errorCode = responseData?.entry?.[0]?.response?.status || fhirResponse.status;
      let errorMessage = "Failed to create patient";
      
      switch (errorCode.toString()) {
        case "100":
          errorMessage = "A patient with this account number already exists in ECW.";
          break;
        case "103":
          errorMessage = "Invalid patient ID format.";
          break;
        case "203":
          errorMessage = "Invalid characters in data or data truncation error.";
          break;
        case "401":
          errorMessage = "Authentication failed. Please reconnect to ECW.";
          break;
        case "403":
          errorMessage = "Not authorized. Check that Patient.create scope is enabled.";
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
      // Check if it's a duplicate error
      if (responseStatus === "100") {
        throw new Error("A patient with this account number already exists in ECW.");
      }
      throw new Error(`ECW returned error status: ${responseStatus}`);
    }

    // Get the new patient location/ID from ECW response
    const newPatientLocation = responseData?.entry?.[0]?.response?.location;
    const newPatientExternalId = newPatientLocation?.split("/").pop() || accountNumber;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Patient created successfully",
        patientLocation: newPatientLocation,
        externalId: newPatientExternalId,
        response: responseData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Patient create error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create patient"
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
