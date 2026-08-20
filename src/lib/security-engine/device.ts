/**
 * Zero-Trust: Device Fingerprinting
 * ============================================================
 * Produces a stable, privacy-preserving device fingerprint from request
 * attributes (user-agent, accept-headers, sec-ch-ua, timezone, platform). The
 * fingerprint is a SHA-256 hash — it cannot be reversed to identify a person,
 * but it is stable enough to correlate sessions from the same device for risk
 * scoring and botnet graph construction.
 *
 * Zero-trust principle: every request is treated as untrusted. The fingerprint
 * is combined with IP, ASN, and behavior signals to compute a continuous risk
 * score; high-risk requests are challenged or blocked regardless of auth state.
 */

import crypto from "node:crypto";

export interface DeviceAttributes {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  platform?: string;
  mobile?: boolean;
  timezone?: string;
  screenHint?: string;
}

/**
 * Extract stable device attributes from a request's headers.
 */
export function extractDeviceAttributes(request: Request): DeviceAttributes {
  const headers = request.headers;
  return {
    userAgent: headers.get("user-agent") || "",
    acceptLanguage: headers.get("accept-language") || "",
    acceptEncoding: headers.get("accept-encoding") || "",
    platform: headers.get("sec-ch-ua-platform") || undefined,
    mobile: headers.get("sec-ch-ua-mobile") === "?1",
    timezone: headers.get("sec-ch-ua-timezone") || undefined,
    screenHint: headers.get("sec-ch-ua-form-factor") || undefined,
  };
}

/**
 * Compute a stable device fingerprint hash from request headers + IP.
 * Adding the /24 IP subnet keeps the fingerprint stable within a network but
 * distinct across networks (resists fingerprint sharing across botnets).
 */
export async function computeDeviceFingerprint(
  request: Request,
  ip: string | null
): Promise<string> {
  const attrs = extractDeviceAttributes(request);
  const ipSubnet = ip ? ip.split(".").slice(0, 3).join(".") : "unknown";
  const payload = [
    attrs.userAgent,
    attrs.acceptLanguage,
    attrs.acceptEncoding,
    attrs.platform || "",
    attrs.mobile ? "mobile" : "desktop",
    attrs.timezone || "",
    ipSubnet,
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Lighter-weight fingerprint for client-side collection (posted to the server
 * on session start). The server recomputes and compares to detect tampering.
 */
export function computeClientFingerprint(attrs: DeviceAttributes): string {
  const payload = [
    attrs.userAgent,
    attrs.acceptLanguage,
    attrs.acceptEncoding,
    attrs.platform || "",
    attrs.mobile ? "mobile" : "desktop",
    attrs.timezone || "",
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Heuristic bot detection from the user-agent alone. Real browsers have
 * consistent header sets; headless browsers and HTTP libraries often don't.
 */
export function isLikelyBot(request: Request): { bot: boolean; reason: string } {
  const headers = request.headers;
  const ua = headers.get("user-agent") || "";

  if (!ua) return { bot: true, reason: "missing_user_agent" };
  if (/bot|crawl|spider|curl|wget|python|scrapy|headless|phantom|puppeteer|playwright/i.test(ua)) {
    return { bot: true, reason: "bot_user_agent" };
  }
  // Real browsers send accept-language; most HTTP libraries don't.
  if (!headers.get("accept-language")) return { bot: true, reason: "missing_accept_language" };
  if (!headers.get("accept-encoding")) return { bot: true, reason: "missing_accept_encoding" };

  return { bot: false, reason: "headers_consistent" };
}
