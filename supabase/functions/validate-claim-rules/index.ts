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
  description?: string;
}

interface ValidationInput {
  procedures: Procedure[];
  icd_codes: string[];
  payer?: string;
  place_of_service?: string;
  patient_name?: string;
  patient_id?: string;
}

interface Issue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  code?: string;
  code_pair?: string[];
  message: string;
  correction?: string;
  details?: any;
}

interface Correction {
  type: string;
  target_code: string;
  action: string;
  value?: any;
  reason: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: ValidationInput = await req.json();
    
    // Validate input
    if (!input.procedures || input.procedures.length === 0) {
      throw new Error("No procedures provided for validation");
    }

    // Initialize Supabase client with service role for database access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const issues: Issue[] = [];
    const corrections: Correction[] = [];
    const cptCodes = input.procedures.map(p => p.cpt_code);

    console.log(`Validating ${input.procedures.length} procedures against rules...`);

    // ========================================
    // CHECK 1: MUE EDITS (Unit Limits)
    // ========================================
    console.log("🔍 Checking MUE edits...");
    
    for (const proc of input.procedures) {
      const { data: mueData, error: mueError } = await supabaseClient
        .from('mue_edits')
        .select('*')
        .eq('cpt_code', proc.cpt_code)
        .is('end_date', null)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mueError) {
        console.error(`MUE lookup error for ${proc.cpt_code}:`, mueError);
        continue;
      }

      if (mueData) {
        // Determine limit based on place of service
        // 21/22 = Hospital, 11 = Office
        const isHospital = input.place_of_service === '21' || input.place_of_service === '22';
        const limit = isHospital ? mueData.facility_limit : mueData.practitioner_limit;

        if (limit && proc.units > limit) {
          issues.push({
            type: 'MUE_EXCEEDED',
            severity: 'critical',
            code: proc.cpt_code,
            message: `CPT ${proc.cpt_code}: Billed ${proc.units} units exceeds MUE limit of ${limit} unit(s) per day`,
            correction: `Reduce units to ${limit} or provide documentation justifying medical necessity for additional units`,
            details: {
              billed_units: proc.units,
              max_allowed: limit,
              setting: isHospital ? 'facility' : 'practitioner',
              rationale: mueData.rationale
            }
          });

          corrections.push({
            type: 'unit_reduction',
            target_code: proc.cpt_code,
            action: 'reduce_units',
            value: limit,
            reason: `MUE limit is ${limit} unit(s) per day`
          });
        }
      }
    }

    // ========================================
    // CHECK 2: NCCI PTP EDITS (Bundling)
    // ========================================
    console.log("🔍 Checking NCCI bundles...");
    
    // Check all code pairs for bundling issues
    for (let i = 0; i < cptCodes.length; i++) {
      for (let j = i + 1; j < cptCodes.length; j++) {
        const code1 = cptCodes[i];
        const code2 = cptCodes[j];

        // Check both directions (code1->code2 and code2->code1)
        const { data: ncciData, error: ncciError } = await supabaseClient
          .from('ncci_ptp_edits')
          .select('*')
          .or(`and(column_1_cpt.eq.${code1},column_2_cpt.eq.${code2}),and(column_1_cpt.eq.${code2},column_2_cpt.eq.${code1})`)
          .is('deletion_date', null)
          .limit(1)
          .maybeSingle();

        if (ncciError) {
          console.error(`NCCI lookup error for ${code1}/${code2}:`, ncciError);
          continue;
        }

        if (ncciData) {
          const proc1 = input.procedures.find(p => p.cpt_code === code1);
          const proc2 = input.procedures.find(p => p.cpt_code === code2);
          
          // Check if appropriate modifier is present
          const overrideModifiers = ['59', 'XE', 'XS', 'XP', 'XU'];
          const hasOverrideModifier = 
            proc1?.modifiers?.some(m => overrideModifiers.includes(m)) ||
            proc2?.modifiers?.some(m => overrideModifiers.includes(m));

          // modifier_indicator: 0 = never allowed, 1 = allowed with modifier
          const canOverride = ncciData.modifier_indicator === '1';
          
          if (ncciData.modifier_indicator === '0' || (canOverride && !hasOverrideModifier)) {
            const comprehensive = ncciData.column_1_cpt;
            const component = ncciData.column_2_cpt;
            
            const severity = ncciData.modifier_indicator === '0' ? 'critical' : 'high';
            
            issues.push({
              type: 'NCCI_BUNDLE',
              severity: severity,
              code_pair: [comprehensive, component],
              message: ncciData.modifier_indicator === '0'
                ? `NCCI Edit: ${component} is bundled into ${comprehensive} and cannot be billed separately (modifier not allowed)`
                : `NCCI Edit: ${component} bundles into ${comprehensive} - modifier 59/X{EPSU} required if truly distinct service`,
              correction: ncciData.modifier_indicator === '0'
                ? `Remove ${component} from claim - it is included in ${comprehensive}`
                : `Add modifier 59, XE, XS, XP, or XU to ${component} if it represents a distinct service, otherwise remove it`,
              details: {
                comprehensive_code: comprehensive,
                component_code: component,
                modifier_allowed: canOverride,
                modifier_present: hasOverrideModifier
              }
            });

            if (ncciData.modifier_indicator === '0') {
              corrections.push({
                type: 'remove_code',
                target_code: component,
                action: 'remove',
                reason: `Bundled into ${comprehensive} - no modifier override allowed`
              });
            } else if (!hasOverrideModifier) {
              corrections.push({
                type: 'add_modifier',
                target_code: component,
                action: 'add_modifier',
                value: '59',
                reason: `Required to unbundle from ${comprehensive}`
              });
            }
          }
        }
      }
    }

    // ========================================
    // CHECK 3: MODIFIER VALIDATION
    // ========================================
    console.log("🔍 Checking modifier requirements...");
    
    // Identify E/M codes and procedure codes
    const emCodes = input.procedures.filter(p => 
      p.cpt_code.match(/^99[2-4]\d{2}$/)
    );
    
    const procedureCodes = input.procedures.filter(p => 
      !p.cpt_code.match(/^99[2-4]\d{2}$/)
    );

    // Check: E/M with same-day procedure needs modifier 25
    if (emCodes.length > 0 && procedureCodes.length > 0) {
      for (const em of emCodes) {
        const hasModifier25 = em.modifiers?.includes('25');
        
        if (!hasModifier25) {
          issues.push({
            type: 'MISSING_MODIFIER_25',
            severity: 'high',
            code: em.cpt_code,
            message: `E/M code ${em.cpt_code} billed with same-day procedure(s) requires modifier 25`,
            correction: `Add modifier 25 to ${em.cpt_code} and ensure documentation supports a significant, separately identifiable E/M service`,
            details: {
              em_code: em.cpt_code,
              procedures_same_day: procedureCodes.map(p => p.cpt_code)
            }
          });

          corrections.push({
            type: 'add_modifier',
            target_code: em.cpt_code,
            action: 'add_modifier',
            value: '25',
            reason: 'E/M with same-day procedure requires modifier 25'
          });
        }
      }
    }

    // Check: TC and 26 cannot both be on same code
    for (const proc of input.procedures) {
      if (proc.modifiers?.includes('26') && proc.modifiers?.includes('TC')) {
        issues.push({
          type: 'INVALID_MODIFIER_COMBINATION',
          severity: 'critical',
          code: proc.cpt_code,
          message: `CPT ${proc.cpt_code}: Cannot bill both modifier 26 (professional) and TC (technical) on the same code`,
          correction: 'Remove one modifier - bill either professional component (26) OR technical component (TC), not both',
          details: {
            modifiers_present: proc.modifiers
          }
        });

        corrections.push({
          type: 'remove_modifier',
          target_code: proc.cpt_code,
          action: 'remove_modifier',
          value: 'TC',
          reason: 'Cannot have both 26 and TC on same code'
        });
      }
    }

    // Check: LT, RT, and 50 combinations
    for (const proc of input.procedures) {
      const hasLT = proc.modifiers?.includes('LT');
      const hasRT = proc.modifiers?.includes('RT');
      const has50 = proc.modifiers?.includes('50');

      if ((hasLT && hasRT) || (has50 && (hasLT || hasRT))) {
        issues.push({
          type: 'INVALID_BILATERAL_MODIFIERS',
          severity: 'high',
          code: proc.cpt_code,
          message: `CPT ${proc.cpt_code}: Invalid bilateral modifier combination (LT/RT/50)`,
          correction: 'Use modifier 50 for bilateral procedures OR LT/RT separately, not combinations',
          details: {
            modifiers_present: proc.modifiers
          }
        });
      }
    }

    // ========================================
    // CHECK 4: MEDICAL NECESSITY
    // ========================================
    console.log("🔍 Checking medical necessity...");
    
    if (input.icd_codes && input.icd_codes.length > 0) {
      for (const proc of input.procedures) {
        // Look up medical necessity mappings for this CPT
        const { data: necessityData, error: necessityError } = await supabaseClient
          .from('medical_necessity_matrix')
          .select('*')
          .eq('cpt_code', proc.cpt_code)
          .in('icd_code', input.icd_codes);

        if (necessityError) {
          console.error(`Necessity lookup error for ${proc.cpt_code}:`, necessityError);
          continue;
        }

        if (!necessityData || necessityData.length === 0) {
          // Check if we have ANY mappings for this CPT
          const { data: anyMapping } = await supabaseClient
            .from('medical_necessity_matrix')
            .select('icd_code, necessity_score')
            .eq('cpt_code', proc.cpt_code)
            .order('necessity_score', { ascending: false })
            .limit(5);

          if (anyMapping && anyMapping.length > 0) {
            const suggestedCodes = anyMapping.map(m => m.icd_code).join(', ');
            
            issues.push({
              type: 'MEDICAL_NECESSITY_NOT_MET',
              severity: 'medium',
              code: proc.cpt_code,
              message: `CPT ${proc.cpt_code}: Current diagnosis codes may not strongly support medical necessity`,
              correction: `Consider using diagnosis codes that better support this procedure: ${suggestedCodes}`,
              details: {
                current_icd_codes: input.icd_codes,
                suggested_icd_codes: anyMapping.map(m => ({ code: m.icd_code, score: m.necessity_score }))
              }
            });
          }
        } else {
          // Calculate average necessity score
          const avgScore = Math.round(
            necessityData.reduce((sum, n) => sum + (n.necessity_score || 0), 0) / necessityData.length
          );

          if (avgScore < 70) {
            issues.push({
              type: 'MEDICAL_NECESSITY_WEAK',
              severity: 'low',
              code: proc.cpt_code,
              message: `CPT ${proc.cpt_code}: Medical necessity support is moderate (${avgScore}% score)`,
              correction: 'Consider additional documentation or more specific diagnosis codes to strengthen medical necessity',
              details: {
                necessity_score: avgScore,
                supporting_codes: necessityData.map(n => ({ code: n.icd_code, score: n.necessity_score }))
              }
            });
          }
        }
      }
    }

    // ========================================
    // CHECK 5: PAYER-SPECIFIC RULES
    // ========================================
    if (input.payer) {
      console.log(`🔍 Checking payer rules for: ${input.payer}`);
      
      // Normalize payer name for matching
      const payerLower = input.payer.toLowerCase();
      
      const { data: payerRules, error: payerError } = await supabaseClient
        .from('payer_rules')
        .select('*')
        .eq('active', true);

      if (payerError) {
        console.error('Payer rules lookup error:', payerError);
      } else if (payerRules) {
        for (const rule of payerRules) {
          // Check if rule applies to this payer
          const rulePayer = rule.payer_name.toLowerCase();
          const appliesToPayer = 
            rulePayer === 'all payers' || 
            payerLower.includes(rulePayer) || 
            rulePayer.includes(payerLower);

          if (!appliesToPayer) continue;

          // Check if rule applies to any of our CPT codes
          if (rule.cpt_codes && rule.cpt_codes.length > 0) {
            const affectedCpts = cptCodes.filter(cpt => 
              rule.cpt_codes.includes(cpt)
            );

            if (affectedCpts.length > 0) {
              issues.push({
                type: `PAYER_${rule.rule_type.toUpperCase()}`,
                severity: rule.severity as any || 'medium',
                code: affectedCpts.join(', '),
                message: `${rule.payer_name}: ${rule.rule_description}`,
                correction: rule.action_required || 'Review payer guidelines',
                details: {
                  payer: rule.payer_name,
                  rule_type: rule.rule_type,
                  affected_codes: affectedCpts
                }
              });
            }
          }
        }
      }
    }

    // ========================================
    // CHECK 6: FREQUENCY LIMITS
    // ========================================
    if (input.patient_name) {
      console.log("🔍 Checking frequency limits...");
      
      for (const proc of input.procedures) {
        // Get frequency limits for this CPT
        const { data: freqLimits, error: freqError } = await supabaseClient
          .from('frequency_limits')
          .select('*')
          .eq('cpt_code', proc.cpt_code)
          .or(`payer.eq.all,payer.ilike.%${input.payer || ''}%`);

        if (freqError || !freqLimits || freqLimits.length === 0) continue;

        const limit = freqLimits[0];

        // Check patient's claim history for this CPT
        const { data: priorClaims, error: historyError } = await supabaseClient
          .from('claims')
          .select('id, created_at, procedure_codes')
          .eq('patient_name', input.patient_name)
          .order('created_at', { ascending: false })
          .limit(20);

        if (historyError || !priorClaims) continue;

        // Count occurrences within time periods
        const now = new Date();
        let countThisYear = 0;
        let lastServiceDate: Date | null = null;

        for (const claim of priorClaims) {
          const claimDate = new Date(claim.created_at);
          const procedureCodes = claim.procedure_codes || [];
          
          // Check if this CPT was in the claim
          const hasCpt = Array.isArray(procedureCodes) 
            ? procedureCodes.includes(proc.cpt_code)
            : procedureCodes === proc.cpt_code;

          if (hasCpt) {
            // Count for yearly limit
            const daysSince = Math.floor((now.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSince <= 365) {
              countThisYear++;
              if (!lastServiceDate || claimDate > lastServiceDate) {
                lastServiceDate = claimDate;
              }
            }
          }
        }

        // Check yearly limit
        if (limit.max_per_year && countThisYear >= limit.max_per_year) {
          issues.push({
            type: 'FREQUENCY_LIMIT_EXCEEDED',
            severity: 'high',
            code: proc.cpt_code,
            message: `CPT ${proc.cpt_code}: Patient has had this service ${countThisYear} time(s) in the past year. Limit is ${limit.max_per_year} per year.`,
            correction: `Document medical necessity for exceeding frequency limit, or consider if service is truly needed. ${limit.exception_note || ''}`,
            details: {
              cpt_code: proc.cpt_code,
              count_this_year: countThisYear,
              max_per_year: limit.max_per_year,
              last_service_date: lastServiceDate?.toISOString()
            }
          });

          corrections.push({
            type: 'frequency_warning',
            target_code: proc.cpt_code,
            action: 'document_necessity',
            reason: `Service frequency limit may be exceeded (${countThisYear}/${limit.max_per_year} per year)`
          });
        }

        // Check interval requirement
        if (limit.requires_interval_days && lastServiceDate) {
          const daysSinceLast = Math.floor((now.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLast < limit.requires_interval_days) {
            issues.push({
              type: 'FREQUENCY_INTERVAL_VIOLATION',
              severity: 'medium',
              code: proc.cpt_code,
              message: `CPT ${proc.cpt_code}: Last performed ${daysSinceLast} days ago. Recommended interval is ${limit.requires_interval_days} days.`,
              correction: `Document clinical change or new symptoms justifying repeat service. ${limit.exception_note || ''}`,
              details: {
                cpt_code: proc.cpt_code,
                days_since_last: daysSinceLast,
                required_interval: limit.requires_interval_days,
                last_service_date: lastServiceDate.toISOString()
              }
            });
          }
        }
      }
    }

    // ========================================
    // ENHANCED MULTI-FACTOR RISK SCORING
    // ========================================

    console.log("📊 Calculating multi-factor risk score...");

    // Factor 1: Issue Severity Score (40% weight)
    const severityWeights = {
      critical: 35,
      high: 20,
      medium: 8,
      low: 2
    };

    let severityScore = 0;
    const issueCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const issue of issues) {
      const severity = issue.severity as keyof typeof severityWeights;
      severityScore += severityWeights[severity] || 0;
      issueCounts[severity] = (issueCounts[severity] || 0) + 1;
    }

    // Cap severity score at 100
    severityScore = Math.min(severityScore, 100);

    // Factor 2: Payer Risk Multiplier (15% weight)
    const payerRiskMultipliers: Record<string, number> = {
      'medicare': 1.15,      // Medicare is strict
      'medicaid': 1.10,      // Medicaid varies by state
      'bcbs': 1.05,          // BCBS fairly standard
      'blue cross': 1.05,
      'united': 1.08,        // UHC can be strict
      'unitedhealthcare': 1.08,
      'uhc': 1.08,
      'aetna': 1.05,
      'cigna': 1.03,
      'humana': 1.05,
      'anthem': 1.05,
      'kaiser': 1.00,        // Kaiser integrated, less denials
      'tricare': 1.02,
      'default': 1.00
    };

    const payerLower = (input.payer || '').toLowerCase();
    let payerMultiplier = payerRiskMultipliers['default'];
    for (const [key, value] of Object.entries(payerRiskMultipliers)) {
      if (payerLower.includes(key)) {
        payerMultiplier = value;
        break;
      }
    }

    // Factor 3: Medical Necessity Strength (20% weight)
    let necessityScore = 100; // Start at 100, reduce based on weak necessity
    const necessityIssues = issues.filter(i => i.type === 'MEDICAL_NECESSITY' || i.type === 'MEDICAL_NECESSITY_NOT_MET' || i.type === 'MEDICAL_NECESSITY_WEAK');
    if (necessityIssues.length > 0) {
      // Find the lowest necessity score from issues
      for (const ni of necessityIssues) {
        if (ni.details?.necessity_score !== undefined) {
          necessityScore = Math.min(necessityScore, ni.details.necessity_score);
        }
      }
      // Invert: low necessity = high risk
      necessityScore = 100 - necessityScore;
    } else {
      necessityScore = 0; // No necessity issues = no risk from this factor
    }

    // Factor 4: Code Complexity Risk (10% weight)
    let complexityScore = 0;
    const procedureCount = input.procedures?.length || 0;
    const modifierCount = input.procedures?.reduce((sum, p) => sum + (p.modifiers?.length || 0), 0) || 0;

    // More procedures = more complexity = more risk
    if (procedureCount > 5) complexityScore += 20;
    else if (procedureCount > 3) complexityScore += 10;
    else if (procedureCount > 1) complexityScore += 5;

    // Multiple modifiers increase complexity
    if (modifierCount > 4) complexityScore += 20;
    else if (modifierCount > 2) complexityScore += 10;

    // High-value procedures are scrutinized more
    const highValueCpts = ['93306', '93350', '93458', '93459', '93460', '70553', '72148', '74177', '43239', '45378'];
    for (const proc of input.procedures || []) {
      if (highValueCpts.includes(proc.cpt_code)) {
        complexityScore += 5;
      }
    }

    complexityScore = Math.min(complexityScore, 100);

    // Factor 5: ICD Specificity (10% weight)
    let icdSpecificityScore = 0;
    const icdCodes = input.icd_codes || [];

    for (const icd of icdCodes) {
      // Unspecified codes (ending in .9 or containing "unspecified") are riskier
      if (icd.endsWith('9') || icd.endsWith('.9')) {
        icdSpecificityScore += 15;
      }
      // R codes (symptoms) are less specific than definitive diagnoses
      if (icd.startsWith('R')) {
        icdSpecificityScore += 10;
      }
      // Z codes (encounters/screening) may not support medical necessity
      if (icd.startsWith('Z') && !['Z12', 'Z13', 'Z23', 'Z51'].some(z => icd.startsWith(z))) {
        icdSpecificityScore += 20;
      }
    }

    icdSpecificityScore = Math.min(icdSpecificityScore, 100);

    // Factor 6: Frequency/History Risk (5% weight)
    let frequencyScore = 0;
    const frequencyIssues = issues.filter(i => 
      i.type === 'FREQUENCY_LIMIT_EXCEEDED' || i.type === 'FREQUENCY_INTERVAL_VIOLATION'
    );
    if (frequencyIssues.length > 0) {
      frequencyScore = 50 + (frequencyIssues.length * 25);
    }
    frequencyScore = Math.min(frequencyScore, 100);

    // ========================================
    // CALCULATE FINAL WEIGHTED SCORE
    // ========================================

    const weights = {
      severity: 0.40,
      payer: 0.15,
      necessity: 0.20,
      complexity: 0.10,
      icdSpecificity: 0.10,
      frequency: 0.05
    };

    // Base score from weighted factors
    let baseScore = (
      (severityScore * weights.severity) +
      (necessityScore * weights.necessity) +
      (complexityScore * weights.complexity) +
      (icdSpecificityScore * weights.icdSpecificity) +
      (frequencyScore * weights.frequency)
    );

    // Apply payer multiplier
    let finalScore = baseScore * payerMultiplier;

    // Ensure critical issues always result in high risk
    if (issueCounts.critical > 0) {
      finalScore = Math.max(finalScore, 70);
    }

    // Cap at 100
    finalScore = Math.min(Math.round(finalScore), 100);

    // Determine risk level
    let riskLevel: string;
    if (finalScore >= 70) {
      riskLevel = 'critical';
    } else if (finalScore >= 50) {
      riskLevel = 'high';
    } else if (finalScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    console.log("📊 Risk Score Breakdown:", {
      severityScore,
      payerMultiplier,
      necessityScore,
      complexityScore,
      icdSpecificityScore,
      frequencyScore,
      baseScore,
      finalScore,
      riskLevel
    });

    // ========================================
    // BUILD RESPONSE
    // ========================================

    const response = {
      success: true,
      denial_risk_score: finalScore,
      risk_level: riskLevel,
      
      // Issue counts
      critical_count: issueCounts.critical,
      high_count: issueCounts.high,
      medium_count: issueCounts.medium,
      low_count: issueCounts.low,
      total_issues: issues.length,
      
      // Categorized issues
      mue_issues: issues.filter(i => i.type === 'MUE_EXCEEDED'),
      ncci_issues: issues.filter(i => i.type === 'NCCI_BUNDLE' || i.type === 'NCCI_BUNDLE_VIOLATION'),
      modifier_issues: issues.filter(i => i.type?.includes('MODIFIER')),
      necessity_issues: issues.filter(i => i.type === 'MEDICAL_NECESSITY' || i.type?.includes('NECESSITY')),
      payer_issues: issues.filter(i => i.type?.includes('PAYER') || i.type?.includes('LCD') || i.type?.includes('NCD')),
      frequency_issues: issues.filter(i => i.type?.includes('FREQUENCY')),
      
      // All issues for display
      all_issues: issues,
      
      // Corrections
      corrections: corrections,
      
      // Risk breakdown for transparency
      risk_breakdown: {
        severity_score: severityScore,
        severity_weight: weights.severity,
        payer_multiplier: payerMultiplier,
        necessity_score: necessityScore,
        necessity_weight: weights.necessity,
        complexity_score: complexityScore,
        complexity_weight: weights.complexity,
        icd_specificity_score: icdSpecificityScore,
        icd_specificity_weight: weights.icdSpecificity,
        frequency_score: frequencyScore,
        frequency_weight: weights.frequency
      },
      
      // Summary
      summary: {
        total_issues: issues.length,
        critical: issueCounts.critical,
        high: issueCounts.high,
        medium: issueCounts.medium,
        low: issueCounts.low,
        corrections_available: corrections.length,
        checks_performed: [
          'MUE Edits (Unit Limits)',
          'NCCI PTP Edits (Bundling)',
          'Modifier Validation',
          'Medical Necessity',
          'Payer-Specific Rules',
          'Frequency Limits'
        ]
      },
      
      input_summary: {
        procedures_checked: input.procedures.length,
        diagnoses_checked: input.icd_codes?.length || 0,
        payer: input.payer || 'Not specified'
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Validation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown validation error",
        denial_risk_score: 0,
        risk_level: 'unknown',
        issues: [],
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
