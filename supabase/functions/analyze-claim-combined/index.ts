import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GeminiModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

const PREFERRED_MODELS = [
  // Newer
  "gemini-2.0-flash-exp",
  // 1.5 flash variants
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash",
  // 1.5 pro variants
  "gemini-1.5-pro-latest",
  // Older (may not be available on v1beta generateContent)
  "gemini-pro-vision",
  "gemini-pro",
];

function extractRetryDelaySeconds(errorJson: any): number | null {
  const delay = errorJson?.error?.details?.find((d: any) => d?.retryDelay)?.retryDelay as string | undefined;
  if (!delay) return null;
  // e.g. "6s"
  const m = delay.match(/(\d+)s/);
  if (!m) return null;
  return Number(m[1]);
}

async function listAvailableModels(apiKey: string): Promise<string[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    { method: "GET" }
  );

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`ListModels failed: ${resp.status} - ${t}`);
  }

  const json = await resp.json();
  const models = (json?.models ?? []) as GeminiModel[];

  return models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
}

async function generateWithModel({
  modelName,
  apiKey,
  parts,
}: {
  modelName: string;
  apiKey: string;
  parts: any[];
}): Promise<{ ok: true; data: any } | { ok: false; status: number; errorText: string; errorJson?: any }>
{
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
    let errorJson: any | undefined;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // ignore
    }
    return { ok: false, status: response.status, errorText, errorJson };
  }

  const data = await response.json();
  return { ok: true, data };
}

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

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`Analyzing claim. Has clinical notes: ${!!clinicalNotesContent}`);
    const startTime = Date.now();

    const analysisPrompt = `You are an expert Healthcare Revenue Cycle Management consultant.

You are analyzing a medical claim.

${clinicalNotesContent ? "I have BOTH the claim form AND clinical/progress notes from the doctor." : "I only have the claim form, NO clinical notes were provided."}

Analyze everything and respond with ONLY a JSON object (no markdown) with:
- approval_probability (0-100)
- risk_level (low|medium|high|critical)
- confidence_score (0-100)
- executive_summary
- clinical_support_analysis
- coding_analysis
- medical_necessity_analysis
- critical_issues
- recommendations
- missing_documentation
- next_steps

IMPORTANT: If clinical notes ARE provided and document symptoms supporting the procedures, approval probability should be HIGH (70-90%).`;

    const parts: any[] = [{ text: analysisPrompt }];

    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: claimContent,
      },
    });

    if (clinicalNotesContent) {
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: clinicalNotesContent,
        },
      });
    }

    // Discover what this key can actually use.
    const availableModels = await listAvailableModels(geminiKey);
    console.log(`ListModels returned ${availableModels.length} generateContent-capable models`);

    const candidates = PREFERRED_MODELS.filter((m) => availableModels.includes(m));

    // If none match, try a reasonable fallback: any model that includes "flash" and supports generateContent.
    const fallbackFlash = availableModels.filter((m) => m.includes("flash"));

    const modelsToTry = [...new Set([...candidates, ...fallbackFlash])];

    if (modelsToTry.length === 0) {
      throw new Error(
        `No generateContent-capable models available for this API key. Available models: ${availableModels.slice(0, 50).join(", ")}${availableModels.length > 50 ? "..." : ""}`
      );
    }

    let workingModel = "";
    let result: any | null = null;
    let lastError = "";

    for (const modelName of modelsToTry) {
      console.log(`Trying model: ${modelName}`);
      const attempt = await generateWithModel({ modelName, apiKey: geminiKey, parts });

      if (attempt.ok) {
        workingModel = modelName;
        result = attempt.data;
        console.log(`Success with model: ${modelName}`);
        break;
      }

      // Fail fast on quota (429) or auth issues (401/403) — trying other model names won't fix that.
      if (attempt.status === 429) {
        const retrySeconds = extractRetryDelaySeconds(attempt.errorJson);
        const msg = `Gemini quota exceeded for this API key${retrySeconds ? `; retry in ~${retrySeconds}s` : ""}.`;
        console.error(msg, attempt.errorText);
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (attempt.status === 401 || attempt.status === 403) {
        const msg = `Gemini API key is not authorized (status ${attempt.status}). Please verify the key and that the Gemini API is enabled for it.`;
        console.error(msg, attempt.errorText);
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { status: attempt.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = `${attempt.status}: ${attempt.errorText}`;
      console.log(`Model ${modelName} failed: ${lastError}`);
    }

    if (!result) {
      throw new Error(`All candidate Gemini models failed. Last error: ${lastError}`);
    }

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Response length:", responseText.length);

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
          model_used: workingModel,
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
