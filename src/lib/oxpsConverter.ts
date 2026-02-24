/**
 * Async OXPS-to-PDF converter with polling pattern.
 * 
 * convert-oxps may return immediately with the result OR
 * return { async: true, job_id } when the conversion is queued.
 * In the async case, we poll rcm-job-status every 3s until complete.
 */

import { awsApi } from "@/integrations/aws/awsApi";

export interface OxpsConversionResult {
  content: string;
  filename: string;
  mimeType: string;
}

interface ConvertResponse {
  success?: boolean;
  async?: boolean;
  job_id?: string;
  content?: string;
  mimeType?: string;
  convertedFilename?: string;
  error?: string;
}

interface JobStatusResponse {
  status: "processing" | "complete" | "error";
  result?: ConvertResponse;
  error?: string;
}

/**
 * Returns true if the file is OXPS/XPS format.
 */
export function isOxpsFile(file: File): boolean {
  const filename = file.name.toLowerCase();
  return (
    filename.endsWith(".oxps") ||
    filename.endsWith(".xps") ||
    file.type === "application/oxps" ||
    file.type === "application/vnd.ms-xpsdocument"
  );
}

/**
 * Poll rcm-job-status until conversion is done.
 */
async function pollForResult(
  jobId: string,
  onPoll?: (attempt: number) => void,
  maxAttempts = 30
): Promise<ConvertResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    onPoll?.(i + 1);

    const { data, error } = await awsApi.invoke<JobStatusResponse>("rcm-job-status", {
      body: { job_id: jobId },
    });

    if (error) {
      throw new Error(`Job status check failed: ${error.message}`);
    }

    if (data?.status === "complete" && data.result) {
      return data.result;
    }

    if (data?.status === "error") {
      throw new Error(data.error || "Conversion failed");
    }
    // status === "processing" → continue polling
  }
  throw new Error("OXPS conversion timed out after 90 seconds");
}

/**
 * Convert an OXPS file to PDF. If the file is not OXPS, returns the original content.
 * Handles both sync and async (polling) responses from the backend.
 *
 * @param file      The original File object
 * @param base64    Base64-encoded file content
 * @param onStatus  Optional callback for progress updates during polling
 */
export async function convertOxpsIfNeeded(
  file: File,
  base64: string,
  onStatus?: (message: string) => void
): Promise<OxpsConversionResult> {
  if (!isOxpsFile(file)) {
    return {
      content: base64,
      filename: file.name,
      mimeType: file.type || "application/pdf",
    };
  }

  onStatus?.("Starting OXPS conversion…");

  const { data, error } = await awsApi.invoke<ConvertResponse>("convert-oxps", {
    body: { content: base64, filename: file.name },
  });

  if (error) {
    throw new Error(`OXPS conversion failed: ${error.message}`);
  }

  // Async path — backend queued the job
  if (data?.async && data?.job_id) {
    onStatus?.("Converting document…");
    const result = await pollForResult(data.job_id, (attempt) => {
      onStatus?.(`Converting document… (${attempt * 3}s)`);
    });

    if (!result.success || !result.content) {
      throw new Error(result.error || "Conversion returned no content");
    }

    return {
      content: result.content,
      filename: result.convertedFilename || file.name.replace(/\.(oxps|xps)$/i, ".pdf"),
      mimeType: result.mimeType || "application/pdf",
    };
  }

  // Sync path — result returned immediately
  if (!data?.success || !data?.content) {
    throw new Error(data?.error || "OXPS conversion failed");
  }

  return {
    content: data.content,
    filename: data.convertedFilename || file.name.replace(/\.(oxps|xps)$/i, ".pdf"),
    mimeType: data.mimeType || "application/pdf",
  };
}
