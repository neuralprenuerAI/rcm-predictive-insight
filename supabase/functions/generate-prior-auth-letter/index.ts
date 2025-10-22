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
    const { authorizationId } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch authorization data
    const { data: authorization, error: authError } = await supabaseClient
      .from("authorizations")
      .select("*")
      .eq("id", authorizationId)
      .single();

    if (authError) throw authError;

    // Generate letter using Lovable AI
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
            content: `You are an expert medical authorization specialist who writes compelling prior authorization letters that maximize approval probability. Follow CMS LCD/NCD guidelines and payer-specific requirements.`
          },
          {
            role: "user",
            content: `Generate a professional prior authorization letter for:

Patient: ${authorization.patient_name}
Payer: ${authorization.payer}
Service/Procedure: ${authorization.service}
CPT Codes: ${authorization.cpt_codes?.join(", ")}
Diagnosis Codes: ${authorization.diagnosis_codes?.join(", ")}
Request Date: ${authorization.request_date}

Write a compelling prior authorization letter that:
1. Clearly establishes medical necessity per CMS criteria
2. Cites specific LCD/NCD guidelines when applicable
3. Provides detailed clinical rationale
4. References supporting documentation
5. Addresses common denial reasons proactively
6. Uses professional medical terminology
7. Follows proper authorization request format
8. Maximizes probability of approval

Include proper letterhead placeholders, patient demographics, and all required elements for submission.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error("Failed to generate letter");
    }

    const aiData = await aiResponse.json();
    const letterContent = aiData.choices[0].message.content;

    // Save generated letter
    const { data: savedLetter, error: saveError } = await supabaseClient
      .from("generated_letters")
      .insert({
        user_id: user.id,
        letter_type: "prior_auth",
        related_id: authorizationId,
        content: letterContent,
        metadata: { 
          patient_name: authorization.patient_name,
          payer: authorization.payer,
          service: authorization.service
        }
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({ letter: savedLetter }),
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
