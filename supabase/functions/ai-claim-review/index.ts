import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface ClaimWithDocuments {
  id: string;
  claim_id?: string;
  patient_name?: string;
  date_of_service?: string;
  procedure_code?: string;
  diagnosis_code?: string;
  billed_amount?: number;
  status?: string;
  payer?: string;
  provider?: string;
  [key: string]: any;
  linked_documents?: Array<{
    document_id: string;
    document_role: string;
    filename: string;
    document_type: string;
    extracted_text: string;
    status: string;
  }>;
}

interface AIReviewResult {
  approval_probability: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  executive_summary: string;
  clinical_support_analysis: {
    has_sufficient_documentation: boolean;
    documentation_score: number;
    findings: string[];
    gaps: string[];
  };
  coding_analysis: {
    cpt_icd_alignment: string;
    issues_found: Array<{
      type: string;
      code: string;
      issue: string;
      fix: string;
    }>;
    coding_score: number;
  };
  medical_necessity_analysis: {
    is_supported: boolean;
    supporting_evidence: string[];
    concerns: string[];
    necessity_score: number;
  };
  payer_specific_analysis: {
    payer_name: string;
    known_requirements: string[];
    potential_issues: string[];
    recommendations: string[];
  };
  critical_issues: Array<{
    priority: number;
    issue: string;
    impact: string;
    resolution: string;
  }>;
  recommendations: Array<{
    category: string;
    recommendation: string;
    expected_impact: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  missing_documentation: Array<{
    document_type: string;
    why_needed: string;
    impact_without: string;
  }>;
  appeal_strategy?: {
    should_appeal: boolean;
    success_likelihood: number;
    appeal_type: string;
    key_arguments: string[];
    required_documents: string[];
    deadline_warning?: string;
  };
  next_steps: string[];
}

// ============================================
// PAYER KNOWLEDGE BASE
// ============================================

const PAYER_KNOWLEDGE: Record<string, any> = {
  'BCBS': {
    name: 'Blue Cross Blue Shield',
    requirements: [
      'Detailed clinical notes for E&M codes',
      'Prior authorization for surgeries and advanced imaging',
      'Medical necessity documentation referencing clinical guidelines',
      'Modifier 25 requires separately documented E&M'
    ],
    common_denials: ['Lack of prior auth', 'Medical necessity', 'Bundling/NCCI edits'],
    appeal_tips: ['Request peer-to-peer review', 'Cite BCBS clinical policies', 'Include all clinical notes']
  },
  'AETNA': {
    name: 'Aetna',
    requirements: [
      'Pre-certification for most procedures',
      'Clinical documentation supporting medical necessity',
      'Referral from PCP for specialists'
    ],
    common_denials: ['No pre-cert', 'Out of network', 'Experimental/investigational'],
    appeal_tips: ['Use Availity for status', 'Reference Aetna clinical policy bulletins']
  },
  'UHC': {
    name: 'UnitedHealthcare',
    requirements: [
      'Authorization through Optum',
      'Submit within 90 days',
      'Complete clinical documentation upfront'
    ],
    common_denials: ['Authorization', 'Timely filing', 'Medical necessity'],
    appeal_tips: ['File appeal within 180 days', 'Request clinical review']
  },
  'CIGNA': {
    name: 'Cigna',
    requirements: [
      'Evidence-based medical necessity',
      'Step therapy compliance for medications',
      'Prior auth for high-cost procedures'
    ],
    common_denials: ['Coverage limitations', 'Step therapy', 'Referral required'],
    appeal_tips: ['Cite peer-reviewed literature', 'Request independent review']
  },
  'HUMANA': {
    name: 'Humana',
    requirements: [
      'Verify Medicare Advantage vs Original Medicare rules',
      'Prior auth for DME and home health',
      'Network verification'
    ],
    common_denials: ['Medical necessity', 'Coverage limits', 'Out of network'],
    appeal_tips: ['Reference CMS guidelines for MA plans']
  },
  'MEDICARE': {
    name: 'Medicare',
    requirements: [
      'LCD/NCD compliance required',
      'ABN for non-covered services',
      'Correct place of service codes',
      'Required modifiers (25, 59, etc.)'
    ],
    common_denials: ['Not medically necessary per LCD', 'Missing ABN', 'Coding errors'],
    appeal_tips: ['Reference LCD/NCD in appeal', 'Request Qualified Independent Contractor (QIC) review']
  },
  'MEDICAID': {
    name: 'Medicaid',
    requirements: [
      'State-specific rules apply',
      'Eligibility verification on DOS',
      'Prior auth for most non-emergency services'
    ],
    common_denials: ['Eligibility', 'Prior auth', 'Coverage limitations'],
    appeal_tips: ['Check state-specific appeal deadlines', 'Request fair hearing if needed']
  },
  'DEFAULT': {
    name: 'Commercial Payer',
    requirements: ['Verify benefits', 'Obtain authorizations', 'Submit clean claims timely'],
    common_denials: ['Authorization', 'Medical necessity', 'Timely filing'],
    appeal_tips: ['Follow payer-specific appeal process', 'Include all documentation']
  }
};

function getPayerKnowledge(payerName: string): any {
  const upper = (payerName || '').toUpperCase();
  for (const [key, info] of Object.entries(PAYER_KNOWLEDGE)) {
    if (key !== 'DEFAULT' && upper.includes(key)) {
      return info;
    }
  }
  if (upper.includes('MEDICARE')) return PAYER_KNOWLEDGE['MEDICARE'];
  if (upper.includes('MEDICAID')) return PAYER_KNOWLEDGE['MEDICAID'];
  return PAYER_KNOWLEDGE['DEFAULT'];
}

// ============================================
// BUILD AI PROMPT
// ============================================

function buildReviewPrompt(claim: ClaimWithDocuments, payerInfo: any, isDenied: boolean, denialReasons?: string[]): string {
  const documentsSection = claim.linked_documents && claim.linked_documents.length > 0
    ? claim.linked_documents.map(doc => `
### ${doc.document_role.toUpperCase()}: ${doc.filename}
Type: ${doc.document_type || 'Unknown'}
Content:
"""
${doc.extracted_text?.substring(0, 8000) || 'No text extracted'}
"""
`).join('\n')
    : 'NO CLINICAL DOCUMENTS ATTACHED - This is a significant gap!';

  const denialSection = isDenied && denialReasons?.length 
    ? `
## ⚠️ THIS CLAIM WAS DENIED

Denial Reasons:
${denialReasons.map(r => `- ${r}`).join('\n')}

You MUST include appeal_strategy in your response.
`
    : '';

  return `You are an expert Healthcare Revenue Cycle Management consultant with 20+ years of experience in medical coding, billing, clinical documentation improvement (CDI), and denial management. 

Your task is to perform a COMPREHENSIVE AI review of this claim and its supporting clinical documentation to:
1. Predict approval likelihood
2. Identify issues that could cause denials
3. Verify clinical documentation supports the services billed
4. Provide specific, actionable recommendations

## CLAIM INFORMATION

**Claim Details:**
- Claim ID: ${claim.id}
- Claim Number: ${claim.claim_id || 'N/A'}
- Status: ${claim.status || 'Pending'}
- Patient: ${claim.patient_name || 'Unknown'}
- Date of Service: ${claim.date_of_service || 'Unknown'}

**Procedure/Diagnosis:**
- CPT/Procedure Code: ${claim.procedure_code || 'Not provided'}
- ICD-10/Diagnosis Code: ${claim.diagnosis_code || 'Not provided'}

**Financial:**
- Billed Amount: $${claim.billed_amount || 0}

**Provider:**
- Provider: ${claim.provider || 'Unknown'}

**Payer:**
- Payer: ${claim.payer || 'Unknown'}
- Known Requirements: ${payerInfo.requirements?.join('; ') || 'Standard'}
- Common Denial Reasons: ${payerInfo.common_denials?.join('; ') || 'Unknown'}
${denialSection}

## CLINICAL DOCUMENTATION

${documentsSection}

## YOUR ANALYSIS TASK

Analyze EVERYTHING above and respond with a JSON object (no markdown, raw JSON only):

{
  "approval_probability": <0-100>,
  "risk_level": "<low|medium|high|critical>",
  "confidence_score": <0-100>,
  
  "executive_summary": "<2-3 sentence summary of claim status, main concerns, and recommendation>",
  
  "clinical_support_analysis": {
    "has_sufficient_documentation": <true|false>,
    "documentation_score": <0-100>,
    "findings": ["<what the clinical docs DO support>"],
    "gaps": ["<what's missing or unclear>"]
  },
  
  "coding_analysis": {
    "cpt_icd_alignment": "<assessment of whether diagnosis supports procedure>",
    "issues_found": [
      {
        "type": "<bundling|modifier|medical_necessity|frequency|mismatch|other>",
        "code": "<affected code>",
        "issue": "<specific problem>",
        "fix": "<how to fix it>"
      }
    ],
    "coding_score": <0-100>
  },
  
  "medical_necessity_analysis": {
    "is_supported": <true|false>,
    "supporting_evidence": ["<evidence from clinical docs>"],
    "concerns": ["<concerns about medical necessity>"],
    "necessity_score": <0-100>
  },
  
  "payer_specific_analysis": {
    "payer_name": "${payerInfo.name}",
    "known_requirements": ${JSON.stringify(payerInfo.requirements || [])},
    "potential_issues": ["<payer-specific issues>"],
    "recommendations": ["<payer-specific recommendations>"]
  },
  
  "critical_issues": [
    {
      "priority": <1-5, 1 is highest>,
      "issue": "<the problem>",
      "impact": "<what happens if not fixed>",
      "resolution": "<exactly how to fix it>"
    }
  ],
  
  "recommendations": [
    {
      "category": "<documentation|coding|authorization|submission|other>",
      "recommendation": "<specific actionable recommendation>",
      "expected_impact": "<how this improves approval chance>",
      "effort": "<low|medium|high>"
    }
  ],
  
  "missing_documentation": [
    {
      "document_type": "<what's needed>",
      "why_needed": "<why this specific claim needs it>",
      "impact_without": "<denial risk without it>"
    }
  ],
  
  ${isDenied ? `"appeal_strategy": {
    "should_appeal": <true|false>,
    "success_likelihood": <0-100>,
    "appeal_type": "<first_level|second_level|external_review|peer_to_peer>",
    "key_arguments": ["<argument 1>", "<argument 2>"],
    "required_documents": ["<doc needed for appeal>"],
    "deadline_warning": "<appeal deadline info if known>"
  },` : ''}
  
  "next_steps": [
    "<step 1 - most important>",
    "<step 2>",
    "<step 3>"
  ]
}

## CRITICAL GUIDELINES

1. **Be Specific**: Reference actual codes, actual text from clinical docs, actual payer requirements
2. **Quantify Risk**: Use the scores to give clear risk assessment
3. **Actionable**: Every issue must have a specific resolution
4. **Clinical Focus**: Compare what's documented vs what's billed - do they align?
5. **Payer Aware**: Factor in ${payerInfo.name}'s known tendencies
6. **If No Docs**: If no clinical documents are attached, this is a CRITICAL issue - call it out prominently

Respond ONLY with the JSON object.`;
}

// ============================================
// CALL GEMINI
// ============================================

async function reviewWithGemini(prompt: string, apiKey: string): Promise<AIReviewResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response");
  }

  return JSON.parse(jsonMatch[0]) as AIReviewResult;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      claimId,
      includeAppealStrategy = false,
      denialReasons = [],
    } = await req.json();

    if (!claimId) {
      throw new Error("Missing required field: claimId");
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

    console.log(`AI Review for claim: ${claimId}`);
    const startTime = Date.now();

    // Fetch claim with linked documents
    const { data: claim, error: claimError } = await supabaseClient
      .from('claims')
      .select(`
        *,
        claim_documents (
          document_id,
          document_role,
          documents (
            id,
            filename,
            document_type,
            extracted_text,
            status
          )
        )
      `)
      .eq('id', claimId)
      .eq('user_id', user.id)
      .single();

    if (claimError || !claim) {
      throw new Error(`Claim not found: ${claimError?.message || 'Not found'}`);
    }

    // Transform linked documents
    const claimWithDocs: ClaimWithDocuments = {
      ...claim,
      linked_documents: claim.claim_documents?.map((cd: any) => ({
        document_id: cd.document_id,
        document_role: cd.document_role,
        filename: cd.documents?.filename || 'Unknown',
        document_type: cd.documents?.document_type || 'Unknown',
        extracted_text: cd.documents?.extracted_text || '',
        status: cd.documents?.status || 'Unknown',
      })) || [],
    };

    console.log(`Found ${claimWithDocs.linked_documents?.length || 0} linked documents`);

    // Get payer knowledge
    const payerInfo = getPayerKnowledge(claim.payer || '');

    // Determine if this is a denied claim
    const isDenied = claim.status?.toLowerCase().includes('denied') || 
                     claim.status?.toLowerCase().includes('rejected') ||
                     includeAppealStrategy;

    // Build prompt and call Gemini
    const prompt = buildReviewPrompt(claimWithDocs, payerInfo, isDenied, denialReasons);
    const aiResult = await reviewWithGemini(prompt, geminiKey);

    const processingTime = Date.now() - startTime;
    console.log(`AI Review complete: ${aiResult.approval_probability}% approval, ${processingTime}ms`);

    // Save analysis to claim
    const { error: updateError } = await supabaseClient
      .from('claims')
      .update({
        ai_analysis: aiResult,
        deniability_probability: 100 - aiResult.approval_probability,
        risk_category: aiResult.risk_level,
        ai_reviewed_at: new Date().toISOString(),
        ai_recommendations: aiResult.next_steps,
      })
      .eq('id', claimId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error saving AI analysis:', updateError);
    }

    // Build response
    const response = {
      success: true,
      claim_id: claimId,
      review: aiResult,
      documents_analyzed: claimWithDocs.linked_documents?.length || 0,
      processing_time_ms: processingTime,
      payer_info: {
        name: payerInfo.name,
        requirements: payerInfo.requirements,
      },
      metadata: {
        reviewed_at: new Date().toISOString(),
        model: 'gemini-1.5-pro',
        has_clinical_docs: (claimWithDocs.linked_documents?.length || 0) > 0,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ai-claim-review:", error);
    
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
