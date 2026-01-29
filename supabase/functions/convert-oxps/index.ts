import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConvertRequest {
  content: string; // Base64 encoded OXPS file
  filename: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, filename } = await req.json() as ConvertRequest;
    
    if (!content) {
      throw new Error("No file content provided");
    }

    const apiKey = Deno.env.get("CONVERTIO_API_KEY");
    if (!apiKey) {
      throw new Error("Convertio API key not configured. Please add CONVERTIO_API_KEY to secrets.");
    }

    console.log("[convert-oxps] Starting OXPS to PDF conversion via Convertio for:", filename);

    // Step 1: Start conversion
    const startResponse = await fetch("https://api.convertio.co/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apikey: apiKey,
        input: "base64",
        file: content,
        filename: filename,
        outputformat: "pdf"
      })
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      console.error("[convert-oxps] Convertio start failed:", errorText);
      throw new Error(`Convertio API error: ${startResponse.status} - ${errorText}`);
    }

    const startData = await startResponse.json();
    
    if (startData.status !== "ok") {
      throw new Error(`Convertio error: ${startData.error || "Unknown error"}`);
    }

    const conversionId = startData.data.id;
    console.log("[convert-oxps] Conversion started, ID:", conversionId);

    // Step 2: Poll for completion (max 120 seconds)
    let attempts = 0;
    const maxAttempts = 60;
    let resultData = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await fetch(`https://api.convertio.co/convert/${conversionId}/status`, {
        headers: {
          "Content-Type": "application/json"
        }
      });

      const statusData = await statusResponse.json();
      
      if (statusData.status !== "ok") {
        throw new Error(`Status check failed: ${statusData.error || "Unknown error"}`);
      }

      const step = statusData.data.step;
      console.log(`[convert-oxps] Conversion status (attempt ${attempts + 1}):`, step);

      if (step === "finish") {
        resultData = statusData.data;
        break;
      } else if (step === "error") {
        throw new Error(`Conversion failed: ${statusData.data.error || "Unknown error"}`);
      }

      attempts++;
    }

    if (!resultData) {
      throw new Error("Conversion timed out after 120 seconds");
    }

    // Step 3: Download the converted file
    const downloadUrl = resultData.output.url;
    console.log("[convert-oxps] Downloading converted PDF...");

    const pdfResponse = await fetch(downloadUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    console.log("[convert-oxps] Conversion successful, PDF size:", pdfArrayBuffer.byteLength, "bytes");

    // Step 4: Delete the conversion (cleanup)
    try {
      await fetch(`https://api.convertio.co/convert/${conversionId}`, {
        method: "DELETE"
      });
      console.log("[convert-oxps] Cleanup successful");
    } catch (e) {
      console.warn("[convert-oxps] Failed to cleanup conversion:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: pdfBase64,
        mimeType: "application/pdf",
        originalFilename: filename,
        convertedFilename: filename.replace(/\.(oxps|xps)$/i, ".pdf")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to convert OXPS file";
    console.error("[convert-oxps] Conversion error:", errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
