import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// CMS-1500 FIELD STRUCTURE
// ============================================

interface CMS1500ServiceLine {
  line_number: number;
  date_of_service_from: string | null;
  date_of_service_to: string | null;
  place_of_service: string | null;
  emg: string | null;
  cpt_hcpcs: string | null;
  modifier_1: string | null;
  modifier_2: string | null;
  modifier_3: string | null;
  modifier_4: string | null;
  diagnosis_pointer: string | null;
  charges: number | null;
  units: number | null;
  epsdt_family_plan: string | null;
  rendering_provider_npi: string | null;
}

interface CMS1500Data {
  // Box 1: Insurance Type
  insurance_type: string | null;
  
  // Box 1a: Insured's ID Number
  insured_id: string | null;
  
  // Box 2: Patient's Name
  patient_name_last: string | null;
  patient_name_first: string | null;
  patient_name_middle: string | null;
  
  // Box 3: Patient's Birth Date & Sex
  patient_dob: string | null;
  patient_sex: string | null;
  
  // Box 4: Insured's Name
  insured_name: string | null;
  
  // Box 5: Patient's Address
  patient_address_street: string | null;
  patient_address_city: string | null;
  patient_address_state: string | null;
  patient_address_zip: string | null;
  patient_phone: string | null;
  
  // Box 6: Patient Relationship to Insured
  patient_relationship: string | null;
  
  // Box 7: Insured's Address
  insured_address_street: string | null;
  insured_address_city: string | null;
  insured_address_state: string | null;
  insured_address_zip: string | null;
  insured_phone: string | null;
  
  // Box 9: Other Insured's Name
  other_insured_name: string | null;
  
  // Box 9a: Other Insured's Policy/Group
  other_insured_policy: string | null;
  
  // Box 10: Is Condition Related To
  condition_employment: boolean;
  condition_auto_accident: boolean;
  condition_auto_accident_state: string | null;
  condition_other_accident: boolean;
  
  // Box 11: Insured's Policy Group
  insured_policy_group: string | null;
  
  // Box 11a: Insured's DOB & Sex
  insured_dob: string | null;
  insured_sex: string | null;
  
  // Box 11b: Other Claim ID
  other_claim_id: string | null;
  
  // Box 11c: Insurance Plan Name
  insurance_plan_name: string | null;
  
  // Box 11d: Another Health Benefit Plan?
  another_health_plan: boolean;
  
  // Box 14: Date of Current Illness/Injury
  current_illness_date: string | null;
  illness_qualifier: string | null;
  
  // Box 15: Other Date
  other_date: string | null;
  other_date_qualifier: string | null;
  
  // Box 16: Dates Unable to Work
  unable_to_work_from: string | null;
  unable_to_work_to: string | null;
  
  // Box 17: Referring Provider
  referring_provider_name: string | null;
  referring_provider_qualifier: string | null;
  
  // Box 17a: Referring Provider Other ID
  referring_provider_other_id: string | null;
  
  // Box 17b: Referring Provider NPI
  referring_provider_npi: string | null;
  
  // Box 18: Hospitalization Dates
  hospitalization_from: string | null;
  hospitalization_to: string | null;
  
  // Box 19: Additional Claim Information
  additional_claim_info: string | null;
  
  // Box 20: Outside Lab
  outside_lab: boolean;
  outside_lab_charges: number | null;
  
  // Box 21: Diagnosis Codes
  icd_indicator: string | null;
  diagnosis_codes: string[];
  
  // Box 22: Resubmission Code
  resubmission_code: string | null;
  original_ref_number: string | null;
  
  // Box 23: Prior Authorization Number
  prior_auth_number: string | null;
  
  // Box 24: Service Lines
  service_lines: CMS1500ServiceLine[];
  
  // Box 25: Federal Tax ID
  federal_tax_id: string | null;
  tax_id_type: string | null;
  
  // Box 26: Patient's Account Number
  patient_account_number: string | null;
  
  // Box 27: Accept Assignment
  accept_assignment: boolean;
  
  // Box 28: Total Charge
  total_charge: number | null;
  
  // Box 29: Amount Paid
  amount_paid: number | null;
  
  // Box 31: Physician Signature & Date
  physician_signature: string | null;
  physician_signature_date: string | null;
  
  // Box 32: Service Facility
  service_facility_name: string | null;
  service_facility_address: string | null;
  service_facility_city_state_zip: string | null;
  service_facility_npi: string | null;
  service_facility_other_id: string | null;
  
  // Box 33: Billing Provider
  billing_provider_name: string | null;
  billing_provider_address: string | null;
  billing_provider_city_state_zip: string | null;
  billing_provider_phone: string | null;
  billing_provider_npi: string | null;
  billing_provider_other_id: string | null;
}

// ============================================
// BUILD GEMINI EXTRACTION PROMPT
// ============================================

function buildExtractionPrompt(ocrText: string): string {
  return `You are an expert medical billing specialist with 20+ years of experience reading CMS-1500 (HCFA-1500) claim forms. 

Analyze this OCR text extracted from a CMS-1500 form and extract ALL fields into a structured JSON format.

## OCR TEXT FROM CMS-1500:
"""
${ocrText}
"""

## EXTRACTION TASK

Parse every field from the CMS-1500 form. The standard CMS-1500 has 33 boxes. Extract data into this exact JSON structure (respond with ONLY the JSON, no markdown):

{
  "insurance_type": "<medicare|medicaid|tricare|champva|group_health|feca|other|null>",
  "insured_id": "<Box 1a value or null>",
  
  "patient_name_last": "<last name or null>",
  "patient_name_first": "<first name or null>",
  "patient_name_middle": "<middle or null>",
  
  "patient_dob": "<YYYY-MM-DD format or null>",
  "patient_sex": "<M|F or null>",
  
  "insured_name": "<Box 4 or null>",
  
  "patient_address_street": "<street or null>",
  "patient_address_city": "<city or null>",
  "patient_address_state": "<2-letter state or null>",
  "patient_address_zip": "<zip or null>",
  "patient_phone": "<phone or null>",
  
  "patient_relationship": "<self|spouse|child|other or null>",
  
  "insured_address_street": "<street or null>",
  "insured_address_city": "<city or null>",
  "insured_address_state": "<state or null>",
  "insured_address_zip": "<zip or null>",
  "insured_phone": "<phone or null>",
  
  "other_insured_name": "<Box 9 or null>",
  "other_insured_policy": "<Box 9a or null>",
  
  "condition_employment": <true|false>,
  "condition_auto_accident": <true|false>,
  "condition_auto_accident_state": "<state or null>",
  "condition_other_accident": <true|false>,
  
  "insured_policy_group": "<Box 11 group number or null>",
  "insured_dob": "<YYYY-MM-DD or null>",
  "insured_sex": "<M|F or null>",
  "other_claim_id": "<Box 11b or null>",
  "insurance_plan_name": "<Box 11c payer name or null>",
  "another_health_plan": <true|false>,
  
  "current_illness_date": "<YYYY-MM-DD or null>",
  "illness_qualifier": "<431|484 or null>",
  
  "other_date": "<YYYY-MM-DD or null>",
  "other_date_qualifier": "<qualifier or null>",
  
  "unable_to_work_from": "<YYYY-MM-DD or null>",
  "unable_to_work_to": "<YYYY-MM-DD or null>",
  
  "referring_provider_name": "<name or null>",
  "referring_provider_qualifier": "<DN|DK|DQ or null>",
  "referring_provider_other_id": "<other ID or null>",
  "referring_provider_npi": "<10-digit NPI or null>",
  
  "hospitalization_from": "<YYYY-MM-DD or null>",
  "hospitalization_to": "<YYYY-MM-DD or null>",
  
  "additional_claim_info": "<Box 19 text or null>",
  
  "outside_lab": <true|false>,
  "outside_lab_charges": <number or null>,
  
  "icd_indicator": "<0 for ICD-10, 9 for ICD-9>",
  "diagnosis_codes": ["<code1>", "<code2>", "...up to 12 codes"],
  
  "resubmission_code": "<code or null>",
  "original_ref_number": "<ref or null>",
  
  "prior_auth_number": "<Box 23 or null>",
  
  "service_lines": [
    {
      "line_number": 1,
      "date_of_service_from": "<YYYY-MM-DD>",
      "date_of_service_to": "<YYYY-MM-DD>",
      "place_of_service": "<2-digit POS code>",
      "emg": "<Y|N or null>",
      "cpt_hcpcs": "<5-digit code>",
      "modifier_1": "<modifier or null>",
      "modifier_2": "<modifier or null>",
      "modifier_3": "<modifier or null>",
      "modifier_4": "<modifier or null>",
      "diagnosis_pointer": "<A,B,C,D format>",
      "charges": <number>,
      "units": <number>,
      "epsdt_family_plan": "<code or null>",
      "rendering_provider_npi": "<NPI or null>"
    }
  ],
  
  "federal_tax_id": "<EIN or SSN>",
  "tax_id_type": "<EIN|SSN>",
  
  "patient_account_number": "<account number or null>",
  
  "accept_assignment": <true|false>,
  
  "total_charge": <number>,
  "amount_paid": <number or 0>,
  
  "physician_signature": "<signature text or 'SIGNATURE ON FILE'>",
  "physician_signature_date": "<YYYY-MM-DD or null>",
  
  "service_facility_name": "<name or null>",
  "service_facility_address": "<full address or null>",
  "service_facility_city_state_zip": "<city state zip or null>",
  "service_facility_npi": "<NPI or null>",
  "service_facility_other_id": "<other ID or null>",
  
  "billing_provider_name": "<name>",
  "billing_provider_address": "<address>",
  "billing_provider_city_state_zip": "<city state zip>",
  "billing_provider_phone": "<phone or null>",
  "billing_provider_npi": "<10-digit NPI>",
  "billing_provider_other_id": "<other ID or null>"
}

## CRITICAL PARSING RULES:

1. **Dates**: Convert ALL dates to YYYY-MM-DD format. If you see "07 18 25" or "07/18/25", convert to "2025-07-18"
2. **Money**: Extract as numbers only (no $ or commas). "$1,574.00" becomes 1574.00
3. **Diagnosis Codes**: Include the decimal point if present. "R55" stays "R55", "R00.2" stays "R00.2"
4. **CPT Codes**: 5 digits. "93229" stays "93229"
5. **NPI**: Always 10 digits
6. **Service Lines**: Extract ALL service lines (up to 6). Each line has DOS, POS, CPT, modifiers, charges, units
7. **Modifiers**: Often appear after CPT code, separated by spaces
8. **Sex**: Extract as M or F only
9. **If a field is empty or unclear, use null**

## COMMON OCR ISSUES TO HANDLE:
- "X" marks in checkboxes indicate true/selected
- Numbers might have OCR errors (0 vs O, 1 vs l)
- State abbreviations are 2 letters
- Look for patterns to identify fields even if labels are unclear

Respond with ONLY the JSON object, no additional text.`;
}

// ============================================
// CALL GEMINI FOR EXTRACTION
// ============================================

async function extractWithGemini(ocrText: string, apiKey: string): Promise<CMS1500Data> {
  const prompt = buildExtractionPrompt(ocrText);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Gemini response:", responseText);
    throw new Error("Could not parse extraction result");
  }

  return JSON.parse(jsonMatch[0]) as CMS1500Data;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      content,
      ocrText,
      filename,
      documentId,
      createClaim = true,
    } = await req.json();

    if (!content && !ocrText) {
      throw new Error("Missing required field: content or ocrText");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`Parsing CMS-1500: ${filename || 'unknown'}`);
    const startTime = Date.now();

    // Step 1: Get OCR text if not provided
    let textContent = ocrText;
    
    if (!textContent && content) {
      const authToken = authHeader.replace('Bearer ', '');
      const ocrResponse = await fetch(`${supabaseUrl}/functions/v1/ocr-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content,
          filename,
          mimeType: 'application/pdf',
        }),
      });

      if (!ocrResponse.ok) {
        throw new Error(`OCR failed: ${ocrResponse.status}`);
      }

      const ocrResult = await ocrResponse.json();
      if (!ocrResult.success) {
        throw new Error(`OCR failed: ${ocrResult.error}`);
      }

      textContent = ocrResult.ocr?.text || '';
      console.log(`OCR extracted ${textContent.length} characters`);
    }

    if (!textContent || textContent.length < 100) {
      throw new Error("Insufficient text extracted from document");
    }

    // Step 2: Extract structured data with Gemini
    console.log("Extracting CMS-1500 fields with AI...");
    const extracted = await extractWithGemini(textContent, geminiKey);
    
    const processingTime = Date.now() - startTime;
    console.log(`Extracted: ${extracted.patient_name_last}, ${extracted.service_lines?.length || 0} service lines, $${extracted.total_charge}`);

    // Step 3: Create claim record if requested
    let claimId: string | null = null;
    
    if (createClaim) {
      const primaryDiagnosis = extracted.diagnosis_codes?.[0] || null;
      const firstLine = extracted.service_lines?.[0];
      
      // Generate a claim_id string (required field)
      const claimIdStr = extracted.patient_account_number || `CMS-${Date.now()}`;
      
      const claimData = {
        user_id: user.id,
        claim_id: claimIdStr,
        patient_name: `${extracted.patient_name_last || ''}, ${extracted.patient_name_first || ''}`.trim() || 'Unknown Patient',
        date_of_service: firstLine?.date_of_service_from || new Date().toISOString().split('T')[0],
        procedure_code: firstLine?.cpt_hcpcs || null,
        diagnosis_code: primaryDiagnosis,
        billed_amount: extracted.total_charge || 0,
        provider: extracted.billing_provider_name || 'Unknown Provider',
        payer: extracted.insurance_plan_name,
        status: 'pending',
      };

      const { data: claim, error: claimError } = await supabaseClient
        .from('claims')
        .insert(claimData)
        .select('id')
        .single();

      if (claimError) {
        console.error('Error creating claim:', claimError);
      } else {
        claimId = claim.id;
        console.log(`Created claim: ${claimId}`);
      }

      // Link document to claim if both exist
      if (claimId && documentId) {
        await supabaseClient
          .from('claim_documents')
          .insert({
            user_id: user.id,
            claim_id: claimId,
            document_id: documentId,
            document_role: 'supporting',
            is_primary: true,
          });
      }
    }

    // Step 4: Update document record if provided
    if (documentId) {
      await supabaseClient
        .from('documents')
        .update({
          document_type: 'cms_1500',
          status: 'completed',
          extracted_data: {
            cms1500: extracted,
            claim_id: claimId,
          },
          processed_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', user.id);
    }

    // Build response
    const result = {
      success: true,
      processing_time_ms: processingTime,
      extracted: {
        patient: {
          name: `${extracted.patient_name_first || ''} ${extracted.patient_name_last || ''}`.trim(),
          dob: extracted.patient_dob,
          sex: extracted.patient_sex,
          address: {
            street: extracted.patient_address_street,
            city: extracted.patient_address_city,
            state: extracted.patient_address_state,
            zip: extracted.patient_address_zip,
          },
          phone: extracted.patient_phone,
          account_number: extracted.patient_account_number,
        },
        insurance: {
          type: extracted.insurance_type,
          payer_name: extracted.insurance_plan_name,
          insured_id: extracted.insured_id,
          group_number: extracted.insured_policy_group,
          insured_name: extracted.insured_name,
        },
        diagnoses: extracted.diagnosis_codes,
        icd_version: extracted.icd_indicator === '0' ? 'ICD-10' : 'ICD-9',
        service_lines: extracted.service_lines,
        totals: {
          total_charge: extracted.total_charge,
          amount_paid: extracted.amount_paid,
          balance: (extracted.total_charge || 0) - (extracted.amount_paid || 0),
        },
        provider: {
          billing_name: extracted.billing_provider_name,
          billing_npi: extracted.billing_provider_npi,
          billing_address: extracted.billing_provider_city_state_zip,
          referring_name: extracted.referring_provider_name,
          referring_npi: extracted.referring_provider_npi,
        },
        facility: {
          name: extracted.service_facility_name,
          npi: extracted.service_facility_npi,
          address: extracted.service_facility_city_state_zip,
        },
        authorization: {
          prior_auth_number: extracted.prior_auth_number,
          accept_assignment: extracted.accept_assignment,
        },
        dates: {
          illness_date: extracted.current_illness_date,
          hospitalization_from: extracted.hospitalization_from,
          hospitalization_to: extracted.hospitalization_to,
        },
      },
      raw_extracted: extracted,
      claim_id: claimId,
      document_id: documentId,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-cms1500:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
