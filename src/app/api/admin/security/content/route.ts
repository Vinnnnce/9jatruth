/**
 * GET /api/admin/security/content — list content verifications (news/deepfake).
 * POST — review (approve/reject) a content verification.
 */
import { withSecurity } from "@/lib/security-middleware";
import {
  getContentVerifications,
  reviewContentVerification,
} from "@/lib/security-engine/security-storage";
import { z } from "zod";

export const GET = withSecurity(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 50);
    const items = await getContentVerifications(limit);
    return Response.json(items);
  },
  {
    requirePermission: "security.content.review",
    eventType: "admin_content_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);

const reviewSchema = z.object({
  id: z.number().int().positive(),
  verdict: z.enum(["approved", "rejected", "flagged"]),
});

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }
    const ok = await reviewContentVerification(
      parsed.data.id,
      parsed.data.verdict,
      ctx.email ?? "unknown"
    );
    return Response.json({ success: ok });
  },
  {
    requirePermission: "security.content.verify",
    eventType: "admin_content_review",
    rateLimit: { max: 30, windowMs: 60_000 },
  }
);
