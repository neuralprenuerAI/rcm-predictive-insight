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
      claimContent,        // Base64 content of claim PDF
      clinicalNotesContent, // Base64 content of notes PDF
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

    console.log(`Analyzing claim with Gemini Vision. Has clinical notes: ${!!clinicalNotesContent}`);
    const startTime = Date.now();

    // Build the analysis prompt
    const analysisPrompt = `You are an expert Healthcare Revenue Cycle Management consultant with 20+ years of experience in medical billing, coding, clinical documentation improvement (CDI), and denial management.

You are being shown:
1. A CMS-1500 claim form (the first PDF/image)
${clinicalNotesContent ? "2. Clinical/Progress notes from the doctor (the second PDF/image)" : "2. NO clinical notes were provided - this is a significant documentation gap!"}

## YOUR TASK

Analyze the claim form and ${clinicalNotesContent ? "the clinical documentation together" : "note that NO clinical documentation was provided"}.

Consider:
1. What procedures (CPT codes) are being billed?
2. What diagnoses (ICD-10 codes) are listed?
3. ${clinicalNotesContent ? "Does the clinical documentation support the medical necessity of the procedures?" : "Without clinical notes, medical necessity cannot be verified."}
4. Are there any coding issues (bundling, modifiers, etc.)?
5. What is the likelihood of approval?

${clinicalNotesContent ? `
IMPORTANT: Look carefully at the clinical notes for:
- Symptoms that justify the procedures (syncope, palpitations, dizziness, chest pain, etc.)
- History of present illness
- Specific clinical findings
- Any documentation that supports WHY the service was needed
` : ""}

Respond with ONLY a JSON object (no markdown, no code blocks):

{
  "approval_probability": <0-100>,
  "risk_level": "<low|medium|high|critical>",
  "confidence_score": <0-100>,
  
  "executive_summary": "<2-3 sentence summary. If clinical notes support the claim, say so specifically. If no clinical notes were provided, note this gap.>",
  
  "clinical_support_analysis": {
    "has_sufficient_documentation": <true|false>,
    "documentation_score": <0-100>,
    "findings": ["<specific findings FROM THE CLINICAL NOTES that support the procedures - quote relevant text>"],
    "gaps": ["<what documentation is missing or unclear>"]
  },
  
  "coding_analysis": {
    "cpt_icd_alignment": "<does the diagnosis support the procedure?>",
    "issues_found": [
      {
        "type": "<bundling|modifier|medical_necessity|frequency|mismatch|other>",
        "code": "<code>",
        "issue": "<problem>",
        "fix": "<solution>"
      }
    ],
    "coding_score": <0-100>
  },
  
  "medical_necessity_analysis": {
    "is_supported": <true|false>,
    "supporting_evidence": ["<SPECIFIC quotes from clinical notes that prove medical necessity>"],
    "concerns": ["<any concerns>"],
    "necessity_score": <0-100>
  },
  
  "critical_issues": [
    {
      "priority": <1-5>,
      "issue": "<problem>",
      "impact": "<consequence>",
      "resolution": "<fix>"
    }
  ],
  
  "recommendations": [
    {
      "category": "<documentation|coding|authorization|other>",
      "recommendation": "<action>",
      "expected_impact": "<benefit>",
      "effort": "<low|medium|high>"
    }
  ],
  
  "missing_documentation": [
    {
      "document_type": "<what>",
      "why_needed": "<reason>",
      "impact_without": "<risk>"
    }
  ],
  
  "next_steps": [
    "<most important action>",
    "<second action>",
    "<third action>"
  ]
}

Remember: If clinical notes ARE provided and they document symptoms supporting the procedures, the approval probability should be HIGH (70-90%). Only give low approval if documentation is truly missing or doesn't support the claim.`;

    // Build the request with PDF content
    const parts: any[] = [{ text: analysisPrompt }];

    // Add claim PDF as inline data
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: claimContent
      }
    });

    // Add clinical notes PDF if provided
    if (clinicalNotesContent) {
      parts.push({
        inline_data: {
          mime_type: "application/pdf", 
          data: clinicalNotesContent
        }
      });
    }

    // Call Gemini with vision capability
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
      console.error("Gemini error:", errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("Gemini response length:", responseText.length);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse response:", responseText.substring(0, 500));
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
    console.log(`Analysis complete: ${analysis.approval_probability}% approval, ${processingTime}ms`);

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
          model: "gemini-1.5-flash"
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
