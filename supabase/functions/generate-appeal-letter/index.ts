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
    const { denialId } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch denial and related claim data
    const { data: denial, error: denialError } = await supabaseClient
      .from("denials")
      .select("*, claims(*)")
      .eq("id", denialId)
      .single();

    if (denialError) throw denialError;

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
            content: `You are an expert medical billing specialist who writes compelling, professional appeal letters that maximize approval probability. Follow CMS guidelines and insurance appeal best practices.`
          },
          {
            role: "user",
            content: `Generate a professional appeal letter for the following denial:

Claim ID: ${denial.claim_id}
Patient: ${denial.claims?.patient_name}
Provider: ${denial.claims?.provider}
Date of Service: ${denial.claims?.date_of_service}
Procedure Code: ${denial.claims?.procedure_code}
Diagnosis Code: ${denial.claims?.diagnosis_code}
Denied Amount: $${denial.denied_amount}
Denial Code: ${denial.denial_code}
Denial Reason: ${denial.denial_reason}
Payer: ${denial.payer}

Write a compelling appeal letter that:
1. References specific CMS guidelines and medical necessity criteria
2. Provides strong clinical justification
3. Cites relevant documentation and evidence
4. Uses professional, persuasive language
5. Follows proper appeal letter format
6. Maximizes probability of approval

Include proper letterhead placeholders, date, and recipient information.`
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
        letter_type: "appeal",
        related_id: denialId,
        content: letterContent,
        metadata: { claim_id: denial.claim_id, denial_code: denial.denial_code }
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
