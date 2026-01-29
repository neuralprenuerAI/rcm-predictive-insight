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

    const apiKey = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (!apiKey) {
      throw new Error("CloudConvert API key not configured. Please add CLOUDCONVERT_API_KEY to secrets.");
    }

    console.log(`[convert-oxps] Starting CloudConvert conversion for: ${filename}`);

    // Step 1: Create a job with import, convert, and export tasks
    const jobResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tasks: {
          "import-my-file": {
            operation: "import/base64",
            file: content,
            filename: filename
          },
          "convert-my-file": {
            operation: "convert",
            input: "import-my-file",
            output_format: "pdf"
          },
          "export-my-file": {
            operation: "export/url",
            input: "convert-my-file",
            inline: false,
            archive_multiple_files: false
          }
        }
      })
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      console.error("[convert-oxps] CloudConvert job creation failed:", errorText);
      throw new Error(`CloudConvert API error: ${jobResponse.status} - ${errorText}`);
    }

    const jobData = await jobResponse.json();
    const jobId = jobData.data.id;
    console.log(`[convert-oxps] Job created: ${jobId}`);

    // Step 2: Poll for job completion (max 60 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    let completedJob = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      const statusData = await statusResponse.json();
      const status = statusData.data.status;

      console.log(`[convert-oxps] Job status (attempt ${attempts + 1}): ${status}`);

      if (status === "finished") {
        completedJob = statusData.data;
        break;
      } else if (status === "error") {
        const errorTask = statusData.data.tasks.find((t: { status: string; message?: string }) => t.status === "error");
        throw new Error(`Conversion failed: ${errorTask?.message || "Unknown error"}`);
      }

      attempts++;
    }

    if (!completedJob) {
      throw new Error("Conversion timed out after 60 seconds");
    }

    // Step 3: Get the export task and download URL
    const exportTask = completedJob.tasks.find((t: { name: string; result?: { files?: { url: string }[] } }) => t.name === "export-my-file");
    if (!exportTask || !exportTask.result?.files?.[0]?.url) {
      throw new Error("No export URL found in completed job");
    }

    const downloadUrl = exportTask.result.files[0].url;
    console.log("[convert-oxps] Downloading converted PDF...");

    // Step 4: Download the converted PDF
    const pdfResponse = await fetch(downloadUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download converted PDF: ${pdfResponse.status}`);
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    
    // Convert to base64 in chunks to avoid call stack limits
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    console.log(`[convert-oxps] Conversion successful, PDF size: ${pdfArrayBuffer.byteLength} bytes`);

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
