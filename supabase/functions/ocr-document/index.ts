import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Azure Document Intelligence configuration
interface AzureConfig {
  endpoint: string;
  apiKey: string;
}

// OCR Result types
interface OCRWord {
  content: string;
  confidence: number;
  boundingBox?: number[];
}

interface OCRLine {
  content: string;
  confidence: number;
  words: OCRWord[];
  boundingBox?: number[];
}

interface OCRPage {
  pageNumber: number;
  width: number;
  height: number;
  unit: string;
  lines: OCRLine[];
  words: OCRWord[];
}

interface OCRResult {
  success: boolean;
  text: string;
  pages: OCRPage[];
  confidence: number;
  pageCount: number;
  wordCount: number;
  processingTimeMs: number;
  modelId: string;
}

// Get Azure configuration from environment
function getAzureConfig(): AzureConfig {
  const endpoint = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT");
  const apiKey = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");

  if (!endpoint || !apiKey) {
    throw new Error(
      "Azure Document Intelligence not configured. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY in Supabase Edge Function secrets."
    );
  }

  // Ensure endpoint doesn't have trailing slash
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    apiKey,
  };
}

// Submit document for analysis
async function submitForAnalysis(
  config: AzureConfig,
  content: string,
  contentType: string
): Promise<string> {
  // Use the prebuilt-read model for general OCR
  const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;

  console.log(`Submitting document to Azure: ${analyzeUrl}`);

  // Decode base64 if needed
  let bodyContent: ArrayBuffer | string;
  let requestContentType: string;

  if (content.startsWith("data:")) {
    // Data URL format - extract base64 part
    const base64Match = content.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      contentType = base64Match[1];
      const base64Data = base64Match[2];
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      bodyContent = bytes.buffer as ArrayBuffer;
      requestContentType = contentType;
    } else {
      throw new Error("Invalid data URL format");
    }
  } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
    // Pure base64
    const binaryStr = atob(content);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    bodyContent = bytes.buffer as ArrayBuffer;
    requestContentType = contentType || "application/pdf";
  } else if (content.startsWith("http://") || content.startsWith("https://")) {
    // URL - send as JSON
    bodyContent = JSON.stringify({ urlSource: content });
    requestContentType = "application/json";
  } else {
    throw new Error("Content must be base64-encoded or a URL");
  }

  const response = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.apiKey,
      "Content-Type": requestContentType,
    },
    body: bodyContent,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Azure submit error:", response.status, errorText);
    throw new Error(`Azure API error: ${response.status} - ${errorText}`);
  }

  // Get the operation location from headers
  const operationLocation = response.headers.get("Operation-Location");
  if (!operationLocation) {
    throw new Error("No Operation-Location header in Azure response");
  }

  console.log(`Analysis submitted, operation: ${operationLocation}`);
  return operationLocation;
}

// Poll for analysis results
async function pollForResults(
  config: AzureConfig,
  operationUrl: string,
  maxWaitMs: number = 60000
): Promise<any> {
  const startTime = Date.now();
  const pollIntervalMs = 1000;

  while (Date.now() - startTime < maxWaitMs) {
    console.log("Polling for results...");

    const response = await fetch(operationUrl, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": config.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure poll error:", response.status, errorText);
      throw new Error(`Azure poll error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const status = result.status;

    console.log(`Analysis status: ${status}`);

    if (status === "succeeded") {
      return result.analyzeResult;
    } else if (status === "failed") {
      throw new Error(`Analysis failed: ${result.error?.message || "Unknown error"}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Analysis timed out after ${maxWaitMs}ms`);
}

// Helper to check if word is within line bounds (simplified)
function isWordInLine(wordBounds: number[], lineBounds: number[]): boolean {
  if (!wordBounds || !lineBounds || wordBounds.length < 2 || lineBounds.length < 2) {
    return false;
  }
  // Simple check: word Y is within line Y range
  const wordY = wordBounds[1];
  const lineYMin = Math.min(lineBounds[1], lineBounds[3], lineBounds[5], lineBounds[7]);
  const lineYMax = Math.max(lineBounds[1], lineBounds[3], lineBounds[5], lineBounds[7]);
  return wordY >= lineYMin && wordY <= lineYMax;
}

// Extract structured data from Azure response
function extractResults(analyzeResult: any): OCRResult {
  const pages: OCRPage[] = [];
  let fullText = "";
  let totalConfidence = 0;
  let confidenceCount = 0;
  let wordCount = 0;

  // Process each page
  for (const page of analyzeResult.pages || []) {
    const pageLines: OCRLine[] = [];
    const pageWords: OCRWord[] = [];

    // Process lines
    for (const line of page.lines || []) {
      const lineWords: OCRWord[] = [];

      // Process words in the line
      for (const word of line.words || page.words?.filter((w: any) => 
        w.boundingPolygon && line.boundingPolygon && 
        isWordInLine(w.boundingPolygon, line.boundingPolygon)
      ) || []) {
        const wordObj: OCRWord = {
          content: word.content || word.text || "",
          confidence: word.confidence || 0,
          boundingBox: word.boundingPolygon || word.boundingBox,
        };
        lineWords.push(wordObj);
        pageWords.push(wordObj);
        
        if (word.confidence) {
          totalConfidence += word.confidence;
          confidenceCount++;
        }
        wordCount++;
      }

      const lineObj: OCRLine = {
        content: line.content || lineWords.map(w => w.content).join(" "),
        confidence: lineWords.length > 0 
          ? lineWords.reduce((sum, w) => sum + w.confidence, 0) / lineWords.length 
          : 0,
        words: lineWords,
        boundingBox: line.boundingPolygon || line.boundingBox,
      };
      pageLines.push(lineObj);
    }

    // Build page text
    const pageText = pageLines.map(l => l.content).join("\n");
    if (fullText) fullText += "\n\n";
    fullText += pageText;

    pages.push({
      pageNumber: page.pageNumber || pages.length + 1,
      width: page.width || 0,
      height: page.height || 0,
      unit: page.unit || "pixel",
      lines: pageLines,
      words: pageWords,
    });
  }

  // If no pages/lines, try to get content directly
  if (!fullText && analyzeResult.content) {
    fullText = analyzeResult.content;
    wordCount = fullText.split(/\s+/).filter((w: string) => w).length;
  }

  const averageConfidence = confidenceCount > 0 
    ? totalConfidence / confidenceCount 
    : 0;

  return {
    success: true,
    text: fullText,
    pages,
    confidence: averageConfidence,
    pageCount: pages.length || 1,
    wordCount,
    processingTimeMs: 0, // Will be set by caller
    modelId: analyzeResult.modelId || "prebuilt-read",
  };
}

// Detect if content is likely a scanned document needing OCR
function needsOCR(mimeType: string, filename: string): boolean {
  const ocrMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tiff",
    "image/tif",
    "image/bmp",
    "image/gif",
    "application/pdf",
  ];

  const ocrExtensions = [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".gif", ".pdf"];

  const lowerFilename = filename?.toLowerCase() || "";
  const isImage = ocrMimeTypes.includes(mimeType?.toLowerCase() || "");
  const hasOCRExtension = ocrExtensions.some(ext => lowerFilename.endsWith(ext));

  return isImage || hasOCRExtension;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      content,        // Base64 encoded file content or URL
      filename,       // Original filename
      mimeType,       // MIME type (application/pdf, image/jpeg, etc.)
      documentId,     // Optional: existing document ID to update
      url,            // Alternative: URL to document
      maxWaitMs = 60000, // Max time to wait for OCR completion
    } = await req.json();

    // Validate required fields
    if (!content && !url) {
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

    // Check if OCR is needed
    if (!needsOCR(mimeType || "", filename || "")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "File type does not require OCR. Use for PDFs and images only.",
          needsOCR: false,
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

    // Get Azure configuration
    const azureConfig = getAzureConfig();

    // Submit document for analysis
    const operationUrl = await submitForAnalysis(
      azureConfig,
      url || content,
      mimeType || "application/pdf"
    );

    // Poll for results
    const analyzeResult = await pollForResults(azureConfig, operationUrl, maxWaitMs);

    // Extract structured results
    const ocrResult = extractResults(analyzeResult);
    ocrResult.processingTimeMs = Date.now() - startTime;

    console.log(`OCR completed: ${ocrResult.pageCount} pages, ${ocrResult.wordCount} words, ${ocrResult.confidence.toFixed(2)} confidence`);

    // Prepare response
    const result = {
      success: true,
      ocr: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        pageCount: ocrResult.pageCount,
        wordCount: ocrResult.wordCount,
        processingTimeMs: ocrResult.processingTimeMs,
        modelId: ocrResult.modelId,
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
          ocr_provider: "azure_document_intelligence",
          processing_duration_ms: ocrResult.processingTimeMs,
          processed_at: new Date().toISOString(),
          extracted_data: {
            ocr: {
              pageCount: ocrResult.pageCount,
              wordCount: ocrResult.wordCount,
              confidence: ocrResult.confidence,
              modelId: ocrResult.modelId,
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
