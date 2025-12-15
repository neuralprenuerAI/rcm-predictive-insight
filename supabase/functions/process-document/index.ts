import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface ProcessingStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  result?: any;
  error?: string;
}

interface ProcessingResult {
  success: boolean;
  documentId: string;
  filename: string;
  fileType: string;
  documentType: string | null;
  steps: ProcessingStep[];
  totalDurationMs: number;
  extractedData: any;
  rulesResult: any;
  error?: string;
}

// ============================================
// HELPER: Call another edge function
// ============================================

async function callEdgeFunction(
  supabaseUrl: string,
  functionName: string,
  payload: any,
  authToken: string
): Promise<any> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${functionName} failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

// ============================================
// HELPER: Determine file type from filename/mime
// ============================================

function getFileType(filename: string, mimeType: string): string {
  const lowerFilename = (filename || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  
  if (lowerMime === 'application/pdf' || lowerFilename.endsWith('.pdf')) {
    return 'pdf';
  }
  if (lowerMime.startsWith('image/') || /\.(jpg|jpeg|png|gif|tiff|tif|bmp)$/.test(lowerFilename)) {
    return 'image';
  }
  if (lowerMime === 'text/csv' || lowerFilename.endsWith('.csv')) {
    return 'csv';
  }
  if (lowerMime === 'text/tab-separated-values' || lowerFilename.endsWith('.tsv')) {
    return 'csv';
  }
  if (lowerMime.includes('spreadsheet') || /\.(xlsx|xls)$/.test(lowerFilename)) {
    return 'xlsx';
  }
  if (lowerMime === 'text/plain' || lowerFilename.endsWith('.txt')) {
    return 'txt';
  }
  if (lowerFilename.endsWith('.edi') || lowerFilename.endsWith('.x12')) {
    return 'edi';
  }
  
  return 'unknown';
}

// ============================================
// HELPER: Check if content is EDI
// ============================================

function isEDIContent(content: string): { isEDI: boolean; type: '835' | '837' | null } {
  const trimmed = (content || '').trim();
  
  // Check for ISA segment
  if (trimmed.startsWith('ISA*') || trimmed.includes('~ISA*')) {
    // Find ST segment
    const stMatch = trimmed.match(/ST\*(\d{3})/);
    if (stMatch) {
      if (stMatch[1] === '835') {
        return { isEDI: true, type: '835' };
      }
      if (stMatch[1] === '837') {
        return { isEDI: true, type: '837' };
      }
    }
    return { isEDI: true, type: null };
  }
  
  return { isEDI: false, type: null };
}

// ============================================
// HELPER: Check if file needs OCR
// ============================================

function needsOCR(fileType: string, documentType: string | null): boolean {
  // Images always need OCR
  if (fileType === 'image') {
    return true;
  }
  
  // PDFs might need OCR depending on document type
  if (fileType === 'pdf') {
    // These document types are typically scanned and need OCR
    const ocrDocTypes = [
      'eob', 'era', 'cms_1500', 'ub_04', 'ada_claim',
      'patient_statement', 'insurance_card', 'denial_letter',
      'medical_record', 'lab_results', 'prior_auth'
    ];
    
    if (documentType && ocrDocTypes.includes(documentType)) {
      return true;
    }
    
    // Default: assume PDF needs OCR
    return true;
  }
  
  return false;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStartTime = Date.now();
  const steps: ProcessingStep[] = [];
  
  // Helper to add step
  const addStep = (step: string): ProcessingStep => {
    const s: ProcessingStep = { step, status: 'pending' };
    steps.push(s);
    return s;
  };
  
  const startStep = (s: ProcessingStep) => {
    s.status = 'running';
    s.startTime = Date.now();
  };
  
  const completeStep = (s: ProcessingStep, result?: any) => {
    s.status = 'completed';
    s.endTime = Date.now();
    s.durationMs = s.endTime - (s.startTime || s.endTime);
    s.result = result;
  };
  
  const failStep = (s: ProcessingStep, error: string) => {
    s.status = 'failed';
    s.endTime = Date.now();
    s.durationMs = s.endTime - (s.startTime || s.endTime);
    s.error = error;
  };
  
  const skipStep = (s: ProcessingStep, reason: string) => {
    s.status = 'skipped';
    s.result = { reason };
  };

  try {
    const {
      content,              // Base64 content or text content
      filename,             // Original filename
      mimeType,             // MIME type
      fileUrl,              // Alternative: URL to file in storage
      skipClassification = false,
      skipOCR = false,
      skipParsing = false,
      skipRules = false,
      forceDocumentType = null,  // Override classification
      metadata = {},        // Additional metadata to store
    } = await req.json();

    if (!content && !fileUrl) {
      throw new Error("Missing required field: content or fileUrl");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }
    
    const authToken = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log(`Processing document: ${filename || 'unknown'}`);

    // Determine file type
    const fileType = getFileType(filename || '', mimeType || '');
    console.log(`File type: ${fileType}`);

    // ============================================
    // STEP 1: Create document record
    // ============================================
    const createStep = addStep('create_document');
    startStep(createStep);
    
    const { data: document, error: createError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: user.id,
        filename: filename || 'unknown',
        original_filename: filename,
        file_url: fileUrl || '',
        file_type: fileType,
        mime_type: mimeType,
        status: 'processing',
        source: metadata.source || 'upload',
        tags: metadata.tags || [],
        notes: metadata.notes || '',
        processing_started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(`Failed to create document: ${createError.message}`);
    }
    
    const documentId = document.id;
    completeStep(createStep, { documentId });
    console.log(`Created document: ${documentId}`);

    // Track results
    let documentType: string | null = forceDocumentType;
    let extractedText: string | null = null;
    let extractedData: any = {};
    let rulesResult: any = null;

    // ============================================
    // STEP 2: Classify document
    // ============================================
    const classifyStep = addStep('classify_document');
    
    if (skipClassification && forceDocumentType) {
      skipStep(classifyStep, 'Skipped - document type provided');
      documentType = forceDocumentType;
    } else {
      startStep(classifyStep);
      
      try {
        // Get text content for classification
        let textForClassification = '';
        
        // Check if content is EDI
        if (typeof content === 'string' && !content.startsWith('data:')) {
          const ediCheck = isEDIContent(content);
          if (ediCheck.isEDI) {
            textForClassification = content.substring(0, 5000);
            if (ediCheck.type === '835') {
              documentType = 'edi_835';
            } else if (ediCheck.type === '837') {
              documentType = 'edi_837p';
            }
          }
        }
        
        // If not EDI, call classify function
        if (!documentType) {
          const classifyResult = await callEdgeFunction(
            supabaseUrl,
            'classify-document',
            {
              content: textForClassification || content?.substring?.(0, 10000) || content,
              filename,
              documentId,
            },
            authToken
          );
          
          if (classifyResult.success) {
            documentType = classifyResult.classification?.document_type || null;
            completeStep(classifyStep, {
              documentType,
              confidence: classifyResult.classification?.confidence,
            });
          } else {
            failStep(classifyStep, classifyResult.error || 'Classification failed');
          }
        } else {
          completeStep(classifyStep, { documentType, method: 'edi_detection' });
        }
      } catch (error) {
        failStep(classifyStep, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Update document with classification
    await supabaseClient
      .from('documents')
      .update({
        document_type: documentType,
        status: 'extracting',
      })
      .eq('id', documentId);

    // ============================================
    // STEP 3: OCR (if needed)
    // ============================================
    const ocrStep = addStep('ocr_document');
    
    const shouldOCR = !skipOCR && needsOCR(fileType, documentType);
    
    if (!shouldOCR) {
      skipStep(ocrStep, `OCR not needed for ${fileType}/${documentType}`);
      
      // For text files, content is already text
      if (typeof content === 'string' && !content.startsWith('data:')) {
        extractedText = content;
      }
    } else {
      startStep(ocrStep);
      
      try {
        const ocrResult = await callEdgeFunction(
          supabaseUrl,
          'ocr-document',
          {
            content,
            filename,
            mimeType,
            documentId,
          },
          authToken
        );
        
        if (ocrResult.success) {
          extractedText = ocrResult.ocr?.text || '';
          completeStep(ocrStep, {
            wordCount: ocrResult.ocr?.wordCount,
            pageCount: ocrResult.ocr?.pageCount,
            confidence: ocrResult.ocr?.confidence,
            provider: ocrResult.ocr?.provider,
          });
        } else {
          failStep(ocrStep, ocrResult.error || 'OCR failed');
        }
      } catch (error) {
        failStep(ocrStep, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // ============================================
    // STEP 4: Parse document based on type
    // ============================================
    const parseStep = addStep('parse_document');
    
    if (skipParsing) {
      skipStep(parseStep, 'Parsing skipped by request');
    } else {
      startStep(parseStep);
      
      try {
        let parseResult: any = null;
        
        // Determine which parser to use
        if (documentType === 'edi_835' || (typeof content === 'string' && isEDIContent(content).type === '835')) {
          // Parse 835
          parseResult = await callEdgeFunction(
            supabaseUrl,
            'parse-835',
            {
              content: extractedText || content,
              documentId,
              saveToDatabase: true,
            },
            authToken
          );
          
          if (parseResult.success) {
            extractedData = {
              type: '835',
              summary: parseResult.summary,
              claimCount: parseResult.parsing?.claimCount,
              ediFileId: parseResult.database?.ediFileId,
              remittanceId: parseResult.database?.remittanceId,
            };
          }
        } else if (documentType === 'edi_837p' || documentType === 'edi_837i' || 
                   (typeof content === 'string' && isEDIContent(content).type === '837')) {
          // Parse 837
          parseResult = await callEdgeFunction(
            supabaseUrl,
            'parse-837',
            {
              content: extractedText || content,
              documentId,
              saveToDatabase: true,
            },
            authToken
          );
          
          if (parseResult.success) {
            extractedData = {
              type: parseResult.fileType,
              summary: parseResult.summary,
              claimCount: parseResult.parsing?.claimCount,
              ediFileId: parseResult.database?.ediFileId,
            };
          }
        } else if (fileType === 'csv' || fileType === 'xlsx' || 
                   documentType?.startsWith('spreadsheet_')) {
          // Parse spreadsheet
          parseResult = await callEdgeFunction(
            supabaseUrl,
            'parse-spreadsheet',
            {
              content: extractedText || content,
              filename,
              documentId,
            },
            authToken
          );
          
          if (parseResult.success) {
            extractedData = {
              type: 'spreadsheet',
              dataType: parseResult.data_type,
              rowCount: parseResult.parsing?.total_rows,
              summary: parseResult.summary,
            };
          }
        } else if (extractedText) {
          // For other document types, store the extracted text
          extractedData = {
            type: documentType || 'unknown',
            textLength: extractedText.length,
            wordCount: extractedText.split(/\s+/).filter(w => w).length,
          };
          parseResult = { success: true };
        } else {
          skipStep(parseStep, `No parser available for ${documentType}`);
          parseResult = null;
        }
        
        if (parseResult) {
          if (parseResult.success) {
            completeStep(parseStep, extractedData);
          } else {
            failStep(parseStep, parseResult.error || 'Parsing failed');
          }
        }
      } catch (error) {
        failStep(parseStep, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // ============================================
    // STEP 5: Execute rules
    // ============================================
    const rulesStep = addStep('execute_rules');
    
    if (skipRules) {
      skipStep(rulesStep, 'Rules skipped by request');
    } else if (!extractedData || Object.keys(extractedData).length === 0) {
      skipStep(rulesStep, 'No extracted data to validate');
    } else {
      startStep(rulesStep);
      
      try {
        // Build context for rules from extracted data
        const rulesContext: any = {
          document_id: documentId,
          document_type: documentType,
          ...extractedData,
        };
        
        // Add claim-specific fields if available
        if (extractedData.summary) {
          Object.assign(rulesContext, extractedData.summary);
        }
        
        rulesResult = await callEdgeFunction(
          supabaseUrl,
          'execute-rules',
          {
            context: rulesContext,
            triggerEvent: 'document_processed',
            targetType: 'documents',
            targetId: documentId,
            saveExecution: true,
          },
          authToken
        );
        
        if (rulesResult.success) {
          completeStep(rulesStep, {
            rulesEvaluated: rulesResult.rules_evaluated,
            overallStatus: rulesResult.overall_status,
            flagCount: rulesResult.flags?.length || 0,
            rejectionCount: rulesResult.rejections?.length || 0,
          });
        } else {
          failStep(rulesStep, rulesResult.error || 'Rules execution failed');
        }
      } catch (error) {
        failStep(rulesStep, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // ============================================
    // STEP 6: Finalize document
    // ============================================
    const finalizeStep = addStep('finalize');
    startStep(finalizeStep);
    
    const totalDuration = Date.now() - totalStartTime;
    const hasErrors = steps.some(s => s.status === 'failed');
    const finalStatus = hasErrors ? 'failed' : 'completed';
    
    const { error: finalizeError } = await supabaseClient
      .from('documents')
      .update({
        status: finalStatus,
        document_type: documentType,
        extracted_text: extractedText?.substring(0, 100000), // Limit text storage
        extracted_data: {
          ...extractedData,
          rulesResult: rulesResult ? {
            overall_status: rulesResult.overall_status,
            flags: rulesResult.flags,
            rejections: rulesResult.rejections,
          } : null,
        },
        processing_duration_ms: totalDuration,
        processed_at: new Date().toISOString(),
        error_message: hasErrors ? steps.find(s => s.status === 'failed')?.error : null,
      })
      .eq('id', documentId);

    if (finalizeError) {
      failStep(finalizeStep, finalizeError.message);
    } else {
      completeStep(finalizeStep, { finalStatus });
    }

    console.log(`Document processing complete: ${documentId}, status: ${finalStatus}, duration: ${totalDuration}ms`);

    // Build response
    const result: ProcessingResult = {
      success: !hasErrors,
      documentId,
      filename: filename || 'unknown',
      fileType,
      documentType,
      steps,
      totalDurationMs: totalDuration,
      extractedData,
      rulesResult: rulesResult ? {
        overall_status: rulesResult.overall_status,
        rules_evaluated: rulesResult.rules_evaluated,
        flags: rulesResult.flags,
        rejections: rulesResult.rejections,
        alerts: rulesResult.alerts,
      } : null,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-document:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        steps,
        totalDurationMs: Date.now() - totalStartTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
