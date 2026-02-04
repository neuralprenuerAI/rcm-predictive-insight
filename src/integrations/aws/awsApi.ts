/**
 * AWS API Gateway Client
 * Drop-in replacement for supabase.functions.invoke()
 */

const AWS_API_URL = import.meta.env.VITE_AWS_API_URL;

interface InvokeOptions {
  body?: Record<string, unknown> | unknown;
  headers?: Record<string, string>;
}

interface InvokeResult<T = any> {
  data: T | null;
  error: Error | null;
}

async function invoke<T = any>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const url = `${AWS_API_URL}/functions/v1/${functionName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data: T | null = null;

    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }

    if (!response.ok) {
      return {
        data: null,
        error: new Error(
          (data as Record<string, string>)?.error ||
          (data as Record<string, string>)?.message ||
          `HTTP ${response.status}: ${response.statusText}`
        ),
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

export const awsApi = { invoke };
