/**
 * GET /api/admin/security/events — list security events (threat log).
 * POST — acknowledge an event.
 */
import { withSecurity } from "@/lib/security-middleware";
import {
  getSecurityEvents,
  acknowledgeSecurityEvent,
} from "@/lib/security-engine/security-storage";
import { z } from "zod";

export const GET = withSecurity(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const offset = Number(searchParams.get("offset") ?? 0);
    const severity = searchParams.get("severity") ?? undefined;
    const acknowledged = searchParams.get("acknowledged");
    const events = await getSecurityEvents({
      limit,
      offset,
      severity: severity || undefined,
      acknowledged:
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined,
    });
    return Response.json(events);
  },
  {
    requirePermission: "security.threats.view",
    eventType: "admin_security_events",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);

const ackSchema = z.object({ eventId: z.number().int().positive() });

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = ackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }
    const ok = await acknowledgeSecurityEvent(parsed.data.eventId, ctx.email ?? "unknown");
    return Response.json({ success: ok });
  },
  {
    requirePermission: "security.alerts.acknowledge",
    eventType: "admin_security_ack",
    rateLimit: { max: 30, windowMs: 60_000 },
  }
);
