import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedPatient {
  // Name
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  prefix: string | null;
  suffix: string | null;
  
  // Demographics
  dateOfBirth: string | null;
  gender: "male" | "female" | "other" | "unknown" | null;
  ssn: string | null;
  maritalStatus: string | null;
  
  // Contact
  email: string | null;
  phoneHome: string | null;
  phoneWork: string | null;
  phoneMobile: string | null;
  
  // Address
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  
  // Insurance
  insuranceName: string | null;
  insurancePolicyNumber: string | null;
  insuranceGroupNumber: string | null;
  insuranceSubscriberId: string | null;
  insuranceSubscriberName: string | null;
  insuranceSubscriberDob: string | null;
  insuranceRelationship: string | null;
  
  // Emergency Contact
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  
  // Medical
  preferredLanguage: string | null;
  race: string | null;
  ethnicity: string | null;
  
  // Metadata
  confidence: number;
  extractedFields: string[];
  rawText: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ocrText, documentType } = await req.json();

    if (!ocrText) {
      throw new Error("ocrText is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Extracting patient data from ${documentType || "unknown"} document (${ocrText.length} chars)`);

    const systemPrompt = `You are a healthcare data extraction specialist. Your task is to extract patient information from OCR text of medical documents.

IMPORTANT RULES:
1. Extract ONLY information that is clearly present in the text
2. If a field is not found or unclear, return null for that field
3. Format dates as YYYY-MM-DD
4. Format phone numbers as digits only (e.g., "5551234567")
5. Format state as 2-letter code (e.g., "TX" not "Texas")
6. For SSN, extract ONLY the last 4 digits for privacy
7. Be conservative - if unsure, return null rather than guess
8. Calculate a confidence score (0-1) based on how clear the extracted data is

DOCUMENT TYPE HINTS:
- "patient_intake" = Patient registration/intake form
- "insurance_card" = Insurance card (front/back)
- "cms1500" = CMS-1500 claim form
- "drivers_license" = Driver's license or ID
- "unknown" = Unknown document type`;

    const userPrompt = `Extract patient information from this ${documentType || "medical document"} OCR text:

---
${ocrText}
---

Return ONLY a valid JSON object with these fields (use null for missing fields):
{
  "firstName": string | null,
  "middleName": string | null,
  "lastName": string | null,
  "prefix": string | null,
  "suffix": string | null,
  "dateOfBirth": string | null,
  "gender": "male" | "female" | "other" | "unknown" | null,
  "ssn": string | null,
  "maritalStatus": string | null,
  "email": string | null,
  "phoneHome": string | null,
  "phoneWork": string | null,
  "phoneMobile": string | null,
  "addressLine1": string | null,
  "addressLine2": string | null,
  "city": string | null,
  "state": string | null,
  "postalCode": string | null,
  "country": string | null,
  "insuranceName": string | null,
  "insurancePolicyNumber": string | null,
  "insuranceGroupNumber": string | null,
  "insuranceSubscriberId": string | null,
  "insuranceSubscriberName": string | null,
  "insuranceSubscriberDob": string | null,
  "insuranceRelationship": string | null,
  "emergencyContactName": string | null,
  "emergencyContactPhone": string | null,
  "emergencyContactRelationship": string | null,
  "preferredLanguage": string | null,
  "race": string | null,
  "ethnicity": string | null,
  "confidence": number,
  "extractedFields": string[]
}`;

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const aiText = aiResponse.choices?.[0]?.message?.content || "";

    console.log("AI extraction complete, parsing response...");

    // Parse the JSON from AI response
    let extractedData: ExtractedPatient;
    try {
      let cleanJson = aiText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      extractedData = JSON.parse(cleanJson);
      extractedData.rawText = ocrText;
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiText);
      throw new Error("Failed to parse extracted data from AI response");
    }

    // Validate and clean the data
    const cleanedData = cleanExtractedData(extractedData);

    console.log(`Extracted ${cleanedData.extractedFields.length} fields with ${(cleanedData.confidence * 100).toFixed(0)}% confidence`);

    return new Response(
      JSON.stringify({
        success: true,
        patient: cleanedData,
        documentType: documentType || "unknown"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract patient data"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to clean and validate extracted data
function cleanExtractedData(data: any): ExtractedPatient {
  return {
    firstName: cleanString(data.firstName),
    middleName: cleanString(data.middleName),
    lastName: cleanString(data.lastName),
    prefix: cleanString(data.prefix),
    suffix: cleanString(data.suffix),
    dateOfBirth: cleanDate(data.dateOfBirth),
    gender: cleanGender(data.gender),
    ssn: cleanSSN(data.ssn),
    maritalStatus: cleanString(data.maritalStatus),
    email: cleanEmail(data.email),
    phoneHome: cleanPhone(data.phoneHome),
    phoneWork: cleanPhone(data.phoneWork),
    phoneMobile: cleanPhone(data.phoneMobile),
    addressLine1: cleanString(data.addressLine1),
    addressLine2: cleanString(data.addressLine2),
    city: cleanString(data.city),
    state: cleanState(data.state),
    postalCode: cleanPostalCode(data.postalCode),
    country: cleanString(data.country) || "US",
    insuranceName: cleanString(data.insuranceName),
    insurancePolicyNumber: cleanString(data.insurancePolicyNumber),
    insuranceGroupNumber: cleanString(data.insuranceGroupNumber),
    insuranceSubscriberId: cleanString(data.insuranceSubscriberId),
    insuranceSubscriberName: cleanString(data.insuranceSubscriberName),
    insuranceSubscriberDob: cleanDate(data.insuranceSubscriberDob),
    insuranceRelationship: cleanString(data.insuranceRelationship),
    emergencyContactName: cleanString(data.emergencyContactName),
    emergencyContactPhone: cleanPhone(data.emergencyContactPhone),
    emergencyContactRelationship: cleanString(data.emergencyContactRelationship),
    preferredLanguage: cleanString(data.preferredLanguage),
    race: cleanString(data.race),
    ethnicity: cleanString(data.ethnicity),
    confidence: typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0.5,
    extractedFields: Array.isArray(data.extractedFields) ? data.extractedFields : [],
    rawText: data.rawText || ""
  };
}

function cleanString(value: any): string | null {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanDate(value: any): string | null {
  if (!value) return null;
  const dateStr = String(value).trim();
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        return dateStr;
      } else {
        const [_, month, day, year] = match;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
  }
  
  return null;
}

function cleanGender(value: any): "male" | "female" | "other" | "unknown" | null {
  if (!value) return null;
  const gender = String(value).toLowerCase().trim();
  if (gender === "male" || gender === "m") return "male";
  if (gender === "female" || gender === "f") return "female";
  if (gender === "other") return "other";
  if (gender === "unknown") return "unknown";
  return null;
}

function cleanSSN(value: any): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return null;
}

function cleanEmail(value: any): string | null {
  if (!value) return null;
  const email = String(value).trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email;
  }
  return null;
}

function cleanPhone(value: any): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function cleanState(value: any): string | null {
  if (!value) return null;
  const state = String(value).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(state)) {
    return state;
  }
  const stateMap: Record<string, string> = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
    "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
    "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
    "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
    "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
    "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
    "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
    "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
    "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT",
    "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV",
    "WISCONSIN": "WI", "WYOMING": "WY"
  };
  return stateMap[state] || null;
}

function cleanPostalCode(value: any): string | null {
  if (!value) return null;
  const zip = String(value).replace(/\D/g, "");
  if (zip.length === 5 || zip.length === 9) {
    return zip.length === 9 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
  }
  return zip.length >= 5 ? zip.slice(0, 5) : null;
}
