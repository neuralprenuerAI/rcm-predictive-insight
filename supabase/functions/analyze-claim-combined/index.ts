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
    const {
      claimText,
      clinicalNotesText,
      claimFilename,
      notesFilename,
    } = await req.json();

    if (!claimText) {
      throw new Error("Missing required field: claimText");
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

    console.log(`Analyzing claim with ${clinicalNotesText ? 'clinical notes' : 'NO clinical notes'}`);
    const startTime = Date.now();

    // Build comprehensive prompt
    const prompt = `You are an expert Healthcare Revenue Cycle Management consultant with 20+ years of experience in medical billing, coding, clinical documentation improvement (CDI), and denial management.

Analyze this claim AND the supporting clinical documentation to determine approval likelihood.

## CMS-1500 CLAIM FORM TEXT:
"""
${claimText.substring(0, 8000)}
"""

## CLINICAL NOTES / DOCTOR'S PROGRESS NOTES:
${clinicalNotesText ? `"""
${clinicalNotesText.substring(0, 12000)}
"""` : "NO CLINICAL NOTES PROVIDED - This is a significant gap that will affect approval!"}

## YOUR TASK

Analyze EVERYTHING above and provide a comprehensive assessment. Consider:
1. Does the diagnosis support the procedures?
2. Is there documented medical necessity in the clinical notes?
3. Are there any coding issues (bundling, modifiers, etc.)?
4. What documentation gaps exist?
5. What is the likelihood of approval?

Respond with ONLY a JSON object (no markdown):

{
  "approval_probability": <0-100>,
  "risk_level": "<low|medium|high|critical>",
  "confidence_score": <0-100>,
  
  "executive_summary": "<2-3 sentence summary of the claim and main concerns>",
  
  "clinical_support_analysis": {
    "has_sufficient_documentation": <true|false>,
    "documentation_score": <0-100>,
    "findings": ["<what the clinical notes DO support - be specific, quote from notes>"],
    "gaps": ["<what's missing or unclear>"]
  },
  
  "coding_analysis": {
    "cpt_icd_alignment": "<assessment of whether diagnoses support procedures>",
    "issues_found": [
      {
        "type": "<bundling|modifier|medical_necessity|frequency|mismatch|other>",
        "code": "<affected code>",
        "issue": "<specific problem>",
        "fix": "<how to fix it>"
      }
    ],
    "coding_score": <0-100>
  },
  
  "medical_necessity_analysis": {
    "is_supported": <true|false>,
    "supporting_evidence": ["<specific quotes or references from clinical notes>"],
    "concerns": ["<concerns about medical necessity>"],
    "necessity_score": <0-100>
  },
  
  "critical_issues": [
    {
      "priority": <1-5, 1 is highest>,
      "issue": "<the problem>",
      "impact": "<what happens if not fixed>",
      "resolution": "<exactly how to fix it>"
    }
  ],
  
  "recommendations": [
    {
      "category": "<documentation|coding|authorization|submission|other>",
      "recommendation": "<specific actionable recommendation>",
      "expected_impact": "<how this improves approval chance>",
      "effort": "<low|medium|high>"
    }
  ],
  
  "missing_documentation": [
    {
      "document_type": "<what's needed>",
      "why_needed": "<why this specific claim needs it>",
      "impact_without": "<denial risk without it>"
    }
  ],
  
  "next_steps": [
    "<step 1 - most important>",
    "<step 2>",
    "<step 3>"
  ]
}

IMPORTANT GUIDELINES:
1. If clinical notes ARE provided, look for specific evidence supporting the claim
2. If clinical notes mention symptoms that justify the procedures, CITE THEM specifically
3. If clinical notes are NOT provided, this is a major gap - reflect this in scores
4. Be specific - reference actual codes and findings from the documents
5. For Holter monitor claims (93228/93229), look for: syncope, palpitations, arrhythmia, dizziness
6. Always verify if diagnosis codes (like R55 for syncope) are supported by clinical documentation

Respond with ONLY the JSON object.`;

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
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
    
    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini response:", responseText);
      throw new Error("Could not parse AI response");
    }

    const analysis = JSON.parse(jsonMatch[0]);
    const processingTime = Date.now() - startTime;

    console.log(`Analysis complete: ${analysis.approval_probability}% approval, ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        processing_time_ms: processingTime,
        had_clinical_notes: !!clinicalNotesText,
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
