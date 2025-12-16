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

    // Use Lovable AI (auto-provisioned key) instead of user's Gemini key
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Analyzing claim via Lovable AI. Has clinical notes: ${!!clinicalNotesContent}`);
    const startTime = Date.now();

    const analysisPrompt = `You are an expert Healthcare Revenue Cycle Management consultant with 20+ years of experience in medical billing, coding, clinical documentation improvement (CDI), and denial management.

You are analyzing a medical claim.

${clinicalNotesContent ? "I have BOTH the claim form AND clinical/progress notes from the doctor." : "I only have the claim form, NO clinical notes were provided."}

## CLAIM FORM:
The first document is a CMS-1500 claim form. Extract:
- Patient name and demographics
- Insurance/Payer information  
- Diagnosis codes (ICD-10)
- Procedure codes (CPT)
- Charges
- Provider information

${clinicalNotesContent ? `
## CLINICAL NOTES:
The second document contains the doctor's progress notes. Look for:
- Chief complaint and symptoms
- History of present illness
- Physical exam findings
- Assessment and plan
- Any symptoms that justify the procedures (syncope, palpitations, dizziness, chest pain, etc.)
` : `
## NO CLINICAL NOTES PROVIDED
This is a significant documentation gap that will likely result in denial.
`}

Analyze everything and respond with ONLY a JSON object (no markdown):

{
  "approval_probability": <0-100>,
  "risk_level": "<low|medium|high|critical>",
  "confidence_score": <0-100>,
  
  "executive_summary": "<2-3 sentences summarizing the claim and key findings>",
  
  "clinical_support_analysis": {
    "has_sufficient_documentation": <true|false>,
    "documentation_score": <0-100>,
    "findings": ["<findings that SUPPORT the claim - be specific>"],
    "gaps": ["<what is missing>"]
  },
  
  "coding_analysis": {
    "cpt_icd_alignment": "<does diagnosis support procedure?>",
    "issues_found": [
      {"type": "<type>", "code": "<code>", "issue": "<problem>", "fix": "<solution>"}
    ],
    "coding_score": <0-100>
  },
  
  "medical_necessity_analysis": {
    "is_supported": <true|false>,
    "supporting_evidence": ["<evidence from clinical notes>"],
    "concerns": ["<concerns>"],
    "necessity_score": <0-100>
  },
  
  "critical_issues": [
    {"priority": <1-5>, "issue": "<problem>", "impact": "<consequence>", "resolution": "<fix>"}
  ],
  
  "recommendations": [
    {"category": "<category>", "recommendation": "<action>", "expected_impact": "<benefit>", "effort": "<low|medium|high>"}
  ],
  
  "missing_documentation": [
    {"document_type": "<what>", "why_needed": "<reason>", "impact_without": "<risk>"}
  ],
  
  "next_steps": ["<step 1>", "<step 2>", "<step 3>"]
}

IMPORTANT: If clinical notes ARE provided and document symptoms supporting the procedures, approval probability should be HIGH (70-90%).`;

    // Build message content with PDFs as base64
    const userContent: any[] = [
      { type: "text", text: analysisPrompt },
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
        temperature: 0.2,
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

    let analysis: any;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error("Invalid JSON in AI response");
    }

    const processingTime = Date.now() - startTime;
    console.log(`Analysis complete: ${analysis.approval_probability}% approval, time: ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        processing_time_ms: processingTime,
        had_clinical_notes: !!clinicalNotesContent,
        metadata: {
          claim_filename: claimFilename,
          notes_filename: notesFilename,
          analyzed_at: new Date().toISOString(),
          model_used: "google/gemini-2.5-flash"
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
