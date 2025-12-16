import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessedDocument {
  document_id: string;
  filename: string;
  document_type: string;
  patient_name: string | null;
  patient_dob: string | null;
  date_of_service: string | null;
  account_number: string | null;
  payer: string | null;
  claim_id: string | null;
}

// Normalize patient name for matching
function normalizeName(name: string | null): string {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize date for matching
function normalizeDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    if (cleaned.startsWith('19') || cleaned.startsWith('20')) {
      return cleaned;
    }
    return cleaned.slice(4) + cleaned.slice(0, 4);
  }
  return cleaned;
}

// Find matching claims for a document
async function findMatchingClaim(
  supabase: any,
  userId: string,
  doc: ProcessedDocument
): Promise<{ matched: boolean; claim_id: string | null; match_confidence: number; match_reasons: string[] }> {
  const matchReasons: string[] = [];
  let bestMatch: any = null;
  let bestScore = 0;

  const { data: claims, error } = await supabase
    .from('claims')
    .select('id, patient_name, date_of_service, claim_id, payer')
    .eq('user_id', userId);

  if (error || !claims || claims.length === 0) {
    return { matched: false, claim_id: null, match_confidence: 0, match_reasons: [] };
  }

  const docName = normalizeName(doc.patient_name);
  const docDOS = normalizeDate(doc.date_of_service);
  const docAccount = doc.account_number?.trim().toUpperCase();

  for (const claim of claims) {
    let score = 0;
    const reasons: string[] = [];

    const claimName = normalizeName(claim.patient_name);
    if (docName && claimName && docName.includes(claimName.split(' ')[0])) {
      score += 40;
      reasons.push('Patient name matches');
    }

    const claimDOS = normalizeDate(claim.date_of_service);
    if (docDOS && claimDOS && docDOS === claimDOS) {
      score += 35;
      reasons.push('Date of service matches');
    }

    const claimAccount = claim.claim_id?.trim().toUpperCase();
    if (docAccount && claimAccount && docAccount === claimAccount) {
      score += 50;
      reasons.push('Account number matches');
    }

    if (doc.payer && claim.payer) {
      const docPayer = doc.payer.toUpperCase();
      const claimPayer = claim.payer.toUpperCase();
      if (docPayer.includes(claimPayer) || claimPayer.includes(docPayer)) {
        score += 10;
        reasons.push('Payer matches');
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = claim;
      matchReasons.length = 0;
      matchReasons.push(...reasons);
    }
  }

  if (bestScore >= 50 && bestMatch) {
    return {
      matched: true,
      claim_id: bestMatch.id,
      match_confidence: Math.min(bestScore, 100),
      match_reasons: matchReasons,
    };
  }

  return { matched: false, claim_id: null, match_confidence: bestScore, match_reasons: matchReasons };
}

// Extract patient info from document using Gemini
async function extractPatientInfo(
  text: string,
  documentType: string,
  geminiKey: string
): Promise<{
  patient_name: string | null;
  patient_dob: string | null;
  date_of_service: string | null;
  account_number: string | null;
  payer: string | null;
}> {
  const prompt = `Extract patient and claim information from this ${documentType} document.

TEXT:
"""
${text.substring(0, 5000)}
"""

Return ONLY a JSON object with these fields (use null if not found):
{
  "patient_name": "<LAST, FIRST format or null>",
  "patient_dob": "<YYYY-MM-DD format or null>",
  "date_of_service": "<YYYY-MM-DD format or null>",
  "account_number": "<patient account or claim number or null>",
  "payer": "<insurance company name or null>"
}

JSON only, no markdown:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  );

  if (!response.ok) {
    console.error("Gemini extraction failed");
    return { patient_name: null, patient_dob: null, date_of_service: null, account_number: null, payer: null };
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Parse error:", e);
  }

  return { patient_name: null, patient_dob: null, date_of_service: null, account_number: null, payer: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      documents,
      autoLink = true,
      autoReview = true,
    } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new Error("Missing required field: documents");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const authToken = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseClient = createClient(
      supabaseUrl,
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

    console.log(`Smart processing ${documents.length} documents...`);
    const results: ProcessedDocument[] = [];
    const claimsToReview: string[] = [];

    for (const doc of documents) {
      console.log(`Processing: ${doc.filename}`);

      // Step 1: Classify document
      const classifyResponse = await fetch(`${supabaseUrl}/functions/v1/classify-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: doc.content,
          filename: doc.filename,
        }),
      });

      let documentType = 'unknown';
      if (classifyResponse.ok) {
        const classifyResult = await classifyResponse.json();
        documentType = classifyResult.classification?.document_type || 'unknown';
      }

      console.log(`Classified as: ${documentType}`);

      // Step 2: Process based on document type
      let claimId: string | null = null;
      let extractedText = '';

      if (documentType === 'cms_1500') {
        const cms1500Response = await fetch(`${supabaseUrl}/functions/v1/parse-cms1500`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            content: doc.content,
            filename: doc.filename,
            createClaim: true,
          }),
        });

        if (cms1500Response.ok) {
          const processResult = await cms1500Response.json();
          claimId = processResult.claim_id;
          extractedText = JSON.stringify(processResult.extracted || {});
        }
      } else {
        const ocrResponse = await fetch(`${supabaseUrl}/functions/v1/ocr-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            content: doc.content,
            filename: doc.filename,
            mimeType: doc.mimeType,
          }),
        });

        if (ocrResponse.ok) {
          const ocrResult = await ocrResponse.json();
          extractedText = ocrResult.ocr?.text || '';
        }
      }

      // Step 3: Create document record
      const { data: docRecord, error: docError } = await supabaseClient
        .from('documents')
        .insert({
          user_id: user.id,
          filename: doc.filename,
          original_filename: doc.filename,
          file_type: doc.mimeType?.split('/')[1] || 'pdf',
          file_url: '',
          mime_type: doc.mimeType,
          document_type: documentType,
          extracted_text: extractedText.substring(0, 100000),
          status: 'completed',
          source: 'smart_upload',
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (docError) {
        console.error('Error creating document:', docError);
        continue;
      }

      // Step 4: Extract patient info for matching
      const patientInfo = await extractPatientInfo(extractedText, documentType, geminiKey);

      const processedDoc: ProcessedDocument = {
        document_id: docRecord.id,
        filename: doc.filename,
        document_type: documentType,
        patient_name: patientInfo.patient_name,
        patient_dob: patientInfo.patient_dob,
        date_of_service: patientInfo.date_of_service,
        account_number: patientInfo.account_number,
        payer: patientInfo.payer,
        claim_id: claimId,
      };

      // Step 5: Auto-link if not a CMS-1500
      if (autoLink && !claimId && documentType !== 'cms_1500') {
        const matchResult = await findMatchingClaim(supabaseClient, user.id, processedDoc);
        
        if (matchResult.matched && matchResult.claim_id) {
          const docRole = documentType.includes('progress') ? 'progress_note' :
                         documentType.includes('lab') ? 'lab_result' :
                         documentType.includes('operative') ? 'operative_report' :
                         documentType.includes('clinical') ? 'clinical_note' :
                         'supporting';

          await supabaseClient
            .from('claim_documents')
            .insert({
              user_id: user.id,
              claim_id: matchResult.claim_id,
              document_id: docRecord.id,
              document_role: docRole,
            });

          processedDoc.claim_id = matchResult.claim_id;
          console.log(`Auto-linked to claim ${matchResult.claim_id} (${matchResult.match_confidence}% confidence)`);

          if (!claimsToReview.includes(matchResult.claim_id)) {
            claimsToReview.push(matchResult.claim_id);
          }
        }
      }

      if (claimId && !claimsToReview.includes(claimId)) {
        claimsToReview.push(claimId);
      }

      results.push(processedDoc);
    }

    // Step 6: Auto-run AI review
    const reviewResults: any[] = [];
    
    if (autoReview && claimsToReview.length > 0) {
      console.log(`Running AI review on ${claimsToReview.length} claims...`);
      
      for (const claimIdToReview of claimsToReview) {
        try {
          const reviewResponse = await fetch(`${supabaseUrl}/functions/v1/ai-claim-review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ claimId: claimIdToReview }),
          });

          if (reviewResponse.ok) {
            const reviewResult = await reviewResponse.json();
            reviewResults.push({
              claim_id: claimIdToReview,
              approval_probability: reviewResult.review?.approval_probability,
              risk_level: reviewResult.review?.risk_level,
              summary: reviewResult.review?.executive_summary,
            });
          }
        } catch (e) {
          console.error(`Review failed for claim ${claimIdToReview}:`, e);
        }
      }
    }

    const response = {
      success: true,
      processed_count: results.length,
      documents: results,
      claims_created: results.filter(r => r.claim_id && r.document_type === 'cms_1500').length,
      documents_linked: results.filter(r => r.claim_id && r.document_type !== 'cms_1500').length,
      reviews: reviewResults,
      summary: {
        total_uploaded: documents.length,
        claims_found: claimsToReview.length,
        auto_linked: results.filter(r => r.claim_id).length,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in smart-process:", error);
    
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
