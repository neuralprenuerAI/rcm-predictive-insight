import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES AND INTERFACES
// ============================================

interface RuleCondition {
  field: string;
  operator: string;
  value: any;
}

interface RuleConditions {
  logic: 'and' | 'or';
  rules: RuleCondition[];
}

interface RuleAction {
  type: 'flag' | 'reject' | 'alert' | 'modify' | 'log' | 'notify';
  params: Record<string, any>;
}

interface Rule {
  id: string;
  rule_name: string;
  rule_code: string;
  rule_type: string;
  category: string;
  description: string;
  conditions: RuleConditions;
  actions: RuleAction[];
  priority: number;
  is_active: boolean;
  is_system: boolean;
  stop_on_match: boolean;
  trigger_event: string;
  applies_to: string[];
  payer_ids: string[] | null;
  provider_npis: string[] | null;
  place_of_service: string[] | null;
  effective_date: string | null;
  expiration_date: string | null;
}

interface EvaluationContext {
  // Claim data
  claim_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_dob?: string;
  date_of_service?: string;
  procedure_code?: string;
  procedure_codes?: string[];
  diagnosis_code?: string;
  diagnosis_codes?: string[];
  modifier?: string;
  modifiers?: string[];
  billed_amount?: number;
  paid_amount?: number;
  allowed_amount?: number;
  provider_npi?: string;
  provider_name?: string;
  payer_id?: string;
  payer_name?: string;
  place_of_service?: string;
  
  // Document data
  document_type?: string;
  document_id?: string;
  
  // Payment data
  check_number?: string;
  check_date?: string;
  adjustment_codes?: string[];
  
  // Custom fields
  [key: string]: any;
}

interface ConditionResult {
  field: string;
  operator: string;
  expected: any;
  actual: any;
  passed: boolean;
}

interface RuleResult {
  rule_id: string;
  rule_name: string;
  rule_code: string;
  rule_type: string;
  passed: boolean;
  conditions_evaluated: ConditionResult[];
  actions_to_execute: RuleAction[];
  message: string;
}

interface ExecutionResult {
  success: boolean;
  target_type: string;
  target_id: string | null;
  rules_evaluated: number;
  rules_passed: number;
  rules_failed: number;
  results: RuleResult[];
  flags: Array<{ severity: string; message: string; code: string }>;
  rejections: Array<{ reason: string; rule_code: string }>;
  alerts: Array<{ message: string; rule_code: string }>;
  overall_status: 'pass' | 'warning' | 'reject';
}

// ============================================
// CONDITION OPERATORS
// ============================================

function evaluateCondition(context: EvaluationContext, condition: RuleCondition): ConditionResult {
  const { field, operator, value } = condition;
  
  // Get the actual value from context (supports nested fields like "patient.dob")
  const fieldParts = field.split('.');
  let actual: any = context;
  for (const part of fieldParts) {
    actual = actual?.[part];
  }
  
  let passed = false;
  
  switch (operator) {
    case 'equals':
    case 'eq':
    case '==':
      passed = actual === value;
      break;
      
    case 'not_equals':
    case 'neq':
    case '!=':
      passed = actual !== value;
      break;
      
    case 'greater_than':
    case 'gt':
    case '>':
      passed = Number(actual) > Number(value);
      break;
      
    case 'greater_than_or_equals':
    case 'gte':
    case '>=':
      passed = Number(actual) >= Number(value);
      break;
      
    case 'less_than':
    case 'lt':
    case '<':
      passed = Number(actual) < Number(value);
      break;
      
    case 'less_than_or_equals':
    case 'lte':
    case '<=':
      passed = Number(actual) <= Number(value);
      break;
      
    case 'contains':
      if (Array.isArray(actual)) {
        passed = actual.includes(value);
      } else if (typeof actual === 'string') {
        passed = actual.toLowerCase().includes(String(value).toLowerCase());
      }
      break;
      
    case 'not_contains':
      if (Array.isArray(actual)) {
        passed = !actual.includes(value);
      } else if (typeof actual === 'string') {
        passed = !actual.toLowerCase().includes(String(value).toLowerCase());
      }
      break;
      
    case 'in':
    case 'in_list':
      if (Array.isArray(value)) {
        passed = value.includes(actual);
      }
      break;
      
    case 'not_in':
    case 'not_in_list':
      if (Array.isArray(value)) {
        passed = !value.includes(actual);
      }
      break;
      
    case 'starts_with':
      passed = String(actual || '').toLowerCase().startsWith(String(value).toLowerCase());
      break;
      
    case 'ends_with':
      passed = String(actual || '').toLowerCase().endsWith(String(value).toLowerCase());
      break;
      
    case 'regex':
    case 'matches':
      try {
        const regex = new RegExp(value, 'i');
        passed = regex.test(String(actual || ''));
      } catch {
        passed = false;
      }
      break;
      
    case 'is_empty':
      passed = actual === null || actual === undefined || actual === '' || 
               (Array.isArray(actual) && actual.length === 0);
      break;
      
    case 'is_not_empty':
      passed = actual !== null && actual !== undefined && actual !== '' &&
               !(Array.isArray(actual) && actual.length === 0);
      break;
      
    case 'is_null':
      passed = actual === null || actual === undefined;
      break;
      
    case 'is_not_null':
      passed = actual !== null && actual !== undefined;
      break;
      
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        const num = Number(actual);
        passed = num >= Number(value[0]) && num <= Number(value[1]);
      }
      break;
      
    case 'older_than_days':
      if (actual) {
        const date = new Date(actual);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        passed = diffDays > Number(value);
      }
      break;
      
    case 'newer_than_days':
      if (actual) {
        const date = new Date(actual);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        passed = diffDays < Number(value);
      }
      break;
      
    case 'age_greater_than':
      if (actual) {
        const dob = new Date(actual);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        passed = age > Number(value);
      }
      break;
      
    case 'age_less_than':
      if (actual) {
        const dob = new Date(actual);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        passed = age < Number(value);
      }
      break;
      
    default:
      console.warn(`Unknown operator: ${operator}`);
      passed = false;
  }
  
  return {
    field,
    operator,
    expected: value,
    actual,
    passed,
  };
}

function evaluateConditions(context: EvaluationContext, conditions: RuleConditions): { passed: boolean; results: ConditionResult[] } {
  const results: ConditionResult[] = [];
  
  if (!conditions.rules || conditions.rules.length === 0) {
    return { passed: true, results: [] };
  }
  
  for (const condition of conditions.rules) {
    const result = evaluateCondition(context, condition);
    results.push(result);
  }
  
  let passed: boolean;
  if (conditions.logic === 'or') {
    passed = results.some(r => r.passed);
  } else {
    // Default to 'and'
    passed = results.every(r => r.passed);
  }
  
  return { passed, results };
}

// ============================================
// RULE FILTERING
// ============================================

function ruleApplies(rule: Rule, context: EvaluationContext, triggerEvent: string): boolean {
  // Check trigger event
  if (rule.trigger_event && rule.trigger_event !== triggerEvent && rule.trigger_event !== 'manual') {
    return false;
  }
  
  // Check effective date
  if (rule.effective_date) {
    const effectiveDate = new Date(rule.effective_date);
    if (new Date() < effectiveDate) {
      return false;
    }
  }
  
  // Check expiration date
  if (rule.expiration_date) {
    const expirationDate = new Date(rule.expiration_date);
    if (new Date() > expirationDate) {
      return false;
    }
  }
  
  // Check payer filter
  if (rule.payer_ids && rule.payer_ids.length > 0) {
    if (!context.payer_id || !rule.payer_ids.includes(context.payer_id)) {
      return false;
    }
  }
  
  // Check provider filter
  if (rule.provider_npis && rule.provider_npis.length > 0) {
    if (!context.provider_npi || !rule.provider_npis.includes(context.provider_npi)) {
      return false;
    }
  }
  
  // Check place of service filter
  if (rule.place_of_service && rule.place_of_service.length > 0) {
    if (!context.place_of_service || !rule.place_of_service.includes(context.place_of_service)) {
      return false;
    }
  }
  
  return true;
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
      context,              // The data to evaluate (claim, document, etc.)
      triggerEvent = 'manual', // What triggered this: claim_created, payment_received, etc.
      targetType = 'claims',   // What type of data: claims, payments, documents
      targetId = null,         // Optional ID of the target record
      ruleIds = null,          // Optional: specific rule IDs to run (null = all applicable)
      ruleTypes = null,        // Optional: filter by rule types
      saveExecution = true,    // Whether to save execution history
      batchId = null,          // Optional: batch ID for grouping executions
    } = await req.json();

    if (!context) {
      throw new Error("Missing required field: context");
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

    console.log(`Executing rules for ${targetType}, trigger: ${triggerEvent}`);
    const startTime = Date.now();

    // Fetch applicable rules
    let rulesQuery = supabaseClient
      .from('rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // Filter by user's rules + system rules
    rulesQuery = rulesQuery.or(`user_id.eq.${user.id},is_system.eq.true,user_id.is.null`);

    // Filter by specific rule IDs if provided
    if (ruleIds && Array.isArray(ruleIds) && ruleIds.length > 0) {
      rulesQuery = rulesQuery.in('id', ruleIds);
    }

    // Filter by rule types if provided
    if (ruleTypes && Array.isArray(ruleTypes) && ruleTypes.length > 0) {
      rulesQuery = rulesQuery.in('rule_type', ruleTypes);
    }

    // Filter by applies_to
    rulesQuery = rulesQuery.contains('applies_to', [targetType]);

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      throw new Error(`Error fetching rules: ${rulesError.message}`);
    }

    console.log(`Found ${rules?.length || 0} applicable rules`);

    // Execute rules
    const results: RuleResult[] = [];
    const flags: Array<{ severity: string; message: string; code: string }> = [];
    const rejections: Array<{ reason: string; rule_code: string }> = [];
    const alerts: Array<{ message: string; rule_code: string }> = [];
    let shouldStop = false;

    for (const rule of (rules || [])) {
      if (shouldStop) break;

      // Check if rule applies to this context
      if (!ruleApplies(rule, context, triggerEvent)) {
        continue;
      }

      // Evaluate conditions
      const { passed, results: conditionResults } = evaluateConditions(
        context,
        rule.conditions as RuleConditions
      );

      const ruleResult: RuleResult = {
        rule_id: rule.id,
        rule_name: rule.rule_name,
        rule_code: rule.rule_code || '',
        rule_type: rule.rule_type,
        passed: !passed, // Rule "passes" if conditions match (i.e., issue found)
        conditions_evaluated: conditionResults,
        actions_to_execute: passed ? (rule.actions as RuleAction[]) : [],
        message: '',
      };

      // If conditions matched, execute actions
      if (passed) {
        const actions = rule.actions as RuleAction[];
        
        for (const action of actions) {
          switch (action.type) {
            case 'flag':
              flags.push({
                severity: action.params?.severity || 'warning',
                message: action.params?.message || rule.description || rule.rule_name,
                code: action.params?.code || rule.rule_code || '',
              });
              ruleResult.message = action.params?.message || '';
              break;
              
            case 'reject':
              rejections.push({
                reason: action.params?.reason || rule.description || rule.rule_name,
                rule_code: rule.rule_code || '',
              });
              ruleResult.message = action.params?.reason || '';
              break;
              
            case 'alert':
              alerts.push({
                message: action.params?.message || rule.description || rule.rule_name,
                rule_code: rule.rule_code || '',
              });
              ruleResult.message = action.params?.message || '';
              break;
              
            case 'log':
              console.log(`[RULE ${rule.rule_code}] ${action.params?.message || rule.rule_name}`);
              break;
              
            case 'modify':
              // Future: Implement field modification
              console.log(`[RULE ${rule.rule_code}] Modify action not implemented`);
              break;
              
            case 'notify':
              // Future: Implement notifications
              console.log(`[RULE ${rule.rule_code}] Notify action not implemented`);
              break;
          }
        }

        // Check if we should stop processing more rules
        if (rule.stop_on_match) {
          shouldStop = true;
        }
      }

      results.push(ruleResult);

      // Save execution record if requested
      if (saveExecution) {
        const executionResult = passed ? 'fail' : 'pass';
        
        const { data: execution, error: execError } = await supabaseClient
          .from('rule_executions')
          .insert({
            user_id: user.id,
            rule_id: rule.id,
            trigger_event: triggerEvent,
            batch_id: batchId,
            target_type: targetType,
            target_id: targetId,
            input_data: context,
            conditions_evaluated: conditionResults,
            execution_result: executionResult,
            result_message: ruleResult.message,
            actions_executed: passed ? rule.actions : [],
            execution_duration_ms: Date.now() - startTime,
          })
          .select('id')
          .single();

        if (execError) {
          console.error('Error saving execution:', execError);
        } else if (execution && passed) {
          // Log individual actions
          const actions = rule.actions as RuleAction[];
          for (const action of actions) {
            await supabaseClient
              .from('rule_action_logs')
              .insert({
                execution_id: execution.id,
                action_type: action.type,
                action_params: action.params,
                action_result: 'executed',
                message: action.params?.message || action.params?.reason || '',
              });
          }
        }
      }
    }

    const processingTime = Date.now() - startTime;
    
    // Determine overall status
    let overallStatus: 'pass' | 'warning' | 'reject' = 'pass';
    if (rejections.length > 0) {
      overallStatus = 'reject';
    } else if (flags.length > 0) {
      overallStatus = 'warning';
    }

    const executionResult: ExecutionResult = {
      success: true,
      target_type: targetType,
      target_id: targetId,
      rules_evaluated: results.length,
      rules_passed: results.filter(r => !r.passed).length,
      rules_failed: results.filter(r => r.passed).length,
      results,
      flags,
      rejections,
      alerts,
      overall_status: overallStatus,
    };

    console.log(`Rules executed: ${results.length}, Status: ${overallStatus}, Time: ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        ...executionResult,
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in execute-rules:", error);
    
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
