/**
 * CSRF / same-origin protection helpers.
 *
 * These are intentionally simple, framework-agnostic checks that verify a
 * mutating request (POST/PUT/PATCH/DELETE) originated from the same host as
 * the API. They complement Clerk's session-based auth — they do NOT replace it.
 *
 * Usage in a mutating API handler:
 *
 *   import { csrfCheck } from "@/lib/security";
 *   const csrfError = csrfCheck(request);
 *   if (csrfError) return csrfError;
 */

/**
 * Returns true when the request's `origin` header resolves to the same host as
 * the request's `host` header. Returns false when either header is missing or
 * when the hosts differ.
 */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

/**
 * Rejects cross-origin mutating requests. Returns `null` when the request is
 * allowed to proceed (safe method or same-origin), otherwise returns a 403
 * Response that the handler should return immediately.
 */
export function csrfCheck(request: Request): Response | null {
  if (request.method === "GET" || request.method === "HEAD") return null;
  if (!assertSameOrigin(request)) {
    return Response.json({ message: "Cross-origin request blocked" }, { status: 403 });
  }
  return null;
}
