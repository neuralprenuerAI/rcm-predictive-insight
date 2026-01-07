import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DenialInput {
  claimId?: string;
  patientId?: string;
  patientName?: string;
  denialDate: string;
  serviceDate?: string;
  payerName: string;
  payerId?: string;
  reasonCode: string;
  reasonDescription?: string;
  remarkCodes?: string[];
  adjustmentReasonCode?: string;
  billedAmount: number;
  allowedAmount?: number;
  deniedAmount: number;
  cptCode?: string;
  cptDescription?: string;
  icdCodes?: string[];
  modifiers?: string[];
  remittanceId?: string;
}

interface ClassificationResult {
  category: string;
  subcategory: string | null;
  rootCause: string;
  recommendedAction: string;
  appealable: boolean;
  appealSuccessRate: number;
  requiredDocumentation: string[];
  appealDeadlineDays: number;
  priority: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const input: DenialInput = await req.json();
    console.log("Classifying denial:", input.reasonCode, "Amount:", input.deniedAmount);

    // Fetch classification rules
    const { data: classifications, error: classError } = await supabaseClient
      .from("denial_classifications")
      .select("*")
      .eq("active", true);

    if (classError) {
      console.error("Error fetching classifications:", classError);
    }

    // Classify the denial
    const classification = await classifyDenial(input, classifications || []);

    // Calculate appeal deadline
    const denialDate = new Date(input.denialDate);
    const deadlineDate = new Date(denialDate);
    deadlineDate.setDate(deadlineDate.getDate() + classification.appealDeadlineDays);
    const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Find matching classification record
    const matchingClass = classifications?.find(c => c.reason_code === input.reasonCode);

    // Create denial queue entry
    const { data: denialEntry, error: insertError } = await supabaseClient
      .from("denial_queue")
      .insert({
        user_id: user.id,
        claim_id: input.claimId || null,
        patient_id: input.patientId || null,
        remittance_id: input.remittanceId || null,
        denial_date: input.denialDate,
        service_date: input.serviceDate || null,
        payer_name: input.payerName,
        payer_id: input.payerId || null,
        reason_code: input.reasonCode,
        reason_description: input.reasonDescription || classification.rootCause,
        remark_codes: input.remarkCodes || [],
        adjustment_reason_code: input.adjustmentReasonCode || null,
        billed_amount: input.billedAmount,
        allowed_amount: input.allowedAmount || 0,
        denied_amount: input.deniedAmount,
        cpt_code: input.cptCode || null,
        cpt_description: input.cptDescription || null,
        icd_codes: input.icdCodes || [],
        modifiers: input.modifiers || [],
        classification_id: matchingClass?.id || null,
        classified_category: classification.category,
        root_cause: classification.rootCause,
        ai_confidence: classification.confidence,
        status: "new",
        priority: classification.priority,
        appeal_deadline: deadlineDate.toISOString().split("T")[0],
        days_until_deadline: daysUntilDeadline,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting denial:", insertError);
      throw new Error("Failed to create denial entry");
    }

    // Log the action
    await supabaseClient.from("denial_actions").insert({
      user_id: user.id,
      denial_queue_id: denialEntry.id,
      action_type: "created",
      action_description: `Denial classified as ${classification.category} - ${classification.rootCause}`,
      performed_by: user.id,
    });

    await supabaseClient.from("denial_actions").insert({
      user_id: user.id,
      denial_queue_id: denialEntry.id,
      action_type: "classified",
      action_description: `AI classified with ${classification.confidence}% confidence`,
      new_value: classification.category,
      performed_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        denialId: denialEntry.id,
        classification: {
          category: classification.category,
          subcategory: classification.subcategory,
          rootCause: classification.rootCause,
          recommendedAction: classification.recommendedAction,
          appealable: classification.appealable,
          appealSuccessRate: classification.appealSuccessRate,
          requiredDocumentation: classification.requiredDocumentation,
          priority: classification.priority,
          confidence: classification.confidence,
        },
        deadline: {
          date: deadlineDate.toISOString().split("T")[0],
          daysRemaining: daysUntilDeadline,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in classify-denial:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function classifyDenial(
  input: DenialInput,
  classifications: any[]
): Promise<ClassificationResult> {
  // First, try to match by reason code
  const exactMatch = classifications.find(c => c.reason_code === input.reasonCode);
  
  if (exactMatch) {
    return {
      category: exactMatch.category,
      subcategory: exactMatch.subcategory,
      rootCause: exactMatch.common_causes?.[0] || exactMatch.reason_description,
      recommendedAction: exactMatch.recommended_action || "review",
      appealable: exactMatch.appealable ?? true,
      appealSuccessRate: exactMatch.appeal_success_rate || 30,
      requiredDocumentation: exactMatch.required_documentation || [],
      appealDeadlineDays: exactMatch.typical_appeal_deadline_days || 60,
      priority: calculatePriority(input.deniedAmount, exactMatch.appeal_success_rate),
      confidence: 95,
    };
  }

  // No exact match - use AI to classify
  const aiClassification = await classifyWithAI(input);
  
  // Find best matching category from rules
  const categoryMatch = classifications.find(c => c.category === aiClassification.category);
  
  return {
    category: aiClassification.category,
    subcategory: aiClassification.subcategory,
    rootCause: aiClassification.rootCause,
    recommendedAction: categoryMatch?.recommended_action || aiClassification.recommendedAction,
    appealable: categoryMatch?.appealable ?? true,
    appealSuccessRate: categoryMatch?.appeal_success_rate || 30,
    requiredDocumentation: categoryMatch?.required_documentation || [],
    appealDeadlineDays: categoryMatch?.typical_appeal_deadline_days || 60,
    priority: calculatePriority(input.deniedAmount, categoryMatch?.appeal_success_rate || 30),
    confidence: aiClassification.confidence,
  };
}

function calculatePriority(deniedAmount: number, successRate: number): string {
  // High value + high success rate = critical
  // High value + low success rate = high
  // Low value + high success rate = medium
  // Low value + low success rate = low
  
  const isHighValue = deniedAmount >= 500;
  const isHighSuccess = successRate >= 50;
  
  if (isHighValue && isHighSuccess) return "critical";
  if (isHighValue) return "high";
  if (isHighSuccess) return "medium";
  return "low";
}

async function classifyWithAI(input: DenialInput): Promise<{
  category: string;
  subcategory: string;
  rootCause: string;
  recommendedAction: string;
  confidence: number;
}> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!geminiApiKey) {
    // Fallback classification based on reason code patterns
    return fallbackClassification(input);
  }

  const prompt = `You are a medical billing expert. Classify this healthcare claim denial.

DENIAL INFORMATION:
- Reason Code: ${input.reasonCode}
- Reason Description: ${input.reasonDescription || "Not provided"}
- Payer: ${input.payerName}
- CPT Code: ${input.cptCode || "Not provided"}
- ICD Codes: ${input.icdCodes?.join(", ") || "Not provided"}
- Billed Amount: $${input.billedAmount}
- Denied Amount: $${input.deniedAmount}
- Remark Codes: ${input.remarkCodes?.join(", ") || "None"}

Classify this denial and return a JSON object:
{
  "category": "one of: medical_necessity, coding_error, authorization, eligibility, timely_filing, duplicate, bundling, modifier, documentation, coordination_of_benefits, provider_enrollment, contract, patient_responsibility, other",
  "subcategory": "specific subcategory",
  "rootCause": "most likely cause of this denial",
  "recommendedAction": "one of: appeal_with_documentation, correct_and_resubmit, request_retro_auth, verify_eligibility, bill_patient, review_contract, other",
  "confidence": 70-95
}

Return ONLY valid JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return fallbackClassification(input);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return fallbackClassification(input);
    }

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const result = JSON.parse(jsonStr.trim());
    
    return {
      category: result.category || "other",
      subcategory: result.subcategory || "",
      rootCause: result.rootCause || "Unknown cause",
      recommendedAction: result.recommendedAction || "review",
      confidence: result.confidence || 70,
    };

  } catch (error) {
    console.error("AI classification error:", error);
    return fallbackClassification(input);
  }
}

function fallbackClassification(input: DenialInput): {
  category: string;
  subcategory: string;
  rootCause: string;
  recommendedAction: string;
  confidence: number;
} {
  const code = input.reasonCode?.toUpperCase() || "";
  const desc = (input.reasonDescription || "").toLowerCase();

  // Pattern matching based on common codes
  if (code.includes("50") || code.includes("56") || code.includes("167") || desc.includes("medical necessity")) {
    return {
      category: "medical_necessity",
      subcategory: "clinical_justification",
      rootCause: "Service not deemed medically necessary",
      recommendedAction: "appeal_with_documentation",
      confidence: 75,
    };
  }

  if (code.includes("15") || code.includes("197") || code.includes("198") || desc.includes("authorization") || desc.includes("precert")) {
    return {
      category: "authorization",
      subcategory: "no_auth",
      rootCause: "Prior authorization not obtained",
      recommendedAction: "request_retro_auth",
      confidence: 75,
    };
  }

  if (code.includes("29") || desc.includes("timely") || desc.includes("filing")) {
    return {
      category: "timely_filing",
      subcategory: "deadline_missed",
      rootCause: "Claim filed after deadline",
      recommendedAction: "appeal_timely_filing",
      confidence: 80,
    };
  }

  if (code.includes("97") || code.includes("151") || desc.includes("bundl") || desc.includes("ncci")) {
    return {
      category: "bundling",
      subcategory: "ncci",
      rootCause: "NCCI bundling edit applied",
      recommendedAction: "review_and_correct",
      confidence: 75,
    };
  }

  if (code.includes("4") || code.includes("11") || code.includes("16") || desc.includes("modifier") || desc.includes("coding")) {
    return {
      category: "coding_error",
      subcategory: "general",
      rootCause: "Coding or claim form error",
      recommendedAction: "correct_and_resubmit",
      confidence: 70,
    };
  }

  if (code.includes("18") || desc.includes("duplicate")) {
    return {
      category: "duplicate",
      subcategory: "duplicate_claim",
      rootCause: "Duplicate claim submitted",
      recommendedAction: "verify_duplicate",
      confidence: 80,
    };
  }

  if (code.includes("22") || code.includes("23") || desc.includes("coordination") || desc.includes("cob")) {
    return {
      category: "coordination_of_benefits",
      subcategory: "wrong_payer_order",
      rootCause: "COB issue - wrong payer order",
      recommendedAction: "bill_correct_order",
      confidence: 75,
    };
  }

  if (code.startsWith("PR") || desc.includes("deductible") || desc.includes("copay") || desc.includes("coinsurance")) {
    return {
      category: "patient_responsibility",
      subcategory: "cost_sharing",
      rootCause: "Patient responsibility amount",
      recommendedAction: "bill_patient",
      confidence: 85,
    };
  }

  // Default
  return {
    category: "other",
    subcategory: "unknown",
    rootCause: "Unable to determine root cause",
    recommendedAction: "review",
    confidence: 50,
  };
}
