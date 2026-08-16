/**
 * QueryClient setup for TanStack Query in Next.js.
 * Uses relative API paths so it works in both dev and production.
 */

import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Parse a server error message from an apiRequest Error.
 * The error message format is "STATUS: {\"message\":\"...\",\"errors\":[...]}
 * or "STATUS: plain text". This extracts a clean, user-facing message.
 */
export function parseApiError(error: Error | unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const idx = msg.indexOf(":");
  let body = idx > 0 ? msg.substring(idx + 1).trim() : msg;
  try {
    const parsed = JSON.parse(body);
    if (parsed.message && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      // Validation error — show field-specific messages
      const fieldErrors = parsed.errors
        .map((e: { path?: string; message?: string }) => {
          const field = e.path ? e.path.replace(/_/g, " ") : "";
          return field ? `${field}: ${e.message}` : e.message;
        })
        .join("; ");
      return `${parsed.message} — ${fieldErrors}`;
    }
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON — return cleaned text
  }
  // Strip leading status code if present
  return body.replace(/^\d{3}:\s*/, "") || msg;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: getQueryFn({ on401: "returnNull" }),
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export const queryClient = getQueryClient();
