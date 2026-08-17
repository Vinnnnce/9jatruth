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
 * the request's `host` header. Returns true when the `origin` header is missing
 * (same-origin requests in some browsers omit it). Returns false only when both
 * headers are present and the hosts differ.
 *
 * On Vercel, also checks `x-forwarded-host` since the `host` header may be
 * an internal Vercel proxy address.
 */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // If no Origin header, allow (same-origin GET-triggered mutations in some browsers)
  if (!origin) return true;

  // Build the set of valid hosts from multiple headers
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const validHosts = new Set<string>();
  if (host) validHosts.add(host);
  if (forwardedHost) {
    // x-forwarded-host can be comma-separated; take the first
    validHosts.add(forwardedHost.split(",")[0].trim());
  }

  if (validHosts.size === 0) return true; // Can't verify, allow

  try {
    const url = new URL(origin);
    // Check if the origin host matches any of the valid hosts
    if (validHosts.has(url.host)) return true;
    // Also check if the hostname (without port) matches
    for (const h of validHosts) {
      try {
        const hUrl = new URL(`https://${h}`);
        if (hUrl.hostname === url.hostname) return true;
      } catch {
        // ignore
      }
    }
    return false;
  } catch {
    return true; // Can't parse origin, allow (better UX than blocking)
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
