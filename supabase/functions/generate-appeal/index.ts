import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateAppealInput {
  denialQueueId: string;
  templateId?: string;
  appealType?: string;
  clinicalJustification?: string;
  additionalNotes?: string;
  practiceInfo?: {
    name: string;
    address: string;
    phone: string;
    fax: string;
    npi: string;
  };
  providerInfo?: {
    name: string;
    npi: string;
    credentials: string;
  };
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

    const input: GenerateAppealInput = await req.json();
    console.log("Generating appeal for denial:", input.denialQueueId);

    // Fetch the denial details
    const { data: denial, error: denialError } = await supabaseClient
      .from("denial_queue")
      .select(`
        *,
        patient:patients(first_name, last_name, date_of_birth),
        claim:claims(claim_id, provider_name, provider_npi)
      `)
      .eq("id", input.denialQueueId)
      .single();

    if (denialError) {
      console.error("Database error fetching denial:", denialError);
      throw new Error(`Database error: ${denialError.message}`);
    }

    if (!denial) {
      console.error("Denial not found with ID:", input.denialQueueId);
      throw new Error(`Denial not found with ID: ${input.denialQueueId}. Ensure the denial exists and belongs to the current user.`);
    }

    // Fetch appropriate template
    let template = null;
    if (input.templateId) {
      const { data: t } = await supabaseClient
        .from("appeal_templates")
        .select("*")
        .eq("id", input.templateId)
        .single();
      template = t;
    } else {
      // Find best matching template by category
      const { data: templates } = await supabaseClient
        .from("appeal_templates")
        .select("*")
        .eq("denial_category", denial.classified_category)
        .eq("active", true)
        .order("is_default", { ascending: false })
        .limit(1);
      
      template = templates?.[0];
    }

    // If no template found, use default medical necessity template
    if (!template) {
      const { data: defaultTemplate } = await supabaseClient
        .from("appeal_templates")
        .select("*")
        .eq("is_default", true)
        .eq("active", true)
        .limit(1);
      
      template = defaultTemplate?.[0];
    }

    // Build template variables
    const patientName = denial.patient 
      ? `${denial.patient.first_name} ${denial.patient.last_name}`
      : "Patient";
    
    const variables: Record<string, string> = {
      patient_name: patientName,
      member_id: "[MEMBER ID]",
      dos: denial.service_date || denial.denial_date,
      claim_number: denial.claim?.claim_number || "[CLAIM NUMBER]",
      cpt_code: denial.cpt_code || "[CPT CODE]",
      cpt_description: denial.cpt_description || "",
      icd_codes: denial.icd_codes?.join(", ") || "[DIAGNOSIS CODES]",
      billed_amount: denial.billed_amount?.toFixed(2) || "0.00",
      denied_amount: denial.denied_amount?.toFixed(2) || "0.00",
      denial_reason: denial.reason_description || denial.reason_code || "[DENIAL REASON]",
      payer_name: denial.payer_name || "[PAYER NAME]",
      provider_name: input.providerInfo?.name || denial.claim?.provider_name || "[PROVIDER NAME]",
      provider_npi: input.providerInfo?.npi || denial.claim?.provider_npi || "[PROVIDER NPI]",
      practice_name: input.practiceInfo?.name || "[PRACTICE NAME]",
      practice_phone: input.practiceInfo?.phone || "[PRACTICE PHONE]",
      practice_address: input.practiceInfo?.address || "[PRACTICE ADDRESS]",
      clinical_justification: input.clinicalJustification || "[INSERT CLINICAL JUSTIFICATION]",
    };

    // Generate letter content
    let subjectLine = template?.subject_template || `Appeal for Claim ${variables.claim_number}`;
    let letterBody = template?.body_template || getDefaultTemplate();

    // Replace all template variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "gi");
      subjectLine = subjectLine.replace(regex, value);
      letterBody = letterBody.replace(regex, value);
    }

    // Enhance with AI if clinical justification is provided
    let aiConfidence = 70;
    if (input.clinicalJustification) {
      const enhancedContent = await enhanceWithAI(
        denial,
        letterBody,
        input.clinicalJustification
      );
      if (enhancedContent) {
        letterBody = enhancedContent.letter;
        aiConfidence = enhancedContent.confidence;
      }
    }

    // Calculate response deadline (typically 30-45 days from submission)
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 45);

    // Create appeal record
    const { data: appeal, error: appealError } = await supabaseClient
      .from("appeals")
      .insert({
        user_id: user.id,
        denial_queue_id: input.denialQueueId,
        claim_id: denial.claim_id,
        patient_id: denial.patient_id,
        template_id: template?.id || null,
        appeal_number: generateAppealNumber(),
        appeal_type: input.appealType || "first_level",
        payer_name: denial.payer_name,
        subject_line: subjectLine,
        letter_body: letterBody,
        disputed_amount: denial.denied_amount,
        requested_amount: denial.denied_amount,
        clinical_justification: input.clinicalJustification || null,
        supporting_documents: template?.required_attachments || [],
        status: "draft",
        response_deadline: responseDeadline.toISOString().split("T")[0],
        ai_generated: true,
        ai_confidence: aiConfidence,
      })
      .select()
      .single();

    if (appealError) {
      console.error("Error creating appeal:", appealError);
      throw new Error("Failed to create appeal");
    }

    // Update denial status
    await supabaseClient
      .from("denial_queue")
      .update({ status: "appealing" })
      .eq("id", input.denialQueueId);

    // Log action
    await supabaseClient.from("denial_actions").insert({
      user_id: user.id,
      denial_queue_id: input.denialQueueId,
      appeal_id: appeal.id,
      action_type: "appeal_generated",
      action_description: `Appeal letter generated using ${template?.name || "default"} template`,
      performed_by: user.id,
    });

    // Update template usage count
    if (template?.id) {
      await supabaseClient.rpc("increment_template_usage", { template_id: template.id });
    }

    return new Response(
      JSON.stringify({
        success: true,
        appealId: appeal.id,
        appealNumber: appeal.appeal_number,
        subjectLine,
        letterBody,
        requiredDocuments: template?.required_attachments || [],
        optionalDocuments: template?.optional_attachments || [],
        aiConfidence,
        responseDeadline: responseDeadline.toISOString().split("T")[0],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-appeal:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateAppealNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `APL-${dateStr}-${random}`;
}

async function enhanceWithAI(
  denial: any,
  baseLetter: string,
  clinicalJustification: string
): Promise<{ letter: string; confidence: number } | null> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!geminiApiKey) {
    return null;
  }

  const prompt = `You are a medical billing expert and appeal letter writer. Enhance this appeal letter with compelling clinical arguments.

DENIAL INFORMATION:
- Reason Code: ${denial.reason_code}
- Denial Reason: ${denial.reason_description || denial.root_cause}
- CPT Code: ${denial.cpt_code}
- Diagnosis Codes: ${denial.icd_codes?.join(", ") || "Not provided"}
- Denied Amount: $${denial.denied_amount}
- Category: ${denial.classified_category}

CLINICAL JUSTIFICATION PROVIDED:
${clinicalJustification}

BASE LETTER TEMPLATE:
${baseLetter}

TASK:
1. Keep the professional format and structure
2. Enhance the clinical justification section with compelling medical arguments
3. Add specific references to medical necessity criteria
4. Include relevant clinical guidelines or standards of care if applicable
5. Make the appeal persuasive but factual
6. Keep placeholders like [INSERT...] if specific information is missing

Return the enhanced letter text only, no additional commentary.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return null;
    }

    const data = await response.json();
    const enhancedLetter = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!enhancedLetter) {
      return null;
    }

    return {
      letter: enhancedLetter.trim(),
      confidence: 85,
    };

  } catch (error) {
    console.error("AI enhancement error:", error);
    return null;
  }
}

function getDefaultTemplate(): string {
  return "Dear Appeals Department,\n\n" +
    "We are writing to formally appeal the denial of services for our patient {{patient_name}} (Member ID: {{member_id}}).\n\n" +
    "**Claim Information:**\n" +
    "- Date of Service: {{dos}}\n" +
    "- Claim Number: {{claim_number}}\n" +
    "- Procedure Code: {{cpt_code}}\n" +
    "- Diagnosis: {{icd_codes}}\n" +
    "- Billed Amount: ${{billed_amount}}\n" +
    "- Denied Amount: ${{denied_amount}}\n\n" +
    "**Denial Reason:**\n" +
    "{{denial_reason}}\n\n" +
    "**Clinical Justification:**\n" +
    "{{clinical_justification}}\n\n" +
    "Based on the clinical documentation and medical necessity of the services rendered, we respectfully request that you overturn this denial and process the claim for payment.\n\n" +
    "Please find enclosed all supporting documentation. If you require additional information, please contact our office.\n\n" +
    "Sincerely,\n\n" +
    "{{provider_name}}\n" +
    "{{practice_name}}\n" +
    "Phone: {{practice_phone}}";
}
