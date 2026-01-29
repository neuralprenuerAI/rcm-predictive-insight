import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConvertRequest {
  content: string; // Base64 encoded OXPS file
  filename: string;
}

// Decode common XML entities
const decodeXmlEntities = (input: string): string =>
  input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

// Convert Uint8Array to base64 in chunks
const uint8ToBase64 = (bytes: Uint8Array): string => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

// Extract text from OXPS/XPS FixedPage XML
const extractTextFromXml = (xml: string): string[] => {
  const lines: string[] = [];
  
  // Pattern 1: UnicodeString attribute (most common)
  const unicodeMatches = xml.matchAll(/UnicodeString="([^"]*)"/g);
  for (const match of unicodeMatches) {
    const decoded = decodeXmlEntities(match[1]).trim();
    if (decoded) lines.push(decoded);
  }
  
  // Pattern 2: Glyphs with Indices (character positions)
  const glyphMatches = xml.matchAll(/<Glyphs[^>]*UnicodeString="([^"]*)"[^>]*>/g);
  for (const match of glyphMatches) {
    const decoded = decodeXmlEntities(match[1]).trim();
    if (decoded && !lines.includes(decoded)) lines.push(decoded);
  }
  
  // Pattern 3: Path with text data
  const pathMatches = xml.matchAll(/<Path[^>]*Data="([^"]*)"[^>]*>/g);
  for (const match of pathMatches) {
    // Skip vector paths, only look for text-like content
    if (match[1].length < 500 && /[A-Za-z]{3,}/.test(match[1])) {
      const decoded = decodeXmlEntities(match[1]).trim();
      if (decoded) lines.push(decoded);
    }
  }
  
  return lines;
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

    // Decode base64 and load as ZIP archive
    const binaryContent = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    const zip = await JSZip.loadAsync(binaryContent);
    
    const allPaths = Object.keys(zip.files);
    console.log(`[convert-oxps] Archive contains ${allPaths.length} files`);

    // First, try to find embedded images (PNG, JPEG, TIFF)
    const imageFiles: { path: string; content: Uint8Array; mimeType: string }[] = [];
    
    for (const [path, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const lowerPath = path.toLowerCase();
      
      if (lowerPath.endsWith('.png') || 
          lowerPath.endsWith('.jpg') || 
          lowerPath.endsWith('.jpeg') ||
          lowerPath.endsWith('.tif') ||
          lowerPath.endsWith('.tiff')) {
        const bytes = await file.async("uint8array");
        let mimeType = "image/png";
        if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mimeType = "image/jpeg";
        else if (lowerPath.endsWith('.tif') || lowerPath.endsWith('.tiff')) mimeType = "image/tiff";
        
        imageFiles.push({ path, content: bytes, mimeType });
      }
    }

    // If we found images, use the largest one directly
    if (imageFiles.length > 0) {
      imageFiles.sort((a, b) => b.content.length - a.content.length);
      const mainImage = imageFiles[0];
      
      console.log(`[convert-oxps] Found ${imageFiles.length} images, using: ${mainImage.path}`);
      
      let ext = ".png";
      if (mainImage.mimeType === "image/jpeg") ext = ".jpg";
      else if (mainImage.mimeType === "image/tiff") ext = ".tiff";
      
      return new Response(
        JSON.stringify({
          success: true,
          content: uint8ToBase64(mainImage.content),
          mimeType: mainImage.mimeType,
          originalFilename: filename,
          convertedFilename: filename.replace(/\.(oxps|xps)$/i, ext),
          conversionMode: "image-extraction"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No images found - extract text from FixedPage XML files
    console.log("[convert-oxps] No raster images found, extracting text from XML...");
    
    const fixedPageFiles = allPaths
      .filter(p => {
        const lp = p.toLowerCase();
        return (lp.includes("pages") || lp.includes("fixeddocument") || lp.includes("documents")) &&
               (lp.endsWith(".fpage") || lp.endsWith(".xml"));
      })
      .sort();

    console.log(`[convert-oxps] Found ${fixedPageFiles.length} FixedPage files`);
    
    const allTextLines: string[] = [];
    
    for (const pagePath of fixedPageFiles.slice(0, 50)) { // Limit to 50 pages
      const xmlContent = await zip.file(pagePath)?.async("string");
      if (!xmlContent) continue;
      
      const lines = extractTextFromXml(xmlContent);
      allTextLines.push(...lines);
    }

    // Remove duplicates while preserving order
    const uniqueLines = [...new Set(allTextLines)];
    const extractedText = uniqueLines.join("\n");

    console.log(`[convert-oxps] Extracted ${uniqueLines.length} unique text lines, ${extractedText.length} chars`);

    if (!extractedText.trim()) {
      // Last resort: list file structure for debugging
      const sampleFiles = allPaths.slice(0, 30).join(", ");
      throw new Error(
        `No extractable content found in OXPS file. ` +
        `The file may contain only vector graphics or use unsupported formats (WDP/HD Photo). ` +
        `Sample files: ${sampleFiles}`
      );
    }

    // Create a PDF with the extracted text (Textract can OCR this)
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const fontSize = 10;
    const margin = 50;
    const lineHeight = 14;
    const pageWidth = 612; // US Letter
    const pageHeight = 792;
    const maxCharsPerLine = 90;
    const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);

    // Word-wrap and paginate text
    const wrappedLines: string[] = [];
    for (const line of uniqueLines) {
      if (line.length <= maxCharsPerLine) {
        wrappedLines.push(line);
      } else {
        // Simple word wrap
        const words = line.split(/\s+/);
        let currentLine = "";
        for (const word of words) {
          if ((currentLine + " " + word).length > maxCharsPerLine) {
            if (currentLine) wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + " " + word : word;
          }
        }
        if (currentLine) wrappedLines.push(currentLine);
      }
    }

    // Create pages
    let pageIndex = 0;
    while (pageIndex * linesPerPage < wrappedLines.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const pageLines = wrappedLines.slice(
        pageIndex * linesPerPage,
        (pageIndex + 1) * linesPerPage
      );
      
      let y = pageHeight - margin;
      for (const line of pageLines) {
        // Filter out non-printable characters
        const safeLine = line.replace(/[^\x20-\x7E]/g, "");
        if (safeLine) {
          page.drawText(safeLine, {
            x: margin,
            y: y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
        y -= lineHeight;
      }
      
      pageIndex++;
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = uint8ToBase64(pdfBytes);

    console.log(`[convert-oxps] Created PDF with ${pdfDoc.getPageCount()} pages, ${pdfBytes.length} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        content: pdfBase64,
        mimeType: "application/pdf",
        originalFilename: filename,
        convertedFilename: filename.replace(/\.(oxps|xps)$/i, ".pdf"),
        conversionMode: "text-to-pdf",
        extractedLines: wrappedLines.length,
        pageCount: pdfDoc.getPageCount()
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
