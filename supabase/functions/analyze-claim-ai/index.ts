import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface ClaimData {
  claim_id?: string;
  patient_name?: string;
  patient_dob?: string;
  patient_gender?: string;
  date_of_service?: string;
  date_of_service_end?: string;
  procedure_codes?: Array<{
    code: string;
    modifiers?: string[];
    units?: number;
    charge?: number;
    description?: string;
  }>;
  diagnosis_codes?: string[];
  principal_diagnosis?: string;
  billed_amount?: number;
  place_of_service?: string;
  provider_npi?: string;
  provider_name?: string;
  provider_specialty?: string;
  payer_id?: string;
  payer_name?: string;
  prior_auth_number?: string;
  referring_provider?: string;
  facility_name?: string;
  admission_date?: string;
  discharge_date?: string;
  claim_type?: string;
  [key: string]: any;
}

interface RiskFactor {
  category: string;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  explanation: string;
  recommendation: string;
}

interface CodingIssue {
  type: 'cpt_dx_mismatch' | 'bundling' | 'modifier' | 'medical_necessity' | 'frequency' | 'other';
  code: string;
  issue: string;
  suggestion: string;
}

interface DocumentationGap {
  required_document: string;
  reason: string;
  impact: string;
}

interface PayerInsight {
  payer_tendency: string;
  known_requirements: string[];
  tips: string[];
}

interface ImprovementSuggestion {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  suggestion: string;
  expected_impact: string;
}

interface AIAnalysisResult {
  denial_risk_score: number;
  denial_risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  summary: string;
  risk_factors: RiskFactor[];
  coding_issues: CodingIssue[];
  documentation_gaps: DocumentationGap[];
  payer_insights: PayerInsight;
  improvement_suggestions: ImprovementSuggestion[];
  approval_likelihood: string;
  recommended_actions: string[];
  appeal_guidance?: {
    appeal_recommended: boolean;
    appeal_type: string;
    key_arguments: string[];
    supporting_documents: string[];
  };
}

// ============================================
// PAYER KNOWLEDGE BASE
// ============================================

const PAYER_KNOWLEDGE: Record<string, any> = {
  'BCBS': {
    name: 'Blue Cross Blue Shield',
    tendencies: 'Strict on medical necessity documentation, timely filing (90-180 days varies by state)',
    common_denials: ['Lack of prior authorization', 'Medical necessity', 'Bundling issues'],
    tips: [
      'Always include detailed clinical notes for E&M codes',
      'Pre-authorization required for most imaging and surgeries',
      'Appeal success rate higher with peer-to-peer review request'
    ]
  },
  'AETNA': {
    name: 'Aetna',
    tendencies: 'Focus on utilization management, strong pre-cert requirements',
    common_denials: ['Prior authorization', 'Out of network', 'Experimental treatment'],
    tips: [
      'Verify benefits and authorization before service',
      'Use Availity for real-time eligibility',
      'Document medical necessity with clinical guidelines'
    ]
  },
  'CIGNA': {
    name: 'Cigna',
    tendencies: 'Evidence-based coverage policies, tiered network restrictions',
    common_denials: ['Coverage limitations', 'Referral requirements', 'Step therapy'],
    tips: [
      'Check coverage policies on Cigna provider portal',
      'Include peer-reviewed literature for unusual procedures',
      'Request case manager for complex cases'
    ]
  },
  'UHC': {
    name: 'UnitedHealthcare',
    tendencies: 'Largest payer, complex authorization requirements, strict timely filing',
    common_denials: ['Authorization', 'Medical necessity', 'Coordination of benefits'],
    tips: [
      'Use Optum portal for authorizations',
      'File within 90 days of DOS',
      'Include all supporting documentation upfront'
    ]
  },
  'HUMANA': {
    name: 'Humana',
    tendencies: 'Strong Medicare Advantage presence, preventive care focus',
    common_denials: ['Medical necessity', 'Coverage limitations', 'Provider network'],
    tips: [
      'Verify MA plan specifics vs original Medicare',
      'Prior auth for DME and home health',
      'Use Humana provider portal for claim status'
    ]
  },
  'MEDICARE': {
    name: 'Medicare',
    tendencies: 'LCD/NCD compliance required, specific documentation standards',
    common_denials: ['Medical necessity per LCD', 'ABN requirements', 'Coding errors'],
    tips: [
      'Review LCD/NCD before billing',
      'Obtain ABN when coverage uncertain',
      'Use correct place of service codes',
      'Include required modifiers (e.g., -25 for separate E&M)'
    ]
  },
  'MEDICAID': {
    name: 'Medicaid',
    tendencies: 'State-specific rules, prior authorization heavy, lower reimbursement',
    common_denials: ['Prior authorization', 'Eligibility', 'Coverage limitations'],
    tips: [
      'Verify eligibility on date of service',
      'Check state-specific billing requirements',
      'Prior auth for most non-emergency services'
    ]
  },
  'DEFAULT': {
    name: 'Commercial Payer',
    tendencies: 'Standard commercial payer practices',
    common_denials: ['Authorization', 'Medical necessity', 'Timely filing'],
    tips: [
      'Verify benefits before service',
      'Obtain required authorizations',
      'Submit clean claims within filing deadline'
    ]
  }
};

// ============================================
// GET PAYER INFO
// ============================================

function getPayerInfo(payerId: string, payerName: string): any {
  const upperPayerId = (payerId || '').toUpperCase();
  const upperPayerName = (payerName || '').toUpperCase();
  
  for (const [key, info] of Object.entries(PAYER_KNOWLEDGE)) {
    if (key === 'DEFAULT') continue;
    if (upperPayerId.includes(key) || upperPayerName.includes(key)) {
      return info;
    }
  }
  
  if (upperPayerName.includes('MEDICARE') || upperPayerId.includes('MEDICARE')) {
    return PAYER_KNOWLEDGE['MEDICARE'];
  }
  if (upperPayerName.includes('MEDICAID') || upperPayerId.includes('MEDICAID')) {
    return PAYER_KNOWLEDGE['MEDICAID'];
  }
  
  return PAYER_KNOWLEDGE['DEFAULT'];
}

// ============================================
// BUILD GEMINI PROMPT
// ============================================

function buildAnalysisPrompt(claim: ClaimData, payerInfo: any): string {
  const proceduresList = claim.procedure_codes?.map(p => 
    `- ${p.code}${p.modifiers?.length ? ` (modifiers: ${p.modifiers.join(', ')})` : ''}: ${p.units || 1} units, $${p.charge || 0}`
  ).join('\n') || 'No procedures listed';

  const diagnosisList = claim.diagnosis_codes?.map((d, i) => 
    `- ${d}${i === 0 ? ' (Principal)' : ''}`
  ).join('\n') || 'No diagnoses listed';

  return `You are an expert Healthcare Revenue Cycle Management consultant with 20+ years of experience in medical billing, coding, and denial management. Analyze this claim and provide actionable insights to maximize approval rate.

## CLAIM DATA

**Patient Information:**
- Name: ${claim.patient_name || 'Not provided'}
- DOB: ${claim.patient_dob || 'Not provided'}
- Gender: ${claim.patient_gender || 'Not provided'}

**Service Information:**
- Date of Service: ${claim.date_of_service || 'Not provided'}${claim.date_of_service_end ? ` to ${claim.date_of_service_end}` : ''}
- Place of Service: ${claim.place_of_service || 'Not provided'}
- Claim Type: ${claim.claim_type || 'Professional'}

**Provider:**
- Name: ${claim.provider_name || 'Not provided'}
- NPI: ${claim.provider_npi || 'Not provided'}
- Specialty: ${claim.provider_specialty || 'Not provided'}
- Facility: ${claim.facility_name || 'Not provided'}

**Payer:**
- Payer: ${claim.payer_name || 'Not provided'} (${claim.payer_id || 'Unknown ID'})
- Known Tendencies: ${payerInfo.tendencies}
- Common Denial Reasons: ${payerInfo.common_denials?.join(', ') || 'Unknown'}

**Procedure Codes:**
${proceduresList}

**Diagnosis Codes:**
${diagnosisList}

**Financial:**
- Total Billed: $${claim.billed_amount || 0}

**Other Information:**
- Prior Auth Number: ${claim.prior_auth_number || 'None'}
- Referring Provider: ${claim.referring_provider || 'None'}
- Admission Date: ${claim.admission_date || 'N/A'}
- Discharge Date: ${claim.discharge_date || 'N/A'}

## YOUR TASK

Analyze this claim thoroughly and respond with a JSON object (no markdown, just raw JSON) containing:

{
  "denial_risk_score": <number 0-100>,
  "denial_risk_level": "<low|medium|high|critical>",
  "confidence": <number 0-100 how confident you are in this analysis>,
  "summary": "<2-3 sentence summary of the claim's status and main concerns>",
  "risk_factors": [
    {
      "category": "<coding|documentation|authorization|medical_necessity|timely_filing|payer_specific|other>",
      "severity": "<high|medium|low>",
      "issue": "<specific issue identified>",
      "explanation": "<why this is a risk>",
      "recommendation": "<specific action to fix>"
    }
  ],
  "coding_issues": [
    {
      "type": "<cpt_dx_mismatch|bundling|modifier|medical_necessity|frequency|other>",
      "code": "<affected code>",
      "issue": "<what's wrong>",
      "suggestion": "<how to fix>"
    }
  ],
  "documentation_gaps": [
    {
      "required_document": "<what's needed>",
      "reason": "<why it's needed>",
      "impact": "<what happens without it>"
    }
  ],
  "payer_insights": {
    "payer_tendency": "<specific insight about this payer>",
    "known_requirements": ["<requirement 1>", "<requirement 2>"],
    "tips": ["<tip 1>", "<tip 2>"]
  },
  "improvement_suggestions": [
    {
      "priority": "<critical|high|medium|low>",
      "category": "<category>",
      "suggestion": "<actionable suggestion>",
      "expected_impact": "<what improvement this brings>"
    }
  ],
  "approval_likelihood": "<percentage or qualitative assessment>",
  "recommended_actions": [
    "<action 1 - most important first>",
    "<action 2>",
    "<action 3>"
  ]
}

## ANALYSIS GUIDELINES

1. **Denial Risk Score**: Consider all factors - coding accuracy, documentation completeness, authorization status, payer tendencies, medical necessity support

2. **Coding Review**: Check for:
   - CPT/ICD-10 compatibility (does diagnosis support procedure?)
   - Bundling issues (NCCI edits)
   - Modifier appropriateness
   - Units and frequency

3. **Documentation**: What clinical documentation would strengthen this claim?

4. **Payer-Specific**: Use knowledge of ${payerInfo.name} to provide targeted insights

5. **Be Specific**: Don't give generic advice. Reference actual codes and specific issues.

6. **Prioritize**: Most critical issues first in each section

Respond with ONLY the JSON object, no additional text or markdown formatting.`;
}

// ============================================
// CALL GEMINI API
// ============================================

async function analyzeWithGemini(prompt: string, apiKey: string): Promise<AIAnalysisResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Could not parse Gemini response:", responseText);
    throw new Error("Invalid response format from Gemini");
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return result as AIAnalysisResult;
  } catch (parseError) {
    console.error("JSON parse error:", parseError, jsonMatch[0]);
    throw new Error("Failed to parse AI analysis result");
  }
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
      claim,
      includeAppealGuidance = false,
      denialReasons = [],
      documentId,
      saveAnalysis = true,
    } = await req.json();

    if (!claim) {
      throw new Error("Missing required field: claim");
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

    console.log(`Analyzing claim: ${claim.claim_id || 'unknown'}`);
    const startTime = Date.now();

    const payerInfo = getPayerInfo(claim.payer_id || '', claim.payer_name || '');

    let prompt = buildAnalysisPrompt(claim, payerInfo);

    if (includeAppealGuidance && denialReasons.length > 0) {
      prompt += `\n\n## ADDITIONAL CONTEXT: CLAIM WAS DENIED

This claim has already been denied with the following reasons:
${denialReasons.map((r: string) => `- ${r}`).join('\n')}

Also include an "appeal_guidance" object in your response:
{
  "appeal_guidance": {
    "appeal_recommended": <true|false>,
    "appeal_type": "<first_level|second_level|external_review|peer_to_peer>",
    "key_arguments": ["<argument 1>", "<argument 2>"],
    "supporting_documents": ["<doc 1>", "<doc 2>"]
  }
}`;
    }

    const analysis = await analyzeWithGemini(prompt, geminiKey);
    
    const processingTime = Date.now() - startTime;
    console.log(`Analysis complete: Risk score ${analysis.denial_risk_score}, Time: ${processingTime}ms`);

    if (saveAnalysis && claim.claim_id) {
      const { error: updateError } = await supabaseClient
        .from('claims')
        .update({
          ai_analysis: analysis,
          deniability_probability: analysis.denial_risk_score,
          risk_category: analysis.denial_risk_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.claim_id)
        .eq('user_id', user.id);

      if (updateError) {
        console.log('Could not update claim (may not exist):', updateError.message);
      }
    }

    const result = {
      success: true,
      analysis,
      processing_time_ms: processingTime,
      payer_info: {
        name: payerInfo.name,
        tendencies: payerInfo.tendencies,
      },
      metadata: {
        claim_id: claim.claim_id,
        analyzed_at: new Date().toISOString(),
        model: 'gemini-1.5-flash',
      },
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-claim-ai:", error);
    
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
