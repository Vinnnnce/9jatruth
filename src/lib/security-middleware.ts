/**
 * Zero-Trust Security Middleware for Next.js Route Handlers
 * ============================================================
 * Wraps any API route handler with:
 *  - Device fingerprint capture + bot detection
 *  - IP-based blocking (active mitigation actions)
 *  - Rate limiting (per IP + per route)
 *  - Request telemetry recording (behavioral baseline)
 *  - Optional security-pipeline risk scoring
 *  - Structured audit logging of every decision
 *
 * Usage:
 *   import { withSecurity } from "@/lib/security-middleware";
 *   export const POST = withSecurity(async (req, ctx) => { ... }, {
 *     requireAuth: true,
 *     rateLimit: { max: 30, windowMs: 60_000 },
 *   });
 *
 * Zero-trust: the middleware never assumes a request is safe because the user
 * is authenticated. It evaluates risk on every call and can challenge or block
 * even authenticated users when the risk score is high.
 */

import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { getClerkUserId } from "@/lib/api-helpers";
import { hashIp } from "@/lib/api-helpers";
import { ensureDbInitialized } from "@/lib/db";
import { isLikelyBot, computeDeviceFingerprint } from "@/lib/security-engine/device";
import { runSecurityPipeline, buildSecurityContext } from "@/lib/security-engine";
import { isBlocked, recordTelemetry, persistVerdict, upsertDeviceFingerprint } from "@/lib/security-engine/security-storage";
import type { Permission } from "@/lib/security-engine/rbac";
import { resolveMemberPermissions } from "@/lib/security-engine/security-storage";
import { isSuperAdminEmailCheck } from "@/lib/security-engine/rbac";
import { currentUser } from "@clerk/nextjs/server";

export interface SecurityContext {
  ip: string | null;
  ipHash: string | null;
  deviceFingerprint: string | null;
  isBot: boolean;
  botReason: string;
  clerkUserId: string | null;
  email: string | null;
}

export interface SecurityOptions {
  /** Require an authenticated Clerk user. */
  requireAuth?: boolean;
  /** Require a specific permission (RBAC). Super admin always passes. */
  requirePermission?: Permission;
  /** Rate-limit config for this route. */
  rateLimit?: { max: number; windowMs: number };
  /** Run the full security pipeline and persist a verdict. */
  runPipeline?: boolean;
  /** Event type label for audit logging. */
  eventType?: string;
  /** Skip bot blocking (e.g. for webhooks that legitimately have bot-like UAs). */
  allowBots?: boolean;
}

type Handler = (
  request: Request,
  ctx: SecurityContext
) => Promise<Response> | Response;

const JSON_401 = () =>
  Response.json({ message: "Authentication required" }, { status: 401 });
const JSON_403 = (msg: string) =>
  Response.json({ message: msg }, { status: 403 });
const JSON_429 = (retryAfter: number) =>
  Response.json({ message: "Too many requests. Please slow down." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });

/**
 * Wrap a route handler with zero-trust security checks.
 */
export function withSecurity(handler: Handler, options: SecurityOptions = {}) {
  return async (request: Request): Promise<Response> => {
    await ensureDbInitialized().catch(() => {});

    const ip = getClientIP(request);
    const ipHash = ip ? hashIp(ip) : null;

    // ─── 1. Active IP block check ───────────────────────────
    if (ipHash && (await isBlocked(ipHash))) {
      return Response.json(
        { message: "Access temporarily restricted." },
        { status: 403 }
      );
    }

    // ─── 2. Rate limiting ────────────────────────────────────
    if (options.rateLimit) {
      const key = `${options.eventType ?? "route"}:${ipHash ?? "anon"}`;
      const limited = rateLimit(key, options.rateLimit.max, options.rateLimit.windowMs);
      if (limited) {
        const retryAfter = Math.ceil(options.rateLimit.windowMs / 1000);
        return JSON_429(retryAfter);
      }
    }

    // ─── 3. Device fingerprint + bot detection ───────────────
    const { bot, reason } = isLikelyBot(request);
    let deviceFingerprint: string | null = null;
    try {
      deviceFingerprint = ip ? await computeDeviceFingerprint(request, ip) : null;
    } catch {
      // Non-fatal — fingerprinting must never break a request.
    }

    if (deviceFingerprint) {
      await upsertDeviceFingerprint({
        fingerprint: deviceFingerprint,
        ipHash,
        userAgent: request.headers.get("user-agent") ?? undefined,
        platform: request.headers.get("sec-ch-ua-platform") ?? undefined,
        isBot: bot,
        botReason: bot ? reason : undefined,
      }).catch(() => {});
    }

    if (bot && !options.allowBots) {
      // Bots are allowed on read-only public routes only when explicitly opted in.
      // For protected routes, block outright.
      if (options.requireAuth || options.requirePermission) {
        return JSON_403("Automated access is not permitted on this endpoint.");
      }
    }

    // ─── 4. Auth + RBAC ───────────────────────────────────────
    let clerkUserId: string | null = null;
    let email: string | null = null;

    try {
      clerkUserId = await getClerkUserId();
    } catch {
      clerkUserId = null;
    }

    if (clerkUserId) {
      try {
        const user = await currentUser();
        email =
          user?.emailAddresses?.find((e: any) => e.id === user.primaryEmailAddressId)
            ?.emailAddress ||
          user?.emailAddresses?.[0]?.emailAddress ||
          null;
      } catch {
        email = null;
      }
    }

    if (options.requireAuth && !clerkUserId) {
      return JSON_401();
    }

    if (options.requirePermission) {
      const isSuper = isSuperAdminEmailCheck(email);
      if (!isSuper) {
        const { permissions } = await resolveMemberPermissions({
          email,
          clerkUserId,
        });
        if (!permissions.includes(options.requirePermission)) {
          return JSON_403("You don't have permission to perform this action.");
        }
      }
    }

    const ctx: SecurityContext = {
      ip,
      ipHash,
      deviceFingerprint,
      isBot: bot,
      botReason: reason,
      clerkUserId,
      email,
    };

    // ─── 5. Telemetry (behavioral baseline) ───────────────────
    const identity = clerkUserId ?? ipHash ?? "anon";
    const endpoint = new URL(request.url).pathname;
    await recordTelemetry(identity, endpoint).catch(() => {});

    // ─── 6. Optional full pipeline run ───────────────────────
    if (options.runPipeline) {
      try {
        const secCtx = await buildSecurityContext(request, {
          userId: clerkUserId ?? undefined,
        });
        const verdict = await runSecurityPipeline(secCtx);
        if (verdict.shouldBlock) {
          await persistVerdict(verdict, {
            eventType: options.eventType ?? "request_blocked",
            endpoint,
            userAgent: request.headers.get("user-agent") ?? undefined,
          }).catch(() => {});
          return Response.json(
            { message: "Request blocked by security engine.", action: verdict.action },
            { status: 403 }
          );
        }
        // Persist non-blocking verdicts asynchronously (don't delay the response).
        persistVerdict(verdict, {
          eventType: options.eventType ?? "request_scored",
          endpoint,
          userHash: clerkUserId ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        }).catch(() => {});
      } catch (err) {
        // Security pipeline must never break legitimate traffic.
        console.error("[SecurityMiddleware] pipeline error:", err);
      }
    }

    return handler(request, ctx);
  };
}

/**
 * Lightweight guard for super-admin-only routes (used by admin endpoints).
 */
export async function requireSuperAdminOrPermission(
  permission: Permission
): Promise<{ ok: true; email: string | null } | { error: Response }> {
  let email: string | null = null;
  try {
    const user = await currentUser();
    email =
      user?.emailAddresses?.find((e: any) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;
  } catch {
    email = null;
  }

  if (isSuperAdminEmailCheck(email)) {
    return { ok: true, email };
  }

  let clerkUserId: string | null = null;
  try {
    clerkUserId = await getClerkUserId();
  } catch {
    /* ignore */
  }

  const { permissions } = await resolveMemberPermissions({ email, clerkUserId });
  if (!permissions.includes(permission)) {
    return {
      error: Response.json(
        { message: "Forbidden — insufficient security permissions." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, email };
}
