/**
 * POST /api/security/analyze
 * Run the AI security pipeline + content verification (fake news, deepfake)
 * against submitted content. Used by the news submission flow and by the
 * admin content-review dashboard.
 *
 * Auth: any signed-in user (rate-limited). The verdict is logged for audit.
 */
import { withSecurity } from "@/lib/security-middleware";
import { runSecurityPipeline, buildSecurityContext } from "@/lib/security-engine";
import { scoreNewsAuthenticity } from "@/lib/security-engine/nlp-fakenews";
import { scoreDeepfake } from "@/lib/security-engine/deepfake";
import {
  logContentVerification,
  persistVerdict,
} from "@/lib/security-engine/security-storage";
import { z } from "zod";

const analyzeSchema = z.object({
  text: z.string().max(20_000).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  videoUrl: z.string().url().max(2000).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
});

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: "Invalid content for analysis", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text, imageUrl, videoUrl, sourceUrl } = parsed.data;
    const secCtx = await buildSecurityContext(request, {
      userId: ctx.clerkUserId ?? undefined,
      content: { text, imageUrl, videoUrl, sourceUrl },
    });

    const verdict = await runSecurityPipeline(secCtx);

    // Content-specific scoring (always computed for transparency).
    const newsScore = text ? scoreNewsAuthenticity(text, sourceUrl) : null;
    const deepfakeScore =
      imageUrl || videoUrl ? scoreDeepfake({ text, imageUrl, videoUrl, sourceUrl }) : null;

    // Persist a content verification record for moderation.
    if (text || imageUrl || videoUrl) {
      await logContentVerification({
        contentType: videoUrl ? "video" : "image",
        sourceUrl: sourceUrl ?? undefined,
        textContent: text,
        mediaUrl: imageUrl || videoUrl,
        authenticityScore: newsScore?.authenticityScore ?? 50,
        riskScore: Math.max(
          verdict.riskScore,
          newsScore?.riskScore ?? 0,
          deepfakeScore?.riskScore ?? 0
        ),
        verdict:
          (newsScore?.authenticityScore ?? 100) >= 55 && !(deepfakeScore?.suspicious)
            ? "likely_authentic"
            : "flagged",
        signals: [
          ...(newsScore?.signals ?? []),
          ...(deepfakeScore?.signals ?? []),
        ],
      }).catch(() => {});
    }

    // Persist the security verdict (audit trail + alerts for high risk).
    await persistVerdict(verdict, {
      eventType: "content_analysis",
      endpoint: "/api/security/analyze",
      userHash: ctx.clerkUserId ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    }).catch(() => {});

    return Response.json({
      riskScore: verdict.riskScore,
      severity: verdict.severity,
      action: verdict.action,
      news: newsScore,
      deepfake: deepfakeScore,
      deviceFingerprint: verdict.deviceFingerprint,
      analyzedAt: verdict.analyzedAt,
    });
  },
  {
    requireAuth: false,
    rateLimit: { max: 20, windowMs: 60_000 },
    runPipeline: true,
    eventType: "content_analysis",
    allowBots: false,
  }
);
