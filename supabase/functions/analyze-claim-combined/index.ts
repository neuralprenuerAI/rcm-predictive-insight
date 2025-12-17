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
    const { claimContent, clinicalNotesContent, claimFilename, notesFilename } = await req.json();

    if (!claimContent) {
      throw new Error("Missing required field: claimContent");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Analyzing claim via Lovable AI. Has clinical notes: ${!!clinicalNotesContent}`);
    const startTime = Date.now();

    // Build comprehensive extraction + analysis prompt
    const prompt = buildExtractionAndAnalysisPrompt(!!clinicalNotesContent);

    // Build message content with PDFs as base64
    const userContent: any[] = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${claimContent}` }
      }
    ];

    if (clinicalNotesContent) {
      userContent.push({
        type: "image_url", 
        image_url: { url: `data:application/pdf;base64,${clinicalNotesContent}` }
      });
    }

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.1,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";
    
    console.log("Response length:", responseText.length);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not find JSON in response:", responseText.substring(0, 500));
      throw new Error("Could not parse AI response as JSON");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error("Invalid JSON in AI response");
    }

    const processingTime = Date.now() - startTime;
    console.log(`Complete: ${parsed.analysis?.approval_probability}% approval, ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        // Extracted claim data
        extracted_data: parsed.extracted_data || {},
        // Analysis results
        analysis: parsed.analysis || {},
        // Clinical data from notes
        clinical_data: parsed.clinical_data || {},
        // Processing metadata
        processing_time_ms: processingTime,
        had_clinical_notes: !!clinicalNotesContent,
        model_used: "google/gemini-2.5-flash",
        metadata: {
          claim_filename: claimFilename,
          notes_filename: notesFilename,
          analyzed_at: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-claim-combined:", error);

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

function buildExtractionAndAnalysisPrompt(hasClinicalNotes: boolean): string {
  return `You are an expert healthcare billing specialist and medical coder. You will analyze the provided documents.

DOCUMENT 1: CMS-1500 Claim Form
${hasClinicalNotes ? "DOCUMENT 2: Clinical/Progress Notes from the doctor" : "NO CLINICAL NOTES PROVIDED"}

## YOUR TASKS:

### TASK 1: EXTRACT ALL DATA from the CMS-1500 claim form
Extract every piece of information you can see on the claim form.

### TASK 2: ANALYZE for approval probability
${hasClinicalNotes ? "Review both the claim AND clinical notes together to determine if medical necessity is documented." : "Note that no clinical notes were provided - this affects approval likelihood."}

## RESPOND WITH THIS EXACT JSON STRUCTURE (no markdown, just JSON):

{
  "extracted_data": {
    "patient": {
      "name": "<LAST, FIRST from Box 2>",
      "first_name": "<first name>",
      "last_name": "<last name>",
      "dob": "<MM/DD/YYYY from Box 3>",
      "sex": "<M or F from Box 3>",
      "address": {
        "street": "<from Box 5>",
        "city": "<city>",
        "state": "<state 2-letter>",
        "zip": "<zip code>"
      },
      "phone": "<phone number from Box 5>",
      "account_number": "<from Box 26>"
    },
    "insured": {
      "id": "<from Box 1a>",
      "name": "<from Box 4>",
      "group_number": "<from Box 11>",
      "plan_name": "<from Box 11c>"
    },
    "payer": {
      "name": "<insurance company name>",
      "address": "<payer address if visible>",
      "type": "<medicare|medicaid|bcbs|commercial|other>"
    },
    "claim": {
      "claim_number": "<any claim/reference number>",
      "date_of_service": "<MM/DD/YYYY from Box 24>",
      "date_of_service_to": "<end date if different>",
      "place_of_service": "<2-digit code from Box 24B>",
      "prior_auth_number": "<from Box 23 if present>"
    },
    "diagnoses": {
      "icd_indicator": "<0 for ICD-10, 9 for ICD-9>",
      "codes": ["<ICD code 1>", "<ICD code 2>"],
      "primary": "<primary diagnosis code>"
    },
    "procedures": [
      {
        "line": 1,
        "cpt_code": "<CPT/HCPCS code>",
        "modifiers": ["<modifier1>", "<modifier2>"],
        "diagnosis_pointer": "<A,B,C,D>",
        "charge": "<number without $>",
        "units": "<number>",
        "description": "<what this procedure is for>"
      }
    ],
    "charges": {
      "total_charge": "<total from Box 28>",
      "amount_paid": "<from Box 29 or 0>",
      "balance_due": "<calculated difference>"
    },
    "provider": {
      "billing_name": "<from Box 33>",
      "billing_npi": "<10-digit NPI from Box 33a>",
      "billing_address": "<address>",
      "billing_phone": "<phone>",
      "rendering_name": "<from Box 31>",
      "rendering_npi": "<from Box 24J>",
      "tax_id": "<from Box 25>",
      "tax_id_type": "<EIN or SSN>"
    },
    "facility": {
      "name": "<from Box 32>",
      "npi": "<from Box 32a>",
      "address": "<facility address>"
    },
    "assignment": {
      "accept_assignment": "<true or false from Box 27>",
      "signature_on_file": "<true or false>"
    }
  },
  
  "clinical_data": {
    "from_progress_notes": ${hasClinicalNotes},
    "chief_complaint": "<main reason for visit>",
    "symptoms_documented": ["<symptom 1>", "<symptom 2>"],
    "history_of_present_illness": "<HPI summary>",
    "relevant_history": ["<relevant past history items>"],
    "vital_signs": "<if documented>",
    "exam_findings": ["<physical exam findings>"],
    "assessment": "<diagnosis/assessment>",
    "plan": "<treatment plan>",
    "medications": ["<relevant medications>"]
  },
  
  "analysis": {
    "approval_probability": "<0-100 number>",
    "risk_level": "<low|medium|high|critical>",
    "confidence_score": "<0-100 number>",
    
    "executive_summary": "<2-3 sentence summary of claim and main findings>",
    
    "clinical_support_analysis": {
      "has_sufficient_documentation": "<true|false>",
      "documentation_score": "<0-100 number>",
      "findings": ["<specific findings that support medical necessity - be specific>"],
      "gaps": ["<what documentation is missing>"]
    },
    
    "coding_analysis": {
      "cpt_icd_alignment": "<assessment>",
      "issues_found": [
        {
          "type": "<issue type>",
          "code": "<affected code>",
          "issue": "<description>",
          "fix": "<solution>"
        }
      ],
      "coding_score": "<0-100 number>"
    },
    
    "medical_necessity_analysis": {
      "is_supported": "<true|false>",
      "supporting_evidence": ["<specific quotes or references from clinical notes>"],
      "concerns": ["<concerns>"],
      "necessity_score": "<0-100 number>"
    },
    
    "payer_analysis": {
      "payer_name": "<identified payer>",
      "payer_type": "<type>",
      "known_requirements": ["<specific payer requirements>"],
      "potential_issues": ["<payer-specific concerns>"]
    },
    
    "critical_issues": [
      {
        "priority": "<1-5 number>",
        "issue": "<problem>",
        "impact": "<consequence>",
        "resolution": "<fix>"
      }
    ],
    
    "recommendations": [
      {
        "category": "<category>",
        "recommendation": "<action>",
        "expected_impact": "<benefit>",
        "effort": "<low|medium|high>"
      }
    ],
    
    "next_steps": [
      "<step 1>",
      "<step 2>",
      "<step 3>"
    ]
  }
}

## IMPORTANT EXTRACTION RULES:
1. Extract EXACTLY what you see - don't guess or make up data
2. For dates, use MM/DD/YYYY format
3. For money, extract as numbers only (no $ or commas)
4. For phone numbers, include area code
5. If a field is empty or not visible, use null
6. CPT codes are 5 digits (like 93229, 93228)
7. ICD-10 codes have format like R55, R00.2, J18.9
8. NPI numbers are always 10 digits

## IMPORTANT ANALYSIS RULES:
1. If clinical notes ARE provided and document symptoms supporting procedures, approval should be HIGH (70-90%)
2. If clinical notes mention syncope, palpitations, dizziness for cardiac monitoring - that SUPPORTS the claim
3. Be specific - cite actual findings from the documents
4. If no clinical notes provided, documentation score should be LOW

Now analyze the documents and respond with ONLY the JSON object.`;
}
