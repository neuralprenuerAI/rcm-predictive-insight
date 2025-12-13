import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Document type definitions with descriptions and indicators
const DOCUMENT_TYPES = {
  // EDI Documents
  edi_835: {
    name: "835 Electronic Remittance Advice",
    description: "Electronic payment/remittance from payer",
    category: "edi",
    indicators: ["ISA*", "GS*RA", "ST*835", "BPR*", "TRN*", "CLP*", "SVC*", "CAS*"],
  },
  edi_837p: {
    name: "837P Professional Claim",
    description: "Electronic professional claim submission",
    category: "edi",
    indicators: ["ISA*", "GS*HC", "ST*837", "CLM*", "SV1*", "2300", "2400"],
  },
  edi_837i: {
    name: "837I Institutional Claim",
    description: "Electronic institutional/facility claim",
    category: "edi",
    indicators: ["ISA*", "GS*HC", "ST*837", "CLM*", "SV2*", "UB-04"],
  },
  edi_837d: {
    name: "837D Dental Claim",
    description: "Electronic dental claim submission",
    category: "edi",
    indicators: ["ISA*", "GS*HC", "ST*837", "CLM*", "dental", "ADA"],
  },
  edi_270: {
    name: "270 Eligibility Inquiry",
    description: "Electronic eligibility verification request",
    category: "edi",
    indicators: ["ISA*", "ST*270", "eligibility", "inquiry"],
  },
  edi_271: {
    name: "271 Eligibility Response",
    description: "Electronic eligibility verification response",
    category: "edi",
    indicators: ["ISA*", "ST*271", "eligibility", "response", "benefit"],
  },
  edi_276: {
    name: "276 Claim Status Inquiry",
    description: "Electronic claim status request",
    category: "edi",
    indicators: ["ISA*", "ST*276", "claim status", "inquiry"],
  },
  edi_277: {
    name: "277 Claim Status Response",
    description: "Electronic claim status response",
    category: "edi",
    indicators: ["ISA*", "ST*277", "claim status", "response"],
  },
  
  // Paper/Scanned Documents
  eob: {
    name: "Explanation of Benefits (EOB)",
    description: "Paper explanation of benefits from payer",
    category: "payer_document",
    indicators: ["explanation of benefits", "EOB", "this is not a bill", "claim number", "amount billed", "amount allowed", "patient responsibility", "deductible", "coinsurance", "copay"],
  },
  era: {
    name: "Electronic Remittance Advice (Paper)",
    description: "Printed/PDF remittance advice",
    category: "payer_document",
    indicators: ["remittance advice", "payment summary", "check number", "EFT", "claim payment", "provider payment"],
  },
  denial_letter: {
    name: "Denial Letter",
    description: "Claim denial notification from payer",
    category: "payer_document",
    indicators: ["denied", "denial", "not covered", "not medically necessary", "authorization required", "timely filing", "appeal rights"],
  },
  
  // Claim Forms
  cms_1500: {
    name: "CMS-1500 Claim Form",
    description: "Professional paper claim form",
    category: "claim_form",
    indicators: ["CMS-1500", "HCFA-1500", "health insurance claim form", "1500", "physician", "supplier", "place of service"],
  },
  ub_04: {
    name: "UB-04 Claim Form",
    description: "Institutional paper claim form",
    category: "claim_form",
    indicators: ["UB-04", "CMS-1450", "uniform bill", "revenue code", "occurrence code", "condition code", "value code"],
  },
  ada_claim: {
    name: "ADA Dental Claim Form",
    description: "Dental paper claim form",
    category: "claim_form",
    indicators: ["ADA", "dental claim", "tooth number", "oral cavity", "dental"],
  },
  
  // Patient Documents
  patient_statement: {
    name: "Patient Statement",
    description: "Bill/statement sent to patient",
    category: "patient_document",
    indicators: ["patient statement", "amount due", "balance due", "payment due", "billing statement", "please pay"],
  },
  patient_registration: {
    name: "Patient Registration Form",
    description: "Patient demographic/registration form",
    category: "patient_document",
    indicators: ["registration", "patient information", "emergency contact", "insurance information", "demographic"],
  },
  insurance_card: {
    name: "Insurance Card",
    description: "Copy of patient insurance card",
    category: "patient_document",
    indicators: ["member ID", "group number", "RxBIN", "PCN", "health plan", "insurance card", "ID card"],
  },
  
  // Clinical Documents
  medical_record: {
    name: "Medical Record/Chart Note",
    description: "Clinical documentation/progress notes",
    category: "clinical",
    indicators: ["chief complaint", "history of present illness", "HPI", "assessment", "plan", "diagnosis", "physical exam", "vital signs", "SOAP"],
  },
  operative_report: {
    name: "Operative Report",
    description: "Surgical procedure documentation",
    category: "clinical",
    indicators: ["operative report", "procedure performed", "surgeon", "anesthesia", "preoperative diagnosis", "postoperative diagnosis", "surgical"],
  },
  lab_results: {
    name: "Lab Results",
    description: "Laboratory test results",
    category: "clinical",
    indicators: ["lab results", "laboratory", "specimen", "reference range", "CBC", "BMP", "lipid panel", "urinalysis"],
  },
  
  // Authorization Documents
  prior_auth: {
    name: "Prior Authorization",
    description: "Prior authorization request or approval",
    category: "authorization",
    indicators: ["prior authorization", "pre-certification", "pre-auth", "authorization number", "approved", "auth#", "authorization request"],
  },
  referral: {
    name: "Referral",
    description: "Patient referral document",
    category: "authorization",
    indicators: ["referral", "referred to", "referring physician", "specialist", "consult"],
  },
  
  // Financial Reports
  aging_report: {
    name: "Aging Report",
    description: "Accounts receivable aging report",
    category: "financial_report",
    indicators: ["aging", "0-30", "31-60", "61-90", "90+", "120+", "accounts receivable", "A/R"],
  },
  payment_report: {
    name: "Payment Report",
    description: "Payment/collection summary report",
    category: "financial_report",
    indicators: ["payment report", "collections", "receipts", "deposits", "payment summary"],
  },
  
  // Spreadsheets
  spreadsheet_claims: {
    name: "Claims Spreadsheet",
    description: "Spreadsheet containing claim data",
    category: "spreadsheet",
    indicators: ["claim", "CPT", "ICD", "DOS", "billed", "procedure code", "diagnosis"],
  },
  spreadsheet_payments: {
    name: "Payments Spreadsheet",
    description: "Spreadsheet containing payment data",
    category: "spreadsheet",
    indicators: ["payment", "paid", "check", "EFT", "remittance", "amount paid"],
  },
  spreadsheet_patients: {
    name: "Patient List Spreadsheet",
    description: "Spreadsheet containing patient data",
    category: "spreadsheet",
    indicators: ["patient", "DOB", "member", "subscriber", "demographic"],
  },
  
  // Other
  correspondence: {
    name: "General Correspondence",
    description: "Letters and general communications",
    category: "other",
    indicators: ["dear", "sincerely", "regards", "letter", "notice"],
  },
  unknown: {
    name: "Unknown Document Type",
    description: "Document type could not be determined",
    category: "unknown",
    indicators: [],
  },
};

// Check for EDI format markers
function checkEDIFormat(content: string): string | null {
  const trimmed = content.trim();
  
  // Check for ISA segment (EDI file start)
  if (trimmed.startsWith("ISA*") || trimmed.includes("~ISA*")) {
    // Find the ST segment to determine transaction type
    const stMatch = trimmed.match(/ST\*(\d{3})/);
    if (stMatch) {
      const transactionCode = stMatch[1];
      switch (transactionCode) {
        case "835": return "edi_835";
        case "837": {
          // Check for professional vs institutional
          if (trimmed.includes("SV2*") || trimmed.includes("UB")) return "edi_837i";
          return "edi_837p";
        }
        case "270": return "edi_270";
        case "271": return "edi_271";
        case "276": return "edi_276";
        case "277": return "edi_277";
      }
    }
    return "edi_835"; // Default to 835 if can't determine
  }
  
  return null;
}

// Quick pattern-based classification (before LLM)
function quickClassify(content: string, filename: string): { type: string; confidence: string } | null {
  const lowerContent = content.toLowerCase();
  const lowerFilename = filename?.toLowerCase() || '';
  
  // Check EDI format first
  const ediType = checkEDIFormat(content);
  if (ediType) {
    return { type: ediType, confidence: 'high' };
  }
  
  // Check filename patterns
  if (lowerFilename.includes('835') || lowerFilename.includes('remit')) {
    return { type: 'edi_835', confidence: 'medium' };
  }
  if (lowerFilename.includes('837')) {
    return { type: 'edi_837p', confidence: 'medium' };
  }
  if (lowerFilename.includes('eob')) {
    return { type: 'eob', confidence: 'medium' };
  }
  if (lowerFilename.includes('cms1500') || lowerFilename.includes('cms-1500') || lowerFilename.includes('hcfa')) {
    return { type: 'cms_1500', confidence: 'medium' };
  }
  if (lowerFilename.includes('ub04') || lowerFilename.includes('ub-04')) {
    return { type: 'ub_04', confidence: 'medium' };
  }
  
  // Check for obvious content patterns
  if (lowerContent.includes('explanation of benefits') || 
      (lowerContent.includes('this is not a bill') && lowerContent.includes('claim'))) {
    return { type: 'eob', confidence: 'high' };
  }
  
  return null;
}

// Call Gemini API for classification
async function classifyWithGemini(
  content: string, 
  filename: string,
  apiKey: string
): Promise<{ type: string; confidence: string; indicators: string[]; reasoning: string }> {
  
  // Truncate content if too long (keep first and last parts for context)
  const maxLength = 15000;
  let processedContent = content;
  if (content.length > maxLength) {
    const halfLength = Math.floor(maxLength / 2);
    processedContent = content.slice(0, halfLength) + "\n\n[... content truncated ...]\n\n" + content.slice(-halfLength);
  }
  
  const documentTypesList = Object.entries(DOCUMENT_TYPES)
    .filter(([key]) => key !== 'unknown')
    .map(([key, value]) => `- ${key}: ${value.name} - ${value.description}`)
    .join('\n');

  const prompt = `You are an expert healthcare document classifier. Analyze the following document and classify it.

DOCUMENT FILENAME: ${filename || 'unknown'}

DOCUMENT CONTENT:
---
${processedContent}
---

AVAILABLE DOCUMENT TYPES:
${documentTypesList}

TASK: Classify this document into ONE of the types listed above.

Respond in this exact JSON format:
{
  "document_type": "the_type_key",
  "confidence": "high" | "medium" | "low",
  "indicators_found": ["list", "of", "key", "phrases", "found"],
  "reasoning": "Brief explanation of why this classification was chosen"
}

IMPORTANT:
- Use ONLY the document type keys from the list above
- "high" confidence = very certain, multiple clear indicators
- "medium" confidence = fairly certain, some indicators
- "low" confidence = uncertain, few indicators
- List 3-5 specific indicators found in the document
- If you cannot determine the type, use "unknown"`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
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
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse Gemini response:", responseText);
      throw new Error("Invalid response format from Gemini");
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // Validate document type
    const validType = DOCUMENT_TYPES[result.document_type as keyof typeof DOCUMENT_TYPES] 
      ? result.document_type 
      : 'unknown';
    
    return {
      type: validType,
      confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'low',
      indicators: Array.isArray(result.indicators_found) ? result.indicators_found : [],
      reasoning: result.reasoning || '',
    };

  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      content,           // Document text content
      filename,          // Original filename
      documentId,        // Optional: existing document ID to update
      mimeType,          // MIME type of original file
      skipLLM = false,   // If true, only use pattern matching
    } = await req.json();

    // Validate required fields
    if (!content) {
      throw new Error("Missing required field: content");
    }

    // Get auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log(`Classifying document: ${filename || 'unknown'}`);

    // Try quick classification first
    const quickResult = quickClassify(content, filename || '');
    
    let classification: {
      type: string;
      confidence: string;
      indicators: string[];
      reasoning: string;
      method: string;
    };

    if (quickResult && quickResult.confidence === 'high') {
      // Use quick classification for high-confidence matches
      const docType = DOCUMENT_TYPES[quickResult.type as keyof typeof DOCUMENT_TYPES];
      classification = {
        type: quickResult.type,
        confidence: quickResult.confidence,
        indicators: docType?.indicators?.slice(0, 5) || [],
        reasoning: `Pattern-matched based on ${quickResult.type.startsWith('edi_') ? 'EDI format markers' : 'document content patterns'}`,
        method: 'pattern_matching',
      };
      console.log(`Quick classified as ${quickResult.type} with ${quickResult.confidence} confidence`);
    } else if (skipLLM) {
      // Use quick result or unknown
      classification = quickResult 
        ? {
            type: quickResult.type,
            confidence: quickResult.confidence,
            indicators: [],
            reasoning: 'Pattern matching only (LLM skipped)',
            method: 'pattern_matching',
          }
        : {
            type: 'unknown',
            confidence: 'low',
            indicators: [],
            reasoning: 'Could not classify without LLM',
            method: 'pattern_matching',
          };
    } else {
      // Use Gemini for better classification
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        throw new Error("GEMINI_API_KEY not configured. Set it in Supabase Edge Function secrets.");
      }

      console.log("Using Gemini for classification...");
      const geminiResult = await classifyWithGemini(content, filename || '', geminiKey);
      
      classification = {
        ...geminiResult,
        method: 'llm_gemini',
      };
      console.log(`Gemini classified as ${geminiResult.type} with ${geminiResult.confidence} confidence`);
    }

    // Get document type metadata
    const docTypeInfo = DOCUMENT_TYPES[classification.type as keyof typeof DOCUMENT_TYPES] || DOCUMENT_TYPES.unknown;

    // Prepare result
    const result = {
      success: true,
      classification: {
        document_type: classification.type,
        document_type_name: docTypeInfo.name,
        document_type_description: docTypeInfo.description,
        category: docTypeInfo.category,
        confidence: classification.confidence,
        indicators_found: classification.indicators,
        reasoning: classification.reasoning,
        classification_method: classification.method,
      },
      metadata: {
        filename: filename || 'unknown',
        mime_type: mimeType,
        content_length: content.length,
        classified_at: new Date().toISOString(),
      },
    };

    // If documentId provided, update the document record
    if (documentId) {
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          status: 'classifying',
          document_type: classification.type,
          classification_confidence: classification.confidence,
          classification_indicators: classification.indicators,
          extracted_data: {
            ...result.classification,
            classified_at: result.metadata.classified_at,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating document:', updateError);
      } else {
        console.log(`Updated document ${documentId} with classification`);
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("Error in classify-document:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
