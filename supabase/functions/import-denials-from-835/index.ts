import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportOptions {
  remittanceId?: string;
  remittanceData?: any;
  autoClassify?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

interface DenialRecord {
  patientName: string;
  patientId?: string;
  claimId?: string;
  serviceDate: string;
  denialDate: string;
  payerName: string;
  payerId?: string;
  reasonCode: string;
  reasonDescription: string;
  remarkCodes: string[];
  adjustmentReasonCode: string;
  billedAmount: number;
  allowedAmount: number;
  deniedAmount: number;
  cptCode: string;
  cptDescription?: string;
  icdCodes: string[];
  modifiers: string[];
  claimNumber?: string;
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

    const input: ImportOptions = await req.json();
    console.log("Importing denials from 835 data");

    let remittanceData = input.remittanceData;

    // If remittanceId provided, fetch from database
    if (input.remittanceId && !remittanceData) {
      const { data: remittance, error } = await supabaseClient
        .from("remittances")
        .select("*")
        .eq("id", input.remittanceId)
        .single();

      if (error || !remittance) {
        throw new Error("Remittance not found");
      }

      remittanceData = remittance.parsed_data || remittance;
    }

    if (!remittanceData) {
      throw new Error("No remittance data provided");
    }

    // Extract denials from 835 data
    const denials = extractDenialsFrom835(remittanceData);
    console.log(`Found ${denials.length} denials in 835 data`);

    if (denials.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No denials found in remittance data",
          imported: 0,
          skipped: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      denialIds: [] as string[],
    };

    // Process each denial
    for (const denial of denials) {
      try {
        // Check for duplicates
        const { data: existing } = await supabaseClient
          .from("denial_queue")
          .select("id")
          .eq("user_id", user.id)
          .eq("payer_name", denial.payerName)
          .eq("reason_code", denial.reasonCode)
          .eq("cpt_code", denial.cptCode)
          .eq("service_date", denial.serviceDate)
          .eq("denied_amount", denial.deniedAmount)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log("Skipping duplicate denial:", denial.reasonCode, denial.cptCode);
          results.skipped++;
          continue;
        }

        // Try to match to existing patient
        let patientId = denial.patientId;
        if (!patientId && denial.patientName) {
          const nameParts = denial.patientName.split(/[,\s]+/);
          if (nameParts.length >= 2) {
            const { data: patient } = await supabaseClient
              .from("patients")
              .select("id")
              .or(`last_name.ilike.%${nameParts[0]}%,first_name.ilike.%${nameParts[1]}%`)
              .limit(1);
            
            if (patient && patient.length > 0) {
              patientId = patient[0].id;
            }
          }
        }

        // Try to match to existing claim
        let claimId = denial.claimId;
        if (!claimId && denial.claimNumber) {
          const { data: claim } = await supabaseClient
            .from("claims")
            .select("id")
            .eq("claim_number", denial.claimNumber)
            .limit(1);
          
          if (claim && claim.length > 0) {
            claimId = claim[0].id;
          }
        }

        // Create or classify the denial
        if (input.autoClassify !== false) {
          // Use classify-denial function
          const classifyResponse = await supabaseClient.functions.invoke("classify-denial", {
            body: {
              claimId,
              patientId,
              denialDate: denial.denialDate,
              serviceDate: denial.serviceDate,
              payerName: denial.payerName,
              payerId: denial.payerId,
              reasonCode: denial.reasonCode,
              reasonDescription: denial.reasonDescription,
              remarkCodes: denial.remarkCodes,
              adjustmentReasonCode: denial.adjustmentReasonCode,
              billedAmount: denial.billedAmount,
              allowedAmount: denial.allowedAmount,
              deniedAmount: denial.deniedAmount,
              cptCode: denial.cptCode,
              cptDescription: denial.cptDescription,
              icdCodes: denial.icdCodes,
              modifiers: denial.modifiers,
              remittanceId: input.remittanceId,
            },
          });

          if (classifyResponse.error) {
            console.error("Classification error:", classifyResponse.error);
            results.errors.push(`Failed to classify denial: ${denial.reasonCode}`);
            continue;
          }

          results.denialIds.push(classifyResponse.data.denialId);
        } else {
          // Direct insert without classification
          const { data: denialEntry, error: insertError } = await supabaseClient
            .from("denial_queue")
            .insert({
              user_id: user.id,
              claim_id: claimId || null,
              patient_id: patientId || null,
              remittance_id: input.remittanceId || null,
              denial_date: denial.denialDate,
              service_date: denial.serviceDate,
              payer_name: denial.payerName,
              payer_id: denial.payerId,
              reason_code: denial.reasonCode,
              reason_description: denial.reasonDescription,
              remark_codes: denial.remarkCodes,
              adjustment_reason_code: denial.adjustmentReasonCode,
              billed_amount: denial.billedAmount,
              allowed_amount: denial.allowedAmount,
              denied_amount: denial.deniedAmount,
              cpt_code: denial.cptCode,
              cpt_description: denial.cptDescription,
              icd_codes: denial.icdCodes,
              modifiers: denial.modifiers,
              status: "new",
              priority: denial.deniedAmount >= 500 ? "high" : "medium",
            })
            .select()
            .single();

          if (insertError) {
            console.error("Insert error:", insertError);
            results.errors.push(`Failed to insert denial: ${denial.reasonCode}`);
            continue;
          }

          results.denialIds.push(denialEntry.id);
        }

        results.imported++;
      } catch (error) {
        console.error("Error processing denial:", error);
        results.errors.push(`Error: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${results.imported} denials, skipped ${results.skipped} duplicates`,
        imported: results.imported,
        skipped: results.skipped,
        denialIds: results.denialIds,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in import-denials-from-835:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDenialsFrom835(data: any): DenialRecord[] {
  const denials: DenialRecord[] = [];
  
  // Handle different 835 data structures
  const claims = data.claims || data.claimPayments || data.serviceLines || [];
  const payerName = data.payerName || data.payer?.name || data.payerIdentification?.name || "Unknown Payer";
  const payerId = data.payerId || data.payer?.id || data.payerIdentification?.id;
  const checkDate = data.checkDate || data.paymentDate || data.productionDate || new Date().toISOString().split("T")[0];

  for (const claim of claims) {
    // Get service lines from claim
    const serviceLines = claim.serviceLines || claim.services || claim.lineItems || [claim];
    
    for (const service of serviceLines) {
      // Check for denials - look for adjustment reason codes
      const adjustments = service.adjustments || service.adjustmentDetails || [];
      const reasonCodes = service.adjustmentReasonCodes || [];
      const remarkCodes = service.remarkCodes || service.healthCareRemarkCodes || [];
      
      // Calculate denied amount
      const billedAmount = parseFloat(service.chargeAmount || service.billedAmount || service.lineItemChargeAmount || 0);
      const paidAmount = parseFloat(service.paidAmount || service.paymentAmount || service.lineItemProviderPayment || 0);
      const allowedAmount = parseFloat(service.allowedAmount || service.allowedUnits || billedAmount);
      
      // Check adjustments for denial indicators
      let deniedAmount = 0;
      let denialReasonCode = "";
      let denialReasonDesc = "";
      let adjustmentReasonCode = "";

      for (const adj of adjustments) {
        const groupCode = adj.groupCode || adj.adjustmentGroupCode || "";
        const reasonCode = adj.reasonCode || adj.adjustmentReasonCode || "";
        const amount = parseFloat(adj.amount || adj.adjustmentAmount || 0);

        // CO (Contractual Obligation), PR (Patient Responsibility), OA (Other Adjustment)
        // Denials typically have CO or OA with specific reason codes
        if ((groupCode === "CO" || groupCode === "OA" || groupCode === "CR") && amount > 0) {
          // Check if this is a denial vs. a contractual adjustment
          const denialCodes = ["4", "5", "6", "9", "11", "15", "16", "18", "27", "29", "31", "50", "55", "56", "96", "97", "149", "151", "167", "197", "198"];
          
          if (denialCodes.some(dc => reasonCode.includes(dc))) {
            deniedAmount += amount;
            if (!denialReasonCode) {
              denialReasonCode = `${groupCode}-${reasonCode}`;
              adjustmentReasonCode = reasonCode;
            }
          }
        }
      }

      // Also check for standalone reason codes
      for (const rc of reasonCodes) {
        const code = rc.code || rc;
        if (!denialReasonCode && code) {
          denialReasonCode = code;
        }
      }

      // If no adjustments array, check for direct denial indicators
      if (!denialReasonCode && (service.claimStatus === "denied" || service.status === "D" || paidAmount === 0 && billedAmount > 0)) {
        deniedAmount = billedAmount - paidAmount;
        denialReasonCode = service.reasonCode || service.denialReasonCode || "UNKNOWN";
      }

      // Skip if not a denial
      if (deniedAmount <= 0 && paidAmount > 0) {
        continue;
      }

      // If still no denied amount but looks like a denial, calculate it
      if (deniedAmount === 0 && paidAmount < billedAmount) {
        deniedAmount = billedAmount - paidAmount;
      }

      // Only include if there's actually a denied amount
      if (deniedAmount <= 0) {
        continue;
      }

      // Get reason description
      denialReasonDesc = service.adjustmentReasonDescription || 
                         getReasonDescription(denialReasonCode) ||
                         "Claim denied or adjusted";

      denials.push({
        patientName: claim.patientName || claim.subscriberName || service.patientName || "Unknown",
        patientId: claim.patientId || service.patientId,
        claimId: claim.claimId || service.claimId,
        serviceDate: service.serviceDate || service.dateOfService || claim.serviceDate || checkDate,
        denialDate: checkDate,
        payerName,
        payerId,
        reasonCode: denialReasonCode,
        reasonDescription: denialReasonDesc,
        remarkCodes: remarkCodes.map((r: any) => r.code || r).filter(Boolean),
        adjustmentReasonCode,
        billedAmount,
        allowedAmount,
        deniedAmount,
        cptCode: service.procedureCode || service.cptCode || service.hcpcsCode || "",
        cptDescription: service.procedureDescription || service.description || "",
        icdCodes: service.diagnosisCodes || service.icdCodes || claim.diagnosisCodes || [],
        modifiers: service.modifiers || service.procedureModifiers || [],
        claimNumber: claim.claimNumber || claim.patientControlNumber || service.claimNumber,
      });
    }
  }

  return denials;
}

function getReasonDescription(code: string): string {
  const descriptions: Record<string, string> = {
    "CO-4": "Procedure code inconsistent with modifier",
    "CO-5": "Procedure code inconsistent with place of service",
    "CO-6": "Procedure code inconsistent with diagnosis",
    "CO-9": "Diagnosis inconsistent with patient age",
    "CO-11": "Diagnosis inconsistent with procedure",
    "CO-15": "Authorization was not obtained",
    "CO-16": "Claim lacks information needed for adjudication",
    "CO-18": "Duplicate claim/service",
    "CO-27": "Expenses incurred after coverage terminated",
    "CO-29": "Time limit for filing has expired",
    "CO-31": "Patient cannot be identified as insured",
    "CO-45": "Charges exceed fee schedule maximum",
    "CO-50": "Not deemed medically necessary",
    "CO-55": "Procedure requires prior authorization",
    "CO-56": "Service not medically necessary based on diagnosis",
    "CO-96": "Non-covered charge(s)",
    "CO-97": "Payment adjusted based on multiple procedure rules",
    "CO-149": "Provider not credentialed",
    "CO-151": "Payment adjusted based on NCCI edits",
    "CO-167": "Diagnosis not consistent with procedure",
    "CO-197": "Precertification/authorization absent",
    "CO-198": "Precertification/authorization exceeded",
  };

  return descriptions[code] || descriptions[code.replace("CO-", "").replace("OA-", "")] || "";
}
