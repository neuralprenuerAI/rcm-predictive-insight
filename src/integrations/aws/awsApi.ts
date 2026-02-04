/**
 * AWS API Gateway Client
 * Drop-in replacement for supabase.functions.invoke()
 * Auto-injects user_id from Supabase auth session into every request.
 */

import { supabase } from "@/integrations/supabase/client";

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
    // Get current user from Supabase auth
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Inject user_id into the request body
    let requestBody: Record<string, unknown> = {};
    if (options.body && typeof options.body === 'object' && !Array.isArray(options.body)) {
      requestBody = { ...(options.body as Record<string, unknown>) };
    } else if (options.body) {
      requestBody = { data: options.body };
    }

    // Add user_id if we have a session (don't override if already provided)
    if (userId && !requestBody.user_id) {
      requestBody.user_id = userId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        ...(options.headers || {}),
      },
      body: JSON.stringify(requestBody),
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
