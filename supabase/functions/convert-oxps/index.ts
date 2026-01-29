import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConvertRequest {
  content: string; // Base64 encoded OXPS file
  filename: string;
}

const decodeXmlEntities = (input: string) =>
  input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    // Numeric entities
    .replaceAll(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const uint8ToBase64 = (bytes: Uint8Array) => {
  // btoa expects binary string; chunk to avoid call stack limits.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

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

    const allPaths = Object.keys(zip.files);
    console.log(`[convert-oxps] Archive entries: ${allPaths.length}`);

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
      // Many OXPS files are vector-based (no embedded PNG/JPEG/TIFF). In that case,
      // extract text from FixedPage XML and build a simple PDF that Textract accepts.
      const fixedPageCandidates = allPaths
        .filter((p) => {
          const lp = p.toLowerCase();
          return (
            (lp.includes("pages") || lp.includes("fixedpage")) &&
            (lp.endsWith(".fpage") || lp.endsWith(".xml"))
          );
        })
        .sort();

      console.warn(
        `[convert-oxps] No raster images found. FixedPage candidates: ${fixedPageCandidates.length}`,
      );

      let extractedText = "";
      for (const pagePath of fixedPageCandidates.slice(0, 25)) {
        const xml = await zip.file(pagePath)?.async("string");
        if (!xml) continue;

        // Common XPS/OXPS text representation.
        const matches = xml.match(/UnicodeString="([^"]*)"/g) || [];
        for (const m of matches) {
          const raw = m.replace('UnicodeString="', "").replace('"', "");
          const decoded = decodeXmlEntities(raw);
          if (decoded.trim()) extractedText += decoded + "\n";
        }
      }

      extractedText = extractedText.trim();
      if (!extractedText) {
        // Add extra diagnostics to help identify unsupported embedded formats (e.g., WDP/JXR)
        const interesting = allPaths
          .map((p) => p.toLowerCase())
          .filter((p) =>
            p.endsWith(".wdp") ||
            p.endsWith(".jxr") ||
            p.endsWith(".rels") ||
            p.endsWith(".fpage") ||
            p.endsWith(".xml"),
          )
          .slice(0, 50);

        throw new Error(
          `No images found in OXPS/XPS file and no extractable text found in FixedPage XML. ` +
            `This file may be pure vector content or use unsupported embedded image formats (e.g., .wdp/.jxr). ` +
            `Sample entries: ${interesting.join(", ")}`,
        );
      }

      // Build a minimal PDF with extracted text so Textract can process it.
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage([612, 792]); // US Letter
      const fontSize = 10;
      const margin = 48;
      const lineHeight = 12;
      const maxLines = Math.floor((792 - margin * 2) / lineHeight);

      const lines = extractedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, maxLines);

      let y = 792 - margin - fontSize;
      for (const line of lines) {
        // Keep within page width (rough wrap)
        const safe = line.length > 140 ? line.slice(0, 140) + "…" : line;
        page.drawText(safe, { x: margin, y, size: fontSize, font });
        y -= lineHeight;
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = uint8ToBase64(pdfBytes);

      console.log(
        `[convert-oxps] Fallback PDF created from extracted text. chars=${extractedText.length} lines=${lines.length}`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          content: pdfBase64,
          mimeType: "application/pdf",
          originalFilename: filename,
          convertedFilename: filename.replace(/\.(oxps|xps)$/i, ".pdf"),
          totalImages: 0,
          extractedTextChars: extractedText.length,
          conversionMode: "text-to-pdf",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
