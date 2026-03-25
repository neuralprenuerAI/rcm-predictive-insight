/**
 * Generic async job polling helper.
 * If an awsApi response contains { async: true, job_id }, polls rcm-job-status
 * every 3s until complete (up to 60 attempts = 3 minutes).
 */

import { awsApi } from "@/integrations/aws/awsApi";

interface AsyncResponse {
  async?: boolean;
  job_id?: string;
  [key: string]: unknown;
}

interface JobStatusResponse {
  status: "processing" | "complete" | "error";
  result?: unknown;
  error?: string;
}

/**
 * Resolves an API response that may be async.
 * If the response has async: true and job_id, polls until complete.
 * Otherwise returns the data as-is.
 */
export async function resolveAsyncResponse<T = any>(
  data: AsyncResponse | null,
  onPoll?: (attempt: number) => void,
  maxAttempts = 60
): Promise<T> {
  if (!data) throw new Error("No response data");

  if (data.async && data.job_id) {
    const jobId = data.job_id;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      onPoll?.(i + 1);

      const { data: pollData, error: pollError } = await awsApi.invoke<JobStatusResponse>(
        "rcm-job-status",
        { body: { job_id: jobId } }
      );

      if (pollError) {
        console.warn(`Job status poll ${i + 1} failed:`, pollError.message);
        continue; // silent retry on network errors
      }

      if (pollData?.status === "complete") {
        return (pollData.result ?? pollData) as T;
      }

      if (pollData?.status === "error") {
        throw new Error(pollData.error || "Async job failed");
      }
      // status === "processing" → continue
    }
    throw new Error("Sync timed out after 3 minutes");
  }

  return data as T;
}
