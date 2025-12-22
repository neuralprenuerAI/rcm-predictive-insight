import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Procedure {
  cpt_code: string;
  units: number;
  modifiers?: string[];
  charge?: number;
}

interface ClaimData {
  procedures: Procedure[];
  icd_codes: string[];
  payer?: string;
  patient_name?: string;
  billed_amount?: number;
  place_of_service?: string;
}

interface ScrubRequest {
  claim_id?: string;
  claim_data?: ClaimData;
  pdf_content?: string;
  save_results?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ScrubRequest = await req.json();
    const { claim_id, claim_data, pdf_content, save_results = true } = request;

    console.log("📥 Received scrub request:", {
      has_claim_id: !!claim_id,
      has_claim_data: !!claim_data,
      has_pdf_content: !!pdf_content,
      pdf_content_length: pdf_content?.length || 0
    });

    // Get auth header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Initialize Supabase clients
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Authentication required");
    }

    console.log(`🔍 Starting claim scrub for user: ${user.id}`);

    let claimInfo: ClaimData | null = claim_data || null;
    let linkedClaimId = claim_id || null;

    // ========================================
    // OPTION 1: Use provided claim_data directly
    // ========================================
    if (claim_data && claim_data.procedures && claim_data.procedures.length > 0) {
      console.log("📋 Using provided claim_data");
      claimInfo = claim_data;
    }

    // ========================================
    // OPTION 2: Load from existing claim
    // ========================================
    if (claim_id && !claimInfo) {
      console.log(`📂 Loading claim: ${claim_id}`);
      
      const { data: claim, error: claimError } = await supabaseAuth
        .from('claims')
        .select('*')
        .eq('id', claim_id)
        .single();

      if (claimError || !claim) {
        throw new Error(`Claim not found: ${claim_id}`);
      }

      const procedures: Procedure[] = [];
      
      if (claim.procedure_codes && Array.isArray(claim.procedure_codes)) {
        claim.procedure_codes.forEach((cpt: string) => {
          procedures.push({ cpt_code: cpt, units: 1, modifiers: [] });
        });
      } else if (claim.procedure_code) {
        procedures.push({ cpt_code: claim.procedure_code, units: 1, modifiers: [] });
      }

      claimInfo = {
        procedures,
        icd_codes: claim.diagnosis_codes || (claim.diagnosis_code ? [claim.diagnosis_code] : []),
        payer: claim.payer || undefined,
        patient_name: claim.patient_name || undefined,
        billed_amount: claim.billed_amount || undefined,
        place_of_service: '11'
      };

      linkedClaimId = claim_id;
    }

    // ========================================
    // OPTION 3: Extract from PDF using Lovable AI
    // ========================================
    if (pdf_content && !claimInfo) {
      console.log("📄 Extracting claim data from PDF...");
      console.log(`📄 PDF content length: ${pdf_content.length} characters`);
      
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      const extractionPrompt = `You are a medical billing expert. Extract claim data from this CMS-1500 form.

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, just JSON):
{
  "procedures": [
    {"cpt_code": "99214", "units": 1, "modifiers": ["25"]}
  ],
  "icd_codes": ["R55", "R00.2"],
  "payer": "Medicare",
  "patient_name": "John Smith",
  "billed_amount": 150.00,
  "place_of_service": "11"
}

Rules:
- CPT codes are exactly 5 digits (e.g., 99214, 93229)
- ICD-10 codes have format like A00.0, R55, I10
- Units default to 1 if not clearly specified
- Extract ALL procedures from Box 24
- Extract ALL diagnosis codes from Box 21
- Get payer name from Box 9 or top of form
- Get patient name from Box 2
- place_of_service is usually 11 (office) or 22 (hospital)

IMPORTANT: Return ONLY the JSON object, no other text.`;

      console.log("🤖 Calling Lovable AI Gateway for PDF extraction...");
      
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: [
                  { type: "text", text: extractionPrompt },
                  { 
                    type: "image_url", 
                    image_url: { 
                      url: `data:application/pdf;base64,${pdf_content}` 
                    } 
                  }
                ]
              }
            ]
          })
        });

        console.log(`📡 AI Gateway response status: ${aiResponse.status}`);

        if (aiResponse.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        
        if (aiResponse.status === 402) {
          throw new Error("AI credits exhausted. Please add funds to your Lovable workspace.");
        }

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("❌ AI Gateway error:", errorText);
          throw new Error(`AI extraction failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const text = aiData.choices?.[0]?.message?.content || "";
        console.log("📝 Extracted text length:", text.length);
        console.log("📝 Extracted text preview:", text.substring(0, 300));
        
        // Try to find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate we got procedures
            if (parsed.procedures && Array.isArray(parsed.procedures) && parsed.procedures.length > 0) {
              claimInfo = parsed;
              console.log(`✅ Extracted ${parsed.procedures.length} procedures from PDF`);
            } else {
              throw new Error("No procedures found in the extracted data. The PDF may not be a valid CMS-1500 form.");
            }
          } catch (parseError) {
            console.error("❌ JSON parse error:", parseError);
            throw new Error("Failed to parse claim data from PDF. Please try manual entry.");
          }
        } else {
          console.log("⚠️ No JSON found in response. Raw text:", text.substring(0, 500));
          throw new Error("Could not extract structured claim data from PDF. Please try manual entry.");
        }
      } catch (extractError) {
        console.error("❌ PDF extraction error:", extractError);
        throw extractError;
      }
    }

    // ========================================
    // VALIDATE WE HAVE DATA
    // ========================================
    if (!claimInfo || !claimInfo.procedures || claimInfo.procedures.length === 0) {
      throw new Error("No valid claim data available. Please ensure your PDF contains readable claim information or use manual entry.");
    }

    console.log(`📋 Processing ${claimInfo.procedures.length} procedures:`, 
      claimInfo.procedures.map(p => p.cpt_code).join(', '));

    // ========================================
    // CALL RULES ENGINE
    // ========================================
    console.log("🔍 Calling validation rules engine...");
    
    const validationResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/validate-claim-rules`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          procedures: claimInfo.procedures,
          icd_codes: claimInfo.icd_codes || [],
          payer: claimInfo.payer,
          place_of_service: claimInfo.place_of_service,
          patient_name: claimInfo.patient_name,
          patient_id: linkedClaimId
        })
      }
    );

    if (!validationResponse.ok) {
      const errorText = await validationResponse.text();
      console.error("❌ Validation failed:", errorText);
      throw new Error(`Validation service error: ${validationResponse.status}`);
    }

    const validationResult = await validationResponse.json();

    if (!validationResult.success) {
      throw new Error(validationResult.error || "Validation failed");
    }

    console.log(`✅ Validation complete: ${validationResult.issues?.length || 0} issues found`);

    // ========================================
    // GENERATE AI CORRECTIONS (if issues found)
    // ========================================
    let aiCorrections: any[] = [];
    
    if (validationResult.issues?.length > 0) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      
      if (lovableApiKey) {
        console.log("🤖 Generating AI corrections...");
        
        const correctionPrompt = `You are a certified medical coder. Review these claim issues and provide specific, compliant corrections.

CLAIM INFORMATION:
- Procedures: ${JSON.stringify(claimInfo.procedures)}
- Diagnoses: ${JSON.stringify(claimInfo.icd_codes)}
- Payer: ${claimInfo.payer || 'Unknown'}

ISSUES FOUND:
${validationResult.issues.map((i: any, idx: number) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.type}: ${i.message}`).join('\n')}

Provide corrections as a JSON array:
[
  {
    "issue_type": "MISSING_MODIFIER_25",
    "action": "add_modifier",
    "target_code": "99214",
    "new_value": "25",
    "explanation": "Add modifier 25 for separately identifiable E/M",
    "compliance_note": "Ensure documentation supports separate E/M"
  }
]

Return ONLY the JSON array, no other text.`;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "user", content: correctionPrompt }
              ]
            })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const aiText = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
              aiCorrections = JSON.parse(jsonMatch[0]);
              console.log(`✅ Generated ${aiCorrections.length} AI corrections`);
            }
          } else {
            console.log("⚠️ AI corrections request failed:", aiResponse.status);
          }
        } catch (aiError) {
          console.error("⚠️ AI correction error (non-fatal):", aiError);
        }
      }
    }

    // ========================================
    // PREPARE FINAL RESULT
    // ========================================
    const scrubResult = {
      denial_risk_score: validationResult.denial_risk_score,
      risk_level: validationResult.risk_level,
      mue_issues: validationResult.issues?.filter((i: any) => i.type === 'MUE_EXCEEDED') || [],
      ncci_issues: validationResult.issues?.filter((i: any) => i.type === 'NCCI_BUNDLE') || [],
      modifier_issues: validationResult.issues?.filter((i: any) => i.type.includes('MODIFIER')) || [],
      necessity_issues: validationResult.issues?.filter((i: any) => i.type.includes('NECESSITY')) || [],
      payer_issues: validationResult.issues?.filter((i: any) => i.type.includes('PAYER')) || [],
      all_issues: validationResult.issues || [],
      corrections: [...(validationResult.corrections || []), ...aiCorrections],
      critical_count: validationResult.summary?.critical || 0,
      high_count: validationResult.summary?.high || 0,
      medium_count: validationResult.summary?.medium || 0,
      low_count: validationResult.summary?.low || 0,
      total_issues: validationResult.issues?.length || 0,
      claim_info: claimInfo
    };

    // ========================================
    // SAVE RESULTS TO DATABASE
    // ========================================
    let scrubResultId: string | null = null;

    if (save_results) {
      console.log("💾 Saving scrub results...");
      
      const { data: savedResult, error: saveError } = await supabaseService
        .from('claim_scrub_results')
        .insert({
          user_id: user.id,
          claim_id: linkedClaimId,
          denial_risk_score: scrubResult.denial_risk_score,
          risk_level: scrubResult.risk_level,
          mue_issues: scrubResult.mue_issues,
          ncci_issues: scrubResult.ncci_issues,
          modifier_issues: scrubResult.modifier_issues,
          necessity_issues: scrubResult.necessity_issues,
          payer_issues: scrubResult.payer_issues,
          all_issues: scrubResult.all_issues,
          corrections: scrubResult.corrections,
          critical_count: scrubResult.critical_count,
          high_count: scrubResult.high_count,
          medium_count: scrubResult.medium_count,
          low_count: scrubResult.low_count,
          total_issues: scrubResult.total_issues,
          claim_info: scrubResult.claim_info,
          status: 'completed'
        })
        .select('id')
        .single();

      if (saveError) {
        console.error("⚠️ Save error (non-fatal):", saveError);
      } else if (savedResult) {
        scrubResultId = savedResult.id;
        console.log(`✅ Saved scrub result: ${scrubResultId}`);
      }

      // Create notification for high risk
      if (scrubResult.critical_count > 0 || scrubResult.high_count > 0) {
        await supabaseService
          .from('notifications')
          .insert({
            user_id: user.id,
            notification_type: 'high_risk_claim',
            severity: scrubResult.critical_count > 0 ? 'critical' : 'high',
            title: `⚠️ High Risk Claim Detected`,
            message: `Claim for ${claimInfo.patient_name || 'patient'} has ${scrubResult.critical_count + scrubResult.high_count} critical/high issue(s)`,
            claim_id: linkedClaimId,
            scrub_result_id: scrubResultId
          });
      }
    }

    // ========================================
    // RETURN FINAL RESPONSE
    // ========================================
    console.log("✅ Scrub complete, returning results");
    
    return new Response(
      JSON.stringify({
        success: true,
        scrub_result_id: scrubResultId,
        ...scrubResult,
        message: scrubResult.total_issues === 0 
          ? "✅ Claim passed all checks - ready to submit!"
          : `⚠️ Found ${scrubResult.total_issues} issue(s) - review recommended`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Scrub error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        scrub_result_id: null,
        denial_risk_score: 0,
        risk_level: 'unknown',
        all_issues: [],
        corrections: [],
        total_issues: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
