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
      claimId,
      patientName,
      patientDOB,
      procedureCode,
      procedureCodes,
      diagnosisCode,
      diagnosisCodes,
      payer,
      billedAmount,
      dateOfService,
      providerName,
      providerNPI,
      facilityName,
      claimNumber,
      analysis,
      clinicalFindings,
      recommendations,
      executiveSummary,
      letterType = 'appeal',
    } = await req.json();

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

    // Build claim data from provided params or fetch from DB
    let claimData: any = {
      patientName,
      patientDOB,
      procedureCode,
      procedureCodes,
      diagnosisCode,
      diagnosisCodes,
      payer,
      billedAmount,
      dateOfService,
      providerName,
      providerNPI,
      facilityName,
      claimNumber,
      analysis,
      clinicalFindings,
      recommendations,
      executiveSummary,
    };

    if (claimId) {
      const { data: claim, error } = await supabaseClient
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .single();

      if (!error && claim) {
        claimData = {
          ...claimData,
          patientName: claim.patient_name || patientName,
          procedureCode: claim.procedure_code || procedureCode,
          diagnosisCode: claim.diagnosis_code || diagnosisCode,
          payer: claim.payer || payer,
          billedAmount: claim.billed_amount || billedAmount,
          dateOfService: claim.date_of_service || dateOfService,
          claimNumber: claim.claim_id || claimNumber,
          analysis: claim.ai_analysis || analysis,
          clinicalFindings: claim.clinical_findings || clinicalFindings,
          recommendations: claim.ai_recommendations || recommendations,
          executiveSummary: claim.executive_summary || executiveSummary,
          providerName: claim.provider || providerName,
        };
      }
    }

    console.log(`Generating ${letterType} letter for: ${claimData.patientName}`);

    // Build the prompt
    const prompt = buildLetterPrompt(claimData, letterType);

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert healthcare appeals specialist with 20+ years of experience writing successful insurance appeal letters. Generate professional, compelling letters that maximize approval probability. Follow CMS guidelines and insurance appeal best practices.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Payment required. Please add credits to your workspace.");
      }
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error("Failed to generate letter");
    }

    const data = await response.json();
    const letter = data.choices?.[0]?.message?.content || "";

    if (!letter) {
      throw new Error("No letter generated");
    }

    console.log(`Letter generated: ${letter.length} characters`);

    // Save to generated_letters table
    const { data: savedLetter, error: saveError } = await supabaseClient
      .from("generated_letters")
      .insert({
        user_id: user.id,
        letter_type: letterType,
        related_id: claimId || null,
        content: letter,
        metadata: { 
          claim_id: claimId,
          patient_name: claimData.patientName,
          payer: claimData.payer,
          procedure_code: claimData.procedureCode
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save letter:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        letter,
        letterType,
        claimId,
        letterId: savedLetter?.id,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating appeal letter:", error);
    
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

function buildLetterPrompt(claimData: any, letterType: string): string {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const clinicalFindingsText = Array.isArray(claimData.clinicalFindings) 
    ? claimData.clinicalFindings.map((f: string) => `• ${f}`).join('\n')
    : claimData.clinicalFindings || 'Clinical documentation supports medical necessity.';

  const recommendationsText = Array.isArray(claimData.recommendations)
    ? claimData.recommendations.map((r: any) => 
        typeof r === 'string' ? `• ${r}` : `• ${r.recommendation || r}`
      ).join('\n')
    : '';

  const analysisDetails = claimData.analysis?.medical_necessity_analysis?.supporting_evidence
    ? claimData.analysis.medical_necessity_analysis.supporting_evidence.join('\n• ')
    : '';

  const letterTypeDescription = {
    appeal: 'appealing the denial',
    reconsideration: 'requesting reconsideration of the decision',
    predetermination: 'requesting predetermination/prior authorization'
  };

  return `Generate a professional ${letterType} letter for a healthcare insurance claim.

## CLAIM INFORMATION:
- Patient Name: ${claimData.patientName || '[PATIENT NAME]'}
- Patient DOB: ${claimData.patientDOB || '[DOB]'}
- Date of Service: ${claimData.dateOfService || '[DATE OF SERVICE]'}
- Claim Number: ${claimData.claimNumber || '[CLAIM NUMBER]'}
- Procedure Code(s): ${claimData.procedureCode || claimData.procedureCodes?.join(', ') || '[CPT CODES]'}
- Diagnosis Code(s): ${claimData.diagnosisCode || claimData.diagnosisCodes?.join(', ') || '[ICD-10 CODES]'}
- Billed Amount: $${claimData.billedAmount?.toLocaleString() || '[AMOUNT]'}
- Insurance/Payer: ${claimData.payer || '[PAYER NAME]'}
- Provider: ${claimData.providerName || '[PROVIDER NAME]'}
- Facility: ${claimData.facilityName || '[FACILITY NAME]'}

## AI ANALYSIS SUMMARY:
${claimData.executiveSummary || 'The services rendered were medically necessary based on clinical documentation.'}

## CLINICAL FINDINGS FROM DOCUMENTATION:
${clinicalFindingsText}

## SUPPORTING EVIDENCE:
${analysisDetails ? `• ${analysisDetails}` : 'Clinical documentation on file supports the medical necessity of the services provided.'}

## RECOMMENDATIONS FROM ANALYSIS:
${recommendationsText || 'Proceed with appeal based on documented clinical evidence.'}

## INSTRUCTIONS:
Generate a professional ${letterType} letter that:

1. Is addressed to the insurance company's appeals department
2. Clearly identifies the patient and claim
3. States the purpose (${letterTypeDescription[letterType as keyof typeof letterTypeDescription] || 'appeal'})
4. Provides a compelling clinical argument for medical necessity
5. References the specific clinical findings from the documentation
6. Cites relevant medical guidelines or standards of care where applicable
7. Is professional, factual, and persuasive
8. Includes a clear request for action
9. Has proper formatting with date, addresses, salutation, body, and signature block

## FORMAT:
Write the complete letter ready to print. Use [BRACKETS] for any information that needs to be filled in.
Include today's date: ${today}

Generate the letter now:`;
}
