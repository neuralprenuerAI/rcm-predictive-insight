import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Try multiple model names in order of preference
const GEMINI_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-latest", 
  "gemini-1.5-flash-001",
  "gemini-1.5-flash",
  "gemini-1.5-pro-latest",
  "gemini-pro-vision",
  "gemini-pro",
];

async function tryGeminiModel(
  modelName: string,
  apiKey: string,
  parts: any[]
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      claimContent,
      clinicalNotesContent,
      claimFilename,
      notesFilename,
    } = await req.json();

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

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`Analyzing claim. Has clinical notes: ${!!clinicalNotesContent}`);
    const startTime = Date.now();

    // Build the analysis prompt
    const analysisPrompt = `You are an expert Healthcare Revenue Cycle Management consultant.

You are analyzing a medical claim. I will describe what I see in the documents.

${clinicalNotesContent ? "I have BOTH the claim form AND clinical/progress notes from the doctor." : "I only have the claim form, NO clinical notes were provided."}

## CLAIM FORM INFORMATION:
The first document is a CMS-1500 claim form. Please extract:
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

## YOUR TASK

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

    // Build parts array
    const parts: any[] = [{ text: analysisPrompt }];

    // Add claim PDF
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: claimContent
      }
    });

    // Add clinical notes if provided
    if (clinicalNotesContent) {
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: clinicalNotesContent
        }
      });
    }

    // Try each model until one works
    let result: any = null;
    let workingModel = "";
    let lastError = "";

    for (const modelName of GEMINI_MODELS) {
      console.log(`Trying model: ${modelName}`);
      const attempt = await tryGeminiModel(modelName, geminiKey, parts);
      
      if (attempt.success) {
        result = attempt.data;
        workingModel = modelName;
        console.log(`Success with model: ${modelName}`);
        break;
      } else {
        lastError = attempt.error || "Unknown error";
        console.log(`Model ${modelName} failed: ${lastError}`);
        
        // If it's a 404, try next model
        // If it's a different error (like content policy), might need to handle differently
        if (!lastError.includes("404")) {
          // Non-404 error, might be a different issue
          console.log(`Non-404 error, continuing to try other models...`);
        }
      }
    }

    if (!result) {
      throw new Error(`All Gemini models failed. Last error: ${lastError}`);
    }

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Response length:", responseText.length);

    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not find JSON in response:", responseText.substring(0, 500));
      throw new Error("Could not parse AI response as JSON");
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error("Invalid JSON in AI response");
    }

    const processingTime = Date.now() - startTime;
    console.log(`Analysis complete: ${analysis.approval_probability}% approval, model: ${workingModel}, time: ${processingTime}ms`);

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
          model_used: workingModel
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
