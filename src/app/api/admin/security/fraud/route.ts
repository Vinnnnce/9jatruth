/**
 * GET /api/admin/security/fraud — list fraud signals.
 * POST — mitigate a fraud signal (mark resolved).
 */
import { withSecurity } from "@/lib/security-middleware";
import {
  getFraudSignals,
  mitigateFraudSignal,
} from "@/lib/security-engine/security-storage";
import { z } from "zod";

export const GET = withSecurity(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const signals = await getFraudSignals(limit);
    return Response.json(signals);
  },
  {
    requirePermission: "security.fraud.view",
    eventType: "admin_fraud_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);

const mitigateSchema = z.object({
  id: z.number().int().positive(),
  status: z.string().max(50).default("mitigated"),
});

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = mitigateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }
    const ok = await mitigateFraudSignal(
      parsed.data.id,
      ctx.email ?? "unknown",
      parsed.data.status
    );
    return Response.json({ success: ok });
  },
  {
    requirePermission: "security.threats.mitigate",
    eventType: "admin_fraud_mitigate",
    rateLimit: { max: 30, windowMs: 60_000 },
  }
);
