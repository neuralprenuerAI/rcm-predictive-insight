import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PredictedCharge {
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

interface ActualCharge {
  cptCode: string;
  cptDescription?: string;
  units: number;
  modifiers?: string[];
  icdCodes?: string[];
  chargeAmount?: number;
}

interface CompareInput {
  clinicalNoteId: string;
  predictions: PredictedCharge[];
  actualCharges: ActualCharge[];
}

interface Discrepancy {
  type: string;
  severity: string;
  predictedCpt: string | null;
  predictedUnits: number | null;
  predictedModifiers: string[] | null;
  actualCpt: string | null;
  actualUnits: number | null;
  actualModifiers: string[] | null;
  revenueImpact: number;
  description: string;
  aiExplanation: string;
  supportingText: string;
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

    const input: CompareInput = await req.json();
    console.log("Comparing charges for note:", input.clinicalNoteId);
    console.log("Predictions:", input.predictions.length, "Actual:", input.actualCharges.length);

    const startTime = Date.now();

    // Create audit record
    const { data: audit, error: auditError } = await supabaseClient
      .from("charge_audits")
      .insert({
        user_id: user.id,
        clinical_note_id: input.clinicalNoteId,
        status: "comparing",
        predicted_count: input.predictions.length,
        actual_count: input.actualCharges.length,
      })
      .select()
      .single();

    if (auditError) {
      console.error("Error creating audit:", auditError);
      throw new Error("Failed to create audit record");
    }

    // Save predicted charges
    for (const pred of input.predictions) {
      await supabaseClient.from("predicted_charges").insert({
        audit_id: audit.id,
        cpt_code: pred.cptCode,
        cpt_description: pred.cptDescription,
        units: pred.units,
        modifiers: pred.modifiers,
        confidence_score: pred.confidenceScore,
        confidence_level: pred.confidenceLevel,
        supporting_text: pred.supportingText,
        reasoning: pred.reasoning,
        estimated_value: pred.estimatedValue,
        match_status: "pending",
      });
    }

    // Save actual charges
    for (const actual of input.actualCharges) {
      await supabaseClient.from("actual_charges").insert({
        audit_id: audit.id,
        cpt_code: actual.cptCode,
        cpt_description: actual.cptDescription || "",
        units: actual.units,
        modifiers: actual.modifiers || [],
        icd_codes: actual.icdCodes || [],
        charge_amount: actual.chargeAmount || 0,
        source: "manual",
      });
    }

    // Compare and find discrepancies
    const comparison = compareCharges(input.predictions, input.actualCharges);
    
    // Save discrepancies
    for (const disc of comparison.discrepancies) {
      await supabaseClient.from("audit_discrepancies").insert({
        audit_id: audit.id,
        discrepancy_type: disc.type,
        severity: disc.severity,
        predicted_cpt: disc.predictedCpt,
        predicted_units: disc.predictedUnits,
        predicted_modifiers: disc.predictedModifiers,
        actual_cpt: disc.actualCpt,
        actual_units: disc.actualUnits,
        actual_modifiers: disc.actualModifiers,
        revenue_impact: disc.revenueImpact,
        description: disc.description,
        ai_explanation: disc.aiExplanation,
        supporting_text: disc.supportingText,
        status: "open",
      });
    }

    const processingTime = Date.now() - startTime;

    // Update audit with results
    await supabaseClient
      .from("charge_audits")
      .update({
        status: "completed",
        matched_count: comparison.matchedCount,
        missing_count: comparison.missingCount,
        undercoded_count: comparison.undercodedCount,
        overcoded_count: comparison.overcodedCount,
        potential_revenue: comparison.potentialRevenue,
        overall_confidence: comparison.avgConfidence,
        processing_time_ms: processingTime,
      })
      .eq("id", audit.id);

    // Update predicted charges with match status
    for (const pred of input.predictions) {
      const matchStatus = comparison.matchedCodes.has(pred.cptCode) 
        ? "matched" 
        : "missing";
      
      await supabaseClient
        .from("predicted_charges")
        .update({ match_status: matchStatus })
        .eq("audit_id", audit.id)
        .eq("cpt_code", pred.cptCode);
    }

    return new Response(
      JSON.stringify({
        success: true,
        auditId: audit.id,
        summary: {
          predictedCount: input.predictions.length,
          actualCount: input.actualCharges.length,
          matchedCount: comparison.matchedCount,
          missingCount: comparison.missingCount,
          undercodedCount: comparison.undercodedCount,
          overcodedCount: comparison.overcodedCount,
          potentialRevenue: comparison.potentialRevenue,
        },
        discrepancies: comparison.discrepancies,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in compare-charges:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function compareCharges(
  predictions: PredictedCharge[],
  actuals: ActualCharge[]
): {
  matchedCount: number;
  missingCount: number;
  undercodedCount: number;
  overcodedCount: number;
  potentialRevenue: number;
  avgConfidence: number;
  matchedCodes: Set<string>;
  discrepancies: Discrepancy[];
} {
  const discrepancies: Discrepancy[] = [];
  const matchedCodes = new Set<string>();
  const actualCodes = new Map<string, ActualCharge>();
  
  // Index actual charges by CPT code
  for (const actual of actuals) {
    actualCodes.set(actual.cptCode, actual);
  }

  let matchedCount = 0;
  let missingCount = 0;
  let undercodedCount = 0;
  let overcodedCount = 0;
  let potentialRevenue = 0;
  let totalConfidence = 0;

  // Check each prediction against actuals
  for (const pred of predictions) {
    totalConfidence += pred.confidenceScore;
    
    const actual = actualCodes.get(pred.cptCode);
    
    if (!actual) {
      // MISSING CHARGE - predicted but not billed
      if (pred.confidenceScore >= 60) {
        missingCount++;
        potentialRevenue += pred.estimatedValue;
        
        discrepancies.push({
          type: "missing_charge",
          severity: pred.confidenceScore >= 80 ? "high" : "medium",
          predictedCpt: pred.cptCode,
          predictedUnits: pred.units,
          predictedModifiers: pred.modifiers,
          actualCpt: null,
          actualUnits: null,
          actualModifiers: null,
          revenueImpact: pred.estimatedValue,
          description: `${pred.cptCode} - ${pred.cptDescription} not billed`,
          aiExplanation: pred.reasoning,
          supportingText: pred.supportingText,
        });
      }
    } else {
      matchedCodes.add(pred.cptCode);
      matchedCount++;

      // Check for unit discrepancy
      if (pred.units > actual.units) {
        undercodedCount++;
        const unitDiff = pred.units - actual.units;
        const impact = (pred.estimatedValue / pred.units) * unitDiff;
        potentialRevenue += impact;

        discrepancies.push({
          type: "wrong_units",
          severity: "medium",
          predictedCpt: pred.cptCode,
          predictedUnits: pred.units,
          predictedModifiers: pred.modifiers,
          actualCpt: actual.cptCode,
          actualUnits: actual.units,
          actualModifiers: actual.modifiers || [],
          revenueImpact: impact,
          description: `${pred.cptCode}: billed ${actual.units} units, documentation supports ${pred.units}`,
          aiExplanation: pred.reasoning,
          supportingText: pred.supportingText,
        });
      }

      // Check for missing modifiers
      for (const mod of pred.modifiers) {
        if (!actual.modifiers?.includes(mod)) {
          discrepancies.push({
            type: "missing_modifier",
            severity: "low",
            predictedCpt: pred.cptCode,
            predictedUnits: pred.units,
            predictedModifiers: pred.modifiers,
            actualCpt: actual.cptCode,
            actualUnits: actual.units,
            actualModifiers: actual.modifiers || [],
            revenueImpact: 0,
            description: `${pred.cptCode}: modifier ${mod} may be applicable`,
            aiExplanation: `Documentation suggests ${mod} modifier`,
            supportingText: pred.supportingText,
          });
        }
      }
    }
  }

  // Check for E/M level discrepancies
  const emPrediction = predictions.find(p => 
    p.cptCode.startsWith("992") || p.cptCode.startsWith("993")
  );
  const emActual = actuals.find(a => 
    a.cptCode.startsWith("992") || a.cptCode.startsWith("993")
  );

  if (emPrediction && emActual && emPrediction.cptCode !== emActual.cptCode) {
    const predLevel = parseInt(emPrediction.cptCode.slice(-1));
    const actualLevel = parseInt(emActual.cptCode.slice(-1));

    if (predLevel > actualLevel) {
      // Undercoded E/M
      undercodedCount++;
      const impact = emPrediction.estimatedValue - (actualLevel === 2 ? 57 : actualLevel === 3 ? 97 : actualLevel === 4 ? 143 : 193);
      potentialRevenue += Math.max(0, impact);

      discrepancies.push({
        type: "undercoded",
        severity: "high",
        predictedCpt: emPrediction.cptCode,
        predictedUnits: 1,
        predictedModifiers: [],
        actualCpt: emActual.cptCode,
        actualUnits: 1,
        actualModifiers: [],
        revenueImpact: Math.max(0, impact),
        description: `E/M level: billed ${emActual.cptCode}, documentation supports ${emPrediction.cptCode}`,
        aiExplanation: emPrediction.reasoning,
        supportingText: emPrediction.supportingText,
      });
    } else if (predLevel < actualLevel) {
      // Potentially overcoded - compliance risk
      overcodedCount++;

      discrepancies.push({
        type: "overcoded",
        severity: "critical",
        predictedCpt: emPrediction.cptCode,
        predictedUnits: 1,
        predictedModifiers: [],
        actualCpt: emActual.cptCode,
        actualUnits: 1,
        actualModifiers: [],
        revenueImpact: 0,
        description: `⚠️ COMPLIANCE: billed ${emActual.cptCode}, documentation may only support ${emPrediction.cptCode}`,
        aiExplanation: "Documentation may not fully support billed E/M level - review recommended",
        supportingText: emPrediction.supportingText,
      });
    }
  }

  // Check for codes billed but not predicted (potential overcoding)
  for (const actual of actuals) {
    if (!matchedCodes.has(actual.cptCode) && !actual.cptCode.startsWith("992")) {
      // Check if this was in predictions at all
      const wasPredicted = predictions.some(p => p.cptCode === actual.cptCode);
      if (!wasPredicted) {
        overcodedCount++;
        
        discrepancies.push({
          type: "overcoded",
          severity: "medium",
          predictedCpt: null,
          predictedUnits: null,
          predictedModifiers: null,
          actualCpt: actual.cptCode,
          actualUnits: actual.units,
          actualModifiers: actual.modifiers || [],
          revenueImpact: 0,
          description: `${actual.cptCode} billed but not found in documentation`,
          aiExplanation: "Could not find documentation support for this code - verify documentation",
          supportingText: "",
        });
      }
    }
  }

  // Sort discrepancies by severity and revenue impact
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  discrepancies.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.revenueImpact - a.revenueImpact;
  });

  return {
    matchedCount,
    missingCount,
    undercodedCount,
    overcodedCount,
    potentialRevenue: Math.round(potentialRevenue * 100) / 100,
    avgConfidence: predictions.length > 0 ? Math.round(totalConfidence / predictions.length) : 0,
    matchedCodes,
    discrepancies,
  };
}
