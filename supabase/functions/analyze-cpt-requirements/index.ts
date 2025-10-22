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
    const { cptCodes, payer, patientInfo } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Check CPT requirements from database
    const { data: cptReqs } = await supabaseClient
      .from("cpt_requirements")
      .select("*")
      .in("cpt_code", cptCodes);

    // Use AI to analyze requirements based on CMS standards
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert in CMS billing regulations and prior authorization requirements. Analyze CPT codes and determine authorization needs based on current CMS LCD/NCD guidelines.`
          },
          {
            role: "user",
            content: `Analyze the following CPT codes for prior authorization requirements:

CPT Codes: ${cptCodes.join(", ")}
Payer: ${payer}
Patient Insurance: ${patientInfo?.insurance || "Not specified"}

For each CPT code, determine:
1. Does it require prior authorization per CMS guidelines?
2. What are the specific LCD/NCD requirements?
3. What documentation is typically needed?
4. Are there any payer-specific requirements?
5. What is the typical approval timeline?

Return a JSON object with analysis for each CPT code.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_cpt_codes",
            description: "Analyze CPT codes for prior authorization requirements",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      cpt_code: { type: "string" },
                      requires_prior_auth: { type: "boolean" },
                      cms_requirements: { type: "string" },
                      required_documentation: { type: "array", items: { type: "string" } },
                      approval_timeline: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["cpt_code", "requires_prior_auth"],
                    additionalProperties: false
                  }
                }
              },
              required: ["results"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_cpt_codes" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to analyze CPT codes");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ 
        analysis: analysis.results,
        database_records: cptReqs 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
