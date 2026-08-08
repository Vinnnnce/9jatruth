/**
 * Simple in-memory rate limiter for API routes.
 * Prevents brute force and abuse on sensitive endpoints.
 */

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

/**
 * Check rate limit for a given key (e.g., IP + route).
 * Returns null if allowed, or a Response if rate limited.
 */
export function rateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): Response | null {
  const now = Date.now();

  // Cleanup old entries periodically
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
    lastCleanup = now;
  }

  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (now > bucket.resetAt) {
    bucket.count = 1;
    bucket.resetAt = now + windowMs;
    return null;
  }

  bucket.count++;

  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return Response.json(
      { message: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  return null;
}

/**
 * Get client IP from request headers.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
