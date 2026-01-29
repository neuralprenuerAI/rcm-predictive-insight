import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConvertRequest {
  content: string; // Base64 encoded OXPS file
  filename: string;
}

interface PageImage {
  path: string;
  bytes: Uint8Array;
  format: 'png' | 'jpg' | 'tiff';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, filename } = await req.json() as ConvertRequest;

    if (!content) {
      throw new Error("No file content provided");
    }

    console.log(`[convert-oxps] Processing file: ${filename}`);

    // Decode base64 content
    const binaryContent = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    
    // OXPS/XPS files are ZIP archives containing XML and image files
    const zip = await JSZip.loadAsync(binaryContent);

    // Log the structure for debugging
    const fileList = Object.keys(zip.files);
    console.log(`[convert-oxps] Archive contains ${fileList.length} files`);
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Find FixedPage files (the actual pages) - they can be in different locations
    // Common paths: Documents/1/Pages/*.fpage, FixedDocumentSequence/FixedDocument/Pages/*.fpage
    const pageFiles = fileList
      .filter(name => 
        (name.includes("Pages") || name.includes("pages")) && 
        (name.endsWith(".fpage") || name.endsWith(".xml"))
      )
      .sort();

    console.log(`[convert-oxps] Found ${pageFiles.length} page files`);

    // Track extracted images
    const pageImages: PageImage[] = [];

    // Extract images from the archive
    // Images are typically in Resources folders
    const imageFiles = fileList.filter(name => {
      const lower = name.toLowerCase();
      return lower.endsWith('.png') || 
             lower.endsWith('.jpg') || 
             lower.endsWith('.jpeg') || 
             lower.endsWith('.tiff') ||
             lower.endsWith('.tif');
    });

    console.log(`[convert-oxps] Found ${imageFiles.length} image files`);

    // Load all images into memory
    for (const imagePath of imageFiles) {
      const imageFile = zip.file(imagePath);
      if (imageFile) {
        const imageBytes = await imageFile.async("uint8array");
        const lower = imagePath.toLowerCase();
        let format: 'png' | 'jpg' | 'tiff' = 'png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          format = 'jpg';
        } else if (lower.endsWith('.tiff') || lower.endsWith('.tif')) {
          format = 'tiff';
        }
        pageImages.push({ path: imagePath, bytes: imageBytes, format });
      }
    }

    // Process each page file to find image references
    let pagesAdded = 0;

    for (const pageFile of pageFiles) {
      try {
        const pageContent = await zip.file(pageFile)?.async("string");
        if (!pageContent) continue;

        // Extract image references from the page XML
        // OXPS uses ImageSource attribute to reference images
        const imageMatches = pageContent.match(/ImageSource="([^"]+)"/g) || [];
        
        // Also check for Path.Fill patterns with ImageBrush
        const brushMatches = pageContent.match(/ImageSource\s*=\s*"([^"]+)"/g) || [];
        const allMatches = [...imageMatches, ...brushMatches];

        // Get page dimensions from the XML
        const widthMatch = pageContent.match(/Width="([\d.]+)"/);
        const heightMatch = pageContent.match(/Height="([\d.]+)"/);
        const pageWidth = widthMatch ? parseFloat(widthMatch[1]) : 612; // Default to letter size
        const pageHeight = heightMatch ? parseFloat(heightMatch[1]) : 792;

        if (allMatches.length > 0) {
          for (const match of allMatches) {
            const imagePath = match
              .replace(/ImageSource\s*=\s*"/, '')
              .replace('"', '')
              .replace(/^\//, ''); // Remove leading slash

            // Find the image in our loaded images
            const pageImage = pageImages.find(img => 
              img.path === imagePath || 
              img.path.endsWith(imagePath) ||
              imagePath.endsWith(img.path.split('/').pop() || '')
            );

            if (pageImage) {
              try {
                let image;
                if (pageImage.format === 'png') {
                  image = await pdfDoc.embedPng(pageImage.bytes);
                } else if (pageImage.format === 'jpg') {
                  image = await pdfDoc.embedJpg(pageImage.bytes);
                }
                // Note: TIFF requires conversion, pdf-lib doesn't support it directly

                if (image) {
                  // Use image dimensions or page dimensions
                  const imgWidth = image.width;
                  const imgHeight = image.height;
                  
                  const page = pdfDoc.addPage([
                    Math.max(imgWidth, pageWidth),
                    Math.max(imgHeight, pageHeight)
                  ]);
                  
                  page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: imgWidth,
                    height: imgHeight,
                  });
                  pagesAdded++;
                }
              } catch (embedError) {
                console.warn(`[convert-oxps] Failed to embed image ${imagePath}:`, embedError);
              }
            }
          }
        } else {
          // No image references found in this page - might be vector content
          // Add a placeholder page
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawText(`Page from OXPS document - vector content not supported`, {
            x: 50,
            y: pageHeight - 50,
            size: 12,
            color: rgb(0.5, 0.5, 0.5),
          });
          pagesAdded++;
        }
      } catch (pageError) {
        console.warn(`[convert-oxps] Error processing page ${pageFile}:`, pageError);
      }
    }

    // If no pages were added from page files, try adding all images as pages
    if (pagesAdded === 0 && pageImages.length > 0) {
      console.log(`[convert-oxps] No pages from fpage files, adding ${pageImages.length} images directly`);
      
      for (const pageImage of pageImages) {
        try {
          let image;
          if (pageImage.format === 'png') {
            image = await pdfDoc.embedPng(pageImage.bytes);
          } else if (pageImage.format === 'jpg') {
            image = await pdfDoc.embedJpg(pageImage.bytes);
          }

          if (image) {
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, {
              x: 0,
              y: 0,
              width: image.width,
              height: image.height,
            });
            pagesAdded++;
          }
        } catch (embedError) {
          console.warn(`[convert-oxps] Failed to embed ${pageImage.path}:`, embedError);
        }
      }
    }

    // If still no pages, create a placeholder
    if (pdfDoc.getPageCount() === 0) {
      console.warn(`[convert-oxps] No content extracted, creating placeholder page`);
      const page = pdfDoc.addPage();
      page.drawText("OXPS Conversion Notice", {
        x: 50,
        y: page.getHeight() - 50,
        size: 18,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText("This OXPS file could not be fully converted.", {
        x: 50,
        y: page.getHeight() - 80,
        size: 12,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText("The file may contain vector graphics or unsupported content.", {
        x: 50,
        y: page.getHeight() - 100,
        size: 12,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(`Original file: ${filename}`, {
        x: 50,
        y: page.getHeight() - 130,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(`Archive contained ${fileList.length} files`, {
        x: 50,
        y: page.getHeight() - 150,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log(`[convert-oxps] Conversion complete: ${pdfDoc.getPageCount()} pages, ${pdfBytes.length} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        content: pdfBase64,
        originalFilename: filename,
        convertedFilename: filename.replace(/\.(oxps|xps)$/i, ".pdf"),
        mimeType: "application/pdf",
        pageCount: pdfDoc.getPageCount(),
        originalSize: binaryContent.length,
        convertedSize: pdfBytes.length,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
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
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );
  }
});
