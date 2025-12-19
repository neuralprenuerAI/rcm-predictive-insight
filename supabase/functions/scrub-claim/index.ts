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
    // OPTION 1: Load from existing claim
    // ========================================
    if (claim_id && !claim_data) {
      console.log(`📂 Loading claim: ${claim_id}`);
      
      const { data: claim, error: claimError } = await supabaseAuth
        .from('claims')
        .select('*')
        .eq('id', claim_id)
        .single();

      if (claimError || !claim) {
        throw new Error(`Claim not found: ${claim_id}`);
      }

      // Build claim data from database record
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
        place_of_service: '11' // Default to office
      };

      linkedClaimId = claim_id;
    }

    // ========================================
    // OPTION 2: Extract from PDF
    // ========================================
    if (pdf_content && !claimInfo) {
      console.log("📄 Extracting claim data from PDF...");
      
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        throw new Error("GEMINI_API_KEY not configured for PDF extraction");
      }

      const extractionPrompt = `Extract claim data from this CMS-1500 form. Return ONLY valid JSON, no other text:
{
  "procedures": [
    {"cpt_code": "XXXXX", "units": 1, "modifiers": []}
  ],
  "icd_codes": ["XXX.XX"],
  "payer": "Payer Name",
  "patient_name": "Patient Name",
  "billed_amount": 0,
  "place_of_service": "11"
}

Rules:
- CPT codes are 5 digits
- ICD-10 codes format: A00.0 or A00
- Units default to 1 if not specified
- Extract ALL procedures listed
- Extract ALL diagnosis codes`;

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: extractionPrompt },
                  { inline_data: { mime_type: "application/pdf", data: pdf_content } }
                ]
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            claimInfo = JSON.parse(jsonMatch[0]);
            console.log(`✅ Extracted ${claimInfo?.procedures?.length || 0} procedures from PDF`);
          }
        }
      } catch (extractError) {
        console.error("PDF extraction error:", extractError);
        throw new Error("Failed to extract claim data from PDF");
      }
    }

    // ========================================
    // VALIDATE WE HAVE DATA
    // ========================================
    if (!claimInfo || !claimInfo.procedures || claimInfo.procedures.length === 0) {
      throw new Error("No claim data available. Provide claim_id, claim_data, or pdf_content.");
    }

    console.log(`📋 Validating ${claimInfo.procedures.length} procedures...`);

    // ========================================
    // CALL RULES ENGINE
    // ========================================
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
          place_of_service: claimInfo.place_of_service
        })
      }
    );

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
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      
      if (geminiKey) {
        console.log("🤖 Generating AI corrections...");
        
        const correctionPrompt = `You are a certified medical coder. Review these claim issues and provide specific, compliant corrections.

CLAIM INFORMATION:
- Procedures: ${JSON.stringify(claimInfo.procedures)}
- Diagnoses: ${JSON.stringify(claimInfo.icd_codes)}
- Payer: ${claimInfo.payer || 'Unknown'}

ISSUES FOUND:
${validationResult.issues.map((i: any, idx: number) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.type}: ${i.message}`).join('\n')}

Provide corrections as a JSON array. Each correction should have:
- issue_type: The type of issue being fixed
- action: What to do (add_modifier, remove_code, reduce_units, change_diagnosis, etc.)
- target_code: The CPT or ICD code being modified
- new_value: The new value or modifier to add
- explanation: Brief explanation of why this fixes the issue
- compliance_note: Any compliance considerations

IMPORTANT: Only suggest compliant corrections. Never suggest upcoding or codes not supported by documentation.

Return ONLY the JSON array, no other text:`;

        try {
          const aiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: correctionPrompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
              })
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
              aiCorrections = JSON.parse(jsonMatch[0]);
              console.log(`✅ Generated ${aiCorrections.length} AI corrections`);
            }
          }
        } catch (aiError) {
          console.error("AI correction error:", aiError);
          // Continue without AI corrections
        }
      }
    }

    // ========================================
    // PREPARE FINAL RESULT
    // ========================================
    const scrubResult = {
      denial_risk_score: validationResult.denial_risk_score,
      risk_level: validationResult.risk_level,
      
      // Categorized issues
      mue_issues: validationResult.issues?.filter((i: any) => i.type === 'MUE_EXCEEDED') || [],
      ncci_issues: validationResult.issues?.filter((i: any) => i.type === 'NCCI_BUNDLE') || [],
      modifier_issues: validationResult.issues?.filter((i: any) => 
        i.type.includes('MODIFIER')
      ) || [],
      necessity_issues: validationResult.issues?.filter((i: any) => 
        i.type.includes('NECESSITY')
      ) || [],
      payer_issues: validationResult.issues?.filter((i: any) => 
        i.type.includes('PAYER')
      ) || [],
      
      // All issues and corrections
      all_issues: validationResult.issues || [],
      corrections: [...(validationResult.corrections || []), ...aiCorrections],
      
      // Counts
      critical_count: validationResult.summary?.critical || 0,
      high_count: validationResult.summary?.high || 0,
      medium_count: validationResult.summary?.medium || 0,
      low_count: validationResult.summary?.low || 0,
      total_issues: validationResult.issues?.length || 0,
      
      // Claim info snapshot
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
        console.error("Save error:", saveError);
      } else if (savedResult) {
        scrubResultId = savedResult.id;
        console.log(`✅ Saved scrub result: ${scrubResultId}`);
      }

      // ========================================
      // CREATE NOTIFICATION FOR HIGH RISK
      // ========================================
      if (scrubResult.critical_count > 0 || scrubResult.high_count > 0) {
        const notifSeverity = scrubResult.critical_count > 0 ? 'critical' : 'high';
        const issueCount = scrubResult.critical_count + scrubResult.high_count;
        
        await supabaseService
          .from('notifications')
          .insert({
            user_id: user.id,
            notification_type: 'high_risk_claim',
            severity: notifSeverity,
            title: `⚠️ High Risk Claim Detected`,
            message: `Claim for ${claimInfo.patient_name || 'patient'} has ${issueCount} critical/high priority issue(s) with ${scrubResult.denial_risk_score}% denial risk`,
            claim_id: linkedClaimId,
            scrub_result_id: scrubResultId
          });

        console.log("🔔 Created high-risk notification");
      }
    }

    // ========================================
    // RETURN FINAL RESPONSE
    // ========================================
    return new Response(
      JSON.stringify({
        success: true,
        scrub_result_id: scrubResultId,
        ...scrubResult,
        message: scrubResult.total_issues === 0 
          ? "✅ Claim passed all checks - ready to submit!"
          : `⚠️ Found ${scrubResult.total_issues} issue(s) - review recommended`
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
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
        corrections: []
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});
