import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const verifySchema = z.object({
  articleId: z.number().int().positive().max(1_000_000),
  verified: z.boolean(),
  badge: z.enum(["verified", "fact-checked", "official", "trusted-source"]).optional(),
  trustBoost: z.number().int().min(0).max(50).default(0),
  accuracyBonus: z.number().int().min(0).max(500).default(0),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/news/verify — admin verify article, award accuracy incentives
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  // Admin-only
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Validation error", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const sql = getDb();
  const userHash = await getUserId(request);

  // Fetch article to get author info for incentive
  const articles = (await sql`
    SELECT id, author_name, user_hash, trust_score, is_verified
    FROM news_articles WHERE id = ${data.articleId}
  `) as unknown as any[];

  if (articles.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const article = articles[0];

  // Update article verification status
  const newTrustScore = Math.min(100, (article.trust_score || 50) + data.trustBoost);
  const badge = data.verified ? (data.badge || "verified") : null;

  await sql`
    UPDATE news_articles
    SET is_verified = ${data.verified},
        verification_badge = ${badge},
        trust_score = ${newTrustScore},
        accuracy_bonus = ${data.accuracyBonus},
        updated_at = NOW()
    WHERE id = ${data.articleId}
  `;

  // Award accuracy incentive to article author if verified with bonus
  if (data.verified && data.accuracyBonus > 0) {
    const authorHash = article.user_hash || userHash;
    try {
      await sql`
        INSERT INTO news_incentives (article_id, user_hash, incentive_type, amount, badge_name, trust_boost, reason)
        VALUES (${data.articleId}, ${authorHash}, 'accuracy', ${data.accuracyBonus}, ${badge}, ${data.trustBoost}, ${data.reason || 'Article verified by admin'})
      `;

      // Credit reward ledger
      await sql`
        INSERT INTO reward_ledger (user_hash, amount, type, description)
        VALUES (${authorHash}, ${data.accuracyBonus}, 'incentive', ${'News accuracy incentive for article #' + data.articleId})
      `;

      // Update device profile balance if exists
      await sql`
        UPDATE device_profiles
        SET rewards_balance = rewards_balance + ${data.accuracyBonus}
        WHERE device_id_hash = ${authorHash}
      `;
    } catch (err) {
      console.error("[news/verify] Incentive award error:", err);
      // Non-critical — article is still verified
    }
  }

  // Create audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', ${data.verified ? 'verify_article' : 'unverify_article'},
              'news_article', ${data.articleId},
              ${data.verified ? 'Article verified' : 'Article verification removed'},
              ${JSON.stringify({ verified: data.verified, badge, trustBoost: data.trustBoost, accuracyBonus: data.accuracyBonus })})
    `;
  } catch (err) {
    console.error("[news/verify] Audit log error:", err);
  }

  return Response.json({
    success: true,
    articleId: data.articleId,
    verified: data.verified,
    badge,
    trustScore: newTrustScore,
    accuracyBonus: data.accuracyBonus,
  });
}
