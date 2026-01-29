import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

    console.log(`[convert-oxps] Processing file: ${filename}`);

    // OXPS/XPS is a ZIP archive containing images
    const binaryContent = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    const zip = await JSZip.loadAsync(binaryContent);

    // Find all image files in the archive
    const imageFiles: { name: string; content: string; mimeType: string }[] = [];

    for (const [path, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const lowerPath = path.toLowerCase();

      // Look for images in Resources or Pages folders
      if (lowerPath.endsWith('.png') ||
          lowerPath.endsWith('.jpg') ||
          lowerPath.endsWith('.jpeg') ||
          lowerPath.endsWith('.tif') ||
          lowerPath.endsWith('.tiff')) {

        const imageBytes = await file.async("base64");

        let mimeType = "image/png";
        if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
          mimeType = "image/jpeg";
        } else if (lowerPath.endsWith('.tif') || lowerPath.endsWith('.tiff')) {
          mimeType = "image/tiff";
        }

        imageFiles.push({
          name: path,
          content: imageBytes,
          mimeType: mimeType
        });
      }
    }

    if (imageFiles.length === 0) {
      throw new Error("No images found in OXPS/XPS file");
    }

    // Sort by content length to get the largest (most detailed) image
    imageFiles.sort((a, b) => b.content.length - a.content.length);

    const mainImage = imageFiles[0];

    console.log(`[convert-oxps] Found ${imageFiles.length} images, using: ${mainImage.name} (${mainImage.mimeType})`);

    // Determine file extension based on mimeType
    let ext = ".png";
    if (mainImage.mimeType === "image/jpeg") ext = ".jpg";
    else if (mainImage.mimeType === "image/tiff") ext = ".tiff";

    return new Response(
      JSON.stringify({
        success: true,
        content: mainImage.content,
        mimeType: mainImage.mimeType,
        originalFilename: filename,
        convertedFilename: filename.replace(/\.(oxps|xps)$/i, ext),
        totalImages: imageFiles.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[convert-oxps] Conversion error:", errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
