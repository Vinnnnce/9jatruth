/**
 * Shared API helpers for Next.js Route Handlers.
 *
 * - getUserId:   Clerk user id (hashed for privacy), with a dev fallback.
 * - getClientIp: extract client IP from request headers (Vercel/Next).
 * - hashIp:      SHA-256 hash of an IP for privacy-preserving storage.
 * - sanitizeText: strip HTML/JS to prevent XSS.
 * - validate:    Zod validation returning { success, data?, error? }.
 */

import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import type { ZodSchema } from "zod";

/**
 * Get the authenticated user's identity hash.
 *
 * Uses the Clerk user id when available. The id is hashed (SHA-256, truncated)
 * to produce a stable `dev_XXXX` style userHash, mirroring the original
 * X-Visitor-Id derivation. Falls back to a dev identity when unauthenticated
 * (e.g. public endpoints in development).
 */
export async function getUserId(_request?: Request): Promise<string> {
  try {
    const { userId } = await auth();
    if (userId) {
      const hash = crypto.createHash("sha256").update(userId).digest("hex");
      return `dev_${hash.substring(0, 12)}`;
    }
  } catch {
    // auth() can throw outside of a request context; fall through to dev fallback
  }
  return "dev_1d6e";
}

/**
 * Look up the Clerk user id (raw, unhashed) for the current request.
 * Returns null when not authenticated.
 */
export async function getClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract the client's real IP from request headers.
 * Checks x-forwarded-for, x-real-ip, and cf-connecting-ip (Cloudflare).
 */
export function getClientIp(request: Request): string | null {
  const headers = request.headers;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  return null;
}

/**
 * Hash an IP address using SHA-256 for privacy-preserving storage.
 */
export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Get IP-based location info from a request (privacy-preserving).
 * Returns hashed IP and approximate region/city/coordinates via ipapi.co.
 */
export async function getIpLocation(request: Request): Promise<{
  ipHash: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  ipLat: number | null;
  ipLng: number | null;
}> {
  const ip = getClientIp(request);

  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return { ipHash: null, ipRegion: null, ipCity: null, ipLat: null, ipLng: null };
  }

  const ipHash = hashIp(ip);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ipHash, ipRegion: null, ipCity: null, ipLat: null, ipLng: null };
    }

    const data = (await response.json()) as any;
    return {
      ipHash,
      ipRegion: data.region || null,
      ipCity: data.city || null,
      ipLat: typeof data.latitude === "number" ? data.latitude : null,
      ipLng: typeof data.longitude === "number" ? data.longitude : null,
    };
  } catch {
    return { ipHash, ipRegion: null, ipCity: null, ipLat: null, ipLng: null };
  }
}

/**
 * Sanitize text content to prevent XSS and injection.
 * Strips HTML tags, javascript: URIs, and inline event handlers.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * Validate a value against a Zod schema.
 * Returns { success, data } on success or { success, error } on failure
 * with a structured error payload suitable for a 400 response.
 */
export function validate<T>(schema: ZodSchema<T>, value: unknown):
  | { success: true; data: T }
  | { success: false; error: { message: string; errors: Array<{ path: string; message: string }> } } {
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      error: {
        message: "Validation error",
        errors: result.error.issues.map((e: any) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    };
  }
  return { success: true, data: result.data };
}

/**
 * Map a Zod issue array (any shape) to the structured { path, message } form.
 */
export function mapZodIssues(issues: any[]): Array<{ path: string; message: string }> {
  return issues.map((e: any) => ({
    path: Array.isArray(e.path) ? e.path.join(".") : typeof e.path === "string" ? e.path : "",
    message: e.message,
  }));
}

/**
 * Return a JSON Response for validation errors.
 * Accepts either the structured error shape from `validate` or a raw
 * Zod issue array (which is mapped to { path, message }).
 */
export function validationErrorResponse(
  error: { message: string; errors: any[] }
): Response {
  return Response.json(
    { message: error.message, errors: mapZodIssues(error.errors) },
    { status: 400 }
  );
}

/**
 * Require an authenticated Clerk user; returns the clerk user id or a 401 Response.
 */
export async function requireClerkAuth(): Promise<{ userId: string } | { error: Response }> {
  const userId = await getClerkUserId();
  if (!userId) {
    return { error: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  return { userId };
}
