import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedData {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  reviewOfSystems?: string[];
  physicalExam?: Record<string, string>;
  assessment?: string[];
  plan?: string[];
  proceduresPerformed?: string[];
  medicationsAdministered?: string[];
  timeSpent?: number | null;
  mdmComplexity?: string;
  diagnoses?: Array<{ code?: string; description: string }>;
  vitals?: Record<string, string>;
}

interface PredictedCPT {
  cptCode: string;
  cptDescription: string;
  units: number;
  modifiers: string[];
  confidenceScore: number;
  confidenceLevel: string;
  supportingText: string;
  reasoning: string;
  estimatedValue: number;
  category: string;
}

interface PredictInput {
  clinicalNoteId: string;
  extractedData: ExtractedData;
  rawContent: string;
  patientAge?: number;
  isNewPatient?: boolean;
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

    const input: PredictInput = await req.json();
    console.log("Predicting CPT codes for note:", input.clinicalNoteId);

    // Fetch CPT documentation rules
    const { data: cptRules, error: rulesError } = await supabaseClient
      .from("cpt_documentation_rules")
      .select("*")
      .eq("active", true);

    if (rulesError) {
      console.error("Error fetching CPT rules:", rulesError);
    }

    const rules = cptRules || [];
    console.log("Loaded", rules.length, "CPT rules");

    // Predict CPT codes using rules and AI
    const predictions = await predictCPTCodes(
      input.extractedData,
      input.rawContent,
      rules,
      input.isNewPatient || false
    );

    console.log("Generated", predictions.length, "predictions");

    return new Response(
      JSON.stringify({
        success: true,
        clinicalNoteId: input.clinicalNoteId,
        predictions,
        ruleCount: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in predict-cpt-codes:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function predictCPTCodes(
  extractedData: ExtractedData,
  rawContent: string,
  rules: any[],
  isNewPatient: boolean
): Promise<PredictedCPT[]> {
  const predictions: PredictedCPT[] = [];
  const lowerContent = rawContent.toLowerCase();
  const usedCodes = new Set<string>();

  // 1. PREDICT E/M CODE
  const emCode = predictEMCode(extractedData, isNewPatient, rules);
  if (emCode) {
    predictions.push(emCode);
    usedCodes.add(emCode.cptCode);
  }

  // 2. MATCH RULES AGAINST CONTENT
  for (const rule of rules) {
    if (usedCodes.has(rule.cpt_code)) continue;
    if (rule.cpt_category === "E/M Office" || rule.cpt_category === "E/M Office New") continue;

    const matchResult = matchRuleToContent(rule, lowerContent, extractedData);
    
    if (matchResult.matches) {
      predictions.push({
        cptCode: rule.cpt_code,
        cptDescription: rule.cpt_description,
        units: matchResult.units,
        modifiers: matchResult.modifiers,
        confidenceScore: matchResult.confidence,
        confidenceLevel: matchResult.confidence >= 80 ? "high" : matchResult.confidence >= 60 ? "medium" : "low",
        supportingText: matchResult.supportingText,
        reasoning: matchResult.reasoning,
        estimatedValue: (rule.medicare_rate || 0) * matchResult.units,
        category: rule.cpt_category,
      });
      usedCodes.add(rule.cpt_code);
    }
  }

  // 3. CHECK FOR COMMONLY MISSED CODES
  const missedCodes = checkForMissedCodes(extractedData, lowerContent, rules, usedCodes);
  predictions.push(...missedCodes);

  // 4. USE AI FOR ADDITIONAL PREDICTIONS
  const aiPredictions = await getAIPredictions(rawContent, extractedData, usedCodes);
  predictions.push(...aiPredictions);

  // Sort by confidence
  predictions.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return predictions;
}

function predictEMCode(extractedData: ExtractedData, isNewPatient: boolean, rules: any[]): PredictedCPT | null {
  const mdm = extractedData.mdmComplexity?.toLowerCase() || "low";
  const timeSpent = extractedData.timeSpent || 0;
  
  // Determine E/M level based on MDM
  let level = 3; // Default to 99213/99203
  let reasoning = "Default to level 3 based on documentation";

  if (mdm === "straightforward" || mdm === "minimal") {
    level = 2;
    reasoning = "Straightforward MDM supports level 2";
  } else if (mdm === "low") {
    level = 3;
    reasoning = "Low complexity MDM supports level 3";
  } else if (mdm === "moderate") {
    level = 4;
    reasoning = "Moderate complexity MDM supports level 4";
  } else if (mdm === "high") {
    level = 5;
    reasoning = "High complexity MDM supports level 5";
  }

  // Time can upgrade the level
  if (timeSpent >= 40 && level < 5) {
    level = 5;
    reasoning = `Time-based: ${timeSpent} minutes documented supports level 5`;
  } else if (timeSpent >= 30 && level < 4) {
    level = 4;
    reasoning = `Time-based: ${timeSpent} minutes documented supports level 4`;
  }

  // Select appropriate code
  const codeMap: Record<string, { code: string; desc: string; rate: number }> = isNewPatient
    ? {
        "2": { code: "99202", desc: "Office visit, new patient, straightforward", rate: 74 },
        "3": { code: "99203", desc: "Office visit, new patient, low complexity", rate: 115 },
        "4": { code: "99204", desc: "Office visit, new patient, moderate complexity", rate: 174 },
        "5": { code: "99205", desc: "Office visit, new patient, high complexity", rate: 224 },
      }
    : {
        "2": { code: "99212", desc: "Office visit, established, straightforward", rate: 57 },
        "3": { code: "99213", desc: "Office visit, established, low complexity", rate: 97 },
        "4": { code: "99214", desc: "Office visit, established, moderate complexity", rate: 143 },
        "5": { code: "99215", desc: "Office visit, established, high complexity", rate: 193 },
      };

  const selected = codeMap[level.toString()] || codeMap["3"];
  
  return {
    cptCode: selected.code,
    cptDescription: selected.desc,
    units: 1,
    modifiers: [],
    confidenceScore: 75,
    confidenceLevel: "medium",
    supportingText: `MDM: ${mdm}${timeSpent ? `, Time: ${timeSpent} min` : ""}`,
    reasoning,
    estimatedValue: selected.rate,
    category: isNewPatient ? "E/M Office New" : "E/M Office",
  };
}

function matchRuleToContent(
  rule: any,
  lowerContent: string,
  extractedData: ExtractedData
): { matches: boolean; confidence: number; units: number; modifiers: string[]; supportingText: string; reasoning: string } {
  const requiredKeywords: string[] = rule.required_keywords || [];
  const supportingKeywords: string[] = rule.supporting_keywords || [];
  const exclusionKeywords: string[] = rule.exclusion_keywords || [];

  // Check for exclusions first
  for (const keyword of exclusionKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return { matches: false, confidence: 0, units: 1, modifiers: [], supportingText: "", reasoning: "" };
    }
  }

  // Count required keyword matches
  let requiredMatches = 0;
  let matchedKeywords: string[] = [];
  
  for (const keyword of requiredKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      requiredMatches++;
      matchedKeywords.push(keyword);
    }
  }

  // Need at least one required keyword
  if (requiredMatches === 0) {
    return { matches: false, confidence: 0, units: 1, modifiers: [], supportingText: "", reasoning: "" };
  }

  // Count supporting matches
  let supportingMatches = 0;
  for (const keyword of supportingKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      supportingMatches++;
    }
  }

  // Calculate confidence
  const requiredRatio = requiredMatches / Math.max(requiredKeywords.length, 1);
  const supportingBonus = Math.min(supportingMatches * 5, 20);
  let confidence = Math.min(requiredRatio * 70 + supportingBonus + 10, 95);

  // Check procedures performed for boost
  const procedures = extractedData.proceduresPerformed || [];
  for (const proc of procedures) {
    if (requiredKeywords.some(k => proc.toLowerCase().includes(k.toLowerCase()))) {
      confidence = Math.min(confidence + 15, 95);
      break;
    }
  }

  // Determine modifiers
  const modifiers: string[] = [];
  const commonModifiers: string[] = rule.common_modifiers || [];
  
  if (commonModifiers.includes("RT") && (lowerContent.includes("right") || lowerContent.includes(" rt "))) {
    modifiers.push("RT");
  }
  if (commonModifiers.includes("LT") && (lowerContent.includes("left") || lowerContent.includes(" lt "))) {
    modifiers.push("LT");
  }
  if (commonModifiers.includes("50") && lowerContent.includes("bilateral")) {
    modifiers.push("50");
  }

  // Find supporting text (excerpt)
  let supportingText = "";
  for (const keyword of matchedKeywords) {
    const idx = lowerContent.indexOf(keyword.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 30);
      const end = Math.min(lowerContent.length, idx + keyword.length + 50);
      supportingText = "..." + lowerContent.slice(start, end).trim() + "...";
      break;
    }
  }

  return {
    matches: confidence >= 50,
    confidence,
    units: 1,
    modifiers,
    supportingText,
    reasoning: `Matched keywords: ${matchedKeywords.join(", ")}`,
  };
}

function checkForMissedCodes(
  extractedData: ExtractedData,
  lowerContent: string,
  rules: any[],
  usedCodes: Set<string>
): PredictedCPT[] {
  const missed: PredictedCPT[] = [];
  const medications = extractedData.medicationsAdministered || [];

  // Check for medication administration codes
  const drugRules = rules.filter(r => r.cpt_category === "Drug");
  
  for (const med of medications) {
    const medLower = med.toLowerCase();
    
    for (const rule of drugRules) {
      if (usedCodes.has(rule.cpt_code)) continue;
      
      const keywords: string[] = rule.required_keywords || [];
      if (keywords.some(k => medLower.includes(k.toLowerCase()))) {
        missed.push({
          cptCode: rule.cpt_code,
          cptDescription: rule.cpt_description,
          units: 1,
          modifiers: [],
          confidenceScore: 85,
          confidenceLevel: "high",
          supportingText: med,
          reasoning: "Medication administered in office - billable drug code",
          estimatedValue: rule.medicare_rate || 0,
          category: "Drug",
        });
        usedCodes.add(rule.cpt_code);
        break;
      }
    }
  }

  // Check for injection administration
  if ((medications.length > 0 || lowerContent.includes("injection") || lowerContent.includes("administered")) 
      && !usedCodes.has("96372")) {
    const rule = rules.find(r => r.cpt_code === "96372");
    if (rule) {
      missed.push({
        cptCode: "96372",
        cptDescription: "Therapeutic injection, SC or IM",
        units: 1,
        modifiers: [],
        confidenceScore: 75,
        confidenceLevel: "medium",
        supportingText: "Injection/medication administered",
        reasoning: "Injection administration code often missed",
        estimatedValue: rule.medicare_rate || 25,
        category: "Injection",
      });
      usedCodes.add("96372");
    }
  }

  // Check for prolonged services
  const timeSpent = extractedData.timeSpent || 0;
  if (timeSpent >= 55 && !usedCodes.has("99354")) {
    const rule = rules.find(r => r.cpt_code === "99354");
    missed.push({
      cptCode: "99354",
      cptDescription: "Prolonged service, office, first hour",
      units: 1,
      modifiers: [],
      confidenceScore: 80,
      confidenceLevel: "high",
      supportingText: `${timeSpent} minutes documented`,
      reasoning: "Time exceeds 54 minutes - prolonged service billable",
      estimatedValue: rule?.medicare_rate || 126,
      category: "Add-on",
    });
    usedCodes.add("99354");
  }

  return missed;
}

async function getAIPredictions(
  rawContent: string,
  extractedData: ExtractedData,
  usedCodes: Set<string>
): Promise<PredictedCPT[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.log("No Lovable API key, skipping AI predictions");
    return [];
  }

  const systemPrompt = `You are a medical billing expert. Identify additional billable CPT codes from clinical documentation. Return ONLY valid JSON array.`;

  const userPrompt = `Review this clinical note and identify any additional billable CPT codes that may have been missed.

Already identified codes: ${Array.from(usedCodes).join(", ")}

Procedures found: ${extractedData.proceduresPerformed?.join("; ") || "None listed"}
Medications administered: ${extractedData.medicationsAdministered?.join("; ") || "None listed"}

CLINICAL NOTE:
${rawContent.slice(0, 3000)}

Identify UP TO 3 additional CPT codes that should be billed based on the documentation. Focus on:
1. Procedures mentioned but not coded
2. Tests performed (ECG, labs, etc.)
3. Supplies or drug codes

Return a JSON array:
[
  {
    "cptCode": "code",
    "description": "description",
    "confidence": 70-95,
    "reasoning": "why this code applies"
  }
]

If no additional codes, return empty array [].
Return ONLY valid JSON.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        console.error("Rate limit exceeded");
      }
      if (response.status === 402) {
        console.error("Payment required");
      }
      
      return [];
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return [];

    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

    const aiCodes = JSON.parse(jsonStr.trim());
    
    return aiCodes
      .filter((c: any) => !usedCodes.has(c.cptCode))
      .map((c: any) => ({
        cptCode: c.cptCode,
        cptDescription: c.description,
        units: 1,
        modifiers: [],
        confidenceScore: c.confidence || 70,
        confidenceLevel: c.confidence >= 80 ? "high" : c.confidence >= 60 ? "medium" : "low",
        supportingText: "",
        reasoning: c.reasoning || "AI identified from documentation",
        estimatedValue: 0,
        category: "AI Suggested",
      }));

  } catch (error) {
    console.error("AI prediction error:", error);
    return [];
  }
}
