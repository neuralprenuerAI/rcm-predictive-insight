import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OCR Result interface
interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  pageCount: number;
  wordCount: number;
  processingTimeMs: number;
  provider: string;
  pages?: any[];
}

// ============================================
// OCR.SPACE PROVIDER (FREE - 25,000 requests/month)
// ============================================

async function ocrWithOCRSpace(
  content: string,
  filename: string,
  mimeType: string,
  apiKey: string
): Promise<OCRResult> {
  console.log("Using OCR.space provider...");
  
  const startTime = Date.now();
  
  // Prepare form data
  const formData = new FormData();
  
  // Determine if content is base64 or URL
  if (content.startsWith("http://") || content.startsWith("https://")) {
    formData.append("url", content);
  } else {
    // Handle base64 content
    let base64Data = content;
    
    // Remove data URL prefix if present
    if (content.startsWith("data:")) {
      const match = content.match(/^data:[^;]+;base64,(.+)$/);
      if (match) {
        base64Data = match[1];
      }
    }
    
    // OCR.space expects base64 with prefix
    const base64WithPrefix = `data:${mimeType || 'application/pdf'};base64,${base64Data}`;
    formData.append("base64Image", base64WithPrefix);
  }
  
  // OCR.space settings
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2"); // Engine 2 is better for documents
  formData.append("filetype", mimeType === "application/pdf" ? "PDF" : "AUTO");
  
  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("OCR.space error:", response.status, errorText);
    throw new Error(`OCR.space API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.IsErroredOnProcessing) {
    throw new Error(`OCR.space processing error: ${data.ErrorMessage?.[0] || "Unknown error"}`);
  }
  
  // Extract text from all pages
  const pages = data.ParsedResults || [];
  let fullText = "";
  let totalConfidence = 0;
  
  for (const page of pages) {
    if (page.ParsedText) {
      if (fullText) fullText += "\n\n";
      fullText += page.ParsedText;
    }
    if (page.TextOverlay?.TextConfidence) {
      totalConfidence += parseFloat(page.TextOverlay.TextConfidence);
    }
  }
  
  const avgConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;
  const wordCount = fullText.split(/\s+/).filter(w => w).length;
  
  return {
    success: true,
    text: fullText.trim(),
    confidence: avgConfidence / 100, // Convert to 0-1 scale
    pageCount: pages.length || 1,
    wordCount,
    processingTimeMs: Date.now() - startTime,
    provider: "ocr_space",
    pages: pages.map((p: any, i: number) => ({
      pageNumber: i + 1,
      text: p.ParsedText || "",
      exitCode: p.FileParseExitCode,
    })),
  };
}

// ============================================
// AZURE DOCUMENT INTELLIGENCE PROVIDER (PRODUCTION)
// ============================================

async function ocrWithAzure(
  content: string,
  filename: string,
  mimeType: string,
  endpoint: string,
  apiKey: string,
  maxWaitMs: number = 60000
): Promise<OCRResult> {
  console.log("Using Azure Document Intelligence provider...");
  
  const startTime = Date.now();
  
  // Submit for analysis
  const analyzeUrl = `${endpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;
  
  // Prepare content
  let bodyContent: ArrayBuffer | string;
  let requestContentType: string;
  
  if (content.startsWith("data:")) {
    const base64Match = content.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      mimeType = base64Match[1];
      const base64Data = base64Match[2];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      bodyContent = bytes.buffer as ArrayBuffer;
      requestContentType = mimeType;
    } else {
      throw new Error("Invalid data URL format");
    }
  } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
    const binaryStr = atob(content);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    bodyContent = bytes.buffer as ArrayBuffer;
    requestContentType = mimeType || "application/pdf";
  } else if (content.startsWith("http://") || content.startsWith("https://")) {
    bodyContent = JSON.stringify({ urlSource: content });
    requestContentType = "application/json";
  } else {
    throw new Error("Content must be base64-encoded or a URL");
  }
  
  // Submit document
  const submitResponse = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": requestContentType,
    },
    body: bodyContent,
  });
  
  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Azure API error: ${submitResponse.status} - ${errorText}`);
  }
  
  const operationUrl = submitResponse.headers.get("Operation-Location");
  if (!operationUrl) {
    throw new Error("No Operation-Location header in Azure response");
  }
  
  // Poll for results
  const pollInterval = 1000;
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const pollResponse = await fetch(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
    });
    
    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      throw new Error(`Azure poll error: ${pollResponse.status} - ${errorText}`);
    }
    
    const result = await pollResponse.json();
    
    if (result.status === "succeeded") {
      const analyzeResult = result.analyzeResult;
      
      // Extract text
      let fullText = analyzeResult.content || "";
      let totalConfidence = 0;
      let confidenceCount = 0;
      
      for (const page of analyzeResult.pages || []) {
        for (const word of page.words || []) {
          if (word.confidence) {
            totalConfidence += word.confidence;
            confidenceCount++;
          }
        }
      }
      
      const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
      const wordCount = fullText.split(/\s+/).filter((w: string) => w).length;
      
      return {
        success: true,
        text: fullText,
        confidence: avgConfidence,
        pageCount: analyzeResult.pages?.length || 1,
        wordCount,
        processingTimeMs: Date.now() - startTime,
        provider: "azure_document_intelligence",
        pages: analyzeResult.pages?.map((p: any) => ({
          pageNumber: p.pageNumber,
          width: p.width,
          height: p.height,
          lines: p.lines?.map((l: any) => l.content) || [],
        })),
      };
    } else if (result.status === "failed") {
      throw new Error(`Azure analysis failed: ${result.error?.message || "Unknown error"}`);
    }
    // Continue polling if status is "running"
  }
  
  throw new Error(`Azure analysis timed out after ${maxWaitMs}ms`);
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      content,          // Base64 encoded file content or URL
      filename,         // Original filename
      mimeType,         // MIME type (application/pdf, image/jpeg, etc.)
      documentId,       // Optional: existing document ID to update
      url,              // Alternative: URL to document
      provider,         // Optional: force specific provider ('ocr_space' or 'azure')
      maxWaitMs = 60000,
    } = await req.json();

    // Validate required fields
    const documentContent = url || content;
    if (!documentContent) {
      throw new Error("Missing required field: content or url");
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

    console.log(`OCR processing: ${filename || url || "unknown"}`);

    // Validate file type
    const validMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/tiff",
      "image/tif",
      "image/bmp",
      "image/gif",
    ];
    
    const validExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".gif"];
    const lowerFilename = (filename || "").toLowerCase();
    const isValidType = validMimeTypes.includes(mimeType?.toLowerCase() || "") ||
                        validExtensions.some(ext => lowerFilename.endsWith(ext));
    
    if (!isValidType && mimeType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `File type '${mimeType}' is not supported. Use PDF or images (JPG, PNG, TIFF, BMP, GIF).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update document status if documentId provided
    if (documentId) {
      await supabaseClient
        .from("documents")
        .update({
          status: "ocr_processing",
          ocr_required: true,
          processing_started_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("user_id", user.id);
    }

    // Determine which provider to use
    const ocrSpaceKey = Deno.env.get("OCR_SPACE_API_KEY");
    const azureEndpoint = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");
    const azureKey = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");
    
    let ocrResult: OCRResult;
    
    // Provider selection logic
    if (provider === "azure" || (!provider && azureEndpoint && azureKey)) {
      // Use Azure if explicitly requested or if Azure is configured
      if (!azureEndpoint || !azureKey) {
        throw new Error("Azure Document Intelligence not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY.");
      }
      ocrResult = await ocrWithAzure(documentContent, filename || "", mimeType || "application/pdf", azureEndpoint, azureKey, maxWaitMs);
    } else if (provider === "ocr_space" || ocrSpaceKey) {
      // Use OCR.space if explicitly requested or as fallback
      if (!ocrSpaceKey) {
        throw new Error("OCR.space not configured. Set OCR_SPACE_API_KEY.");
      }
      ocrResult = await ocrWithOCRSpace(documentContent, filename || "", mimeType || "application/pdf", ocrSpaceKey);
    } else {
      // No provider configured
      throw new Error(
        "No OCR provider configured. Please set either:\n" +
        "- OCR_SPACE_API_KEY (free, 25k requests/month)\n" +
        "- AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY (production)"
      );
    }

    console.log(`OCR completed with ${ocrResult.provider}: ${ocrResult.pageCount} pages, ${ocrResult.wordCount} words, ${(ocrResult.confidence * 100).toFixed(1)}% confidence`);

    // Prepare response
    const result = {
      success: true,
      ocr: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        pageCount: ocrResult.pageCount,
        wordCount: ocrResult.wordCount,
        processingTimeMs: ocrResult.processingTimeMs,
        provider: ocrResult.provider,
      },
      pages: ocrResult.pages,
      metadata: {
        filename: filename || "unknown",
        mimeType: mimeType,
        processedAt: new Date().toISOString(),
      },
    };

    // Update document record if documentId provided
    if (documentId) {
      const { error: updateError } = await supabaseClient
        .from("documents")
        .update({
          status: "completed",
          extracted_text: ocrResult.text,
          ocr_confidence: ocrResult.confidence,
          ocr_provider: ocrResult.provider,
          processing_duration_ms: ocrResult.processingTimeMs,
          processed_at: new Date().toISOString(),
          extracted_data: {
            ocr: {
              pageCount: ocrResult.pageCount,
              wordCount: ocrResult.wordCount,
              confidence: ocrResult.confidence,
              provider: ocrResult.provider,
            },
          },
        })
        .eq("id", documentId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating document:", updateError);
      } else {
        console.log(`Updated document ${documentId} with OCR results`);
      }
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in ocr-document:", error);

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
