import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const manageSchema = z.object({
  action: z.enum(["verify", "reject", "archive", "publish", "unpublish"]),
  verificationBadge: z.enum(["verified", "fact-checked", "official", "trusted-source"]).optional(),
  trustBoost: z.number().int().min(0).max(50).default(0),
  accuracyBonus: z.number().int().min(0).max(500).default(0),
  reason: z.string().max(500).optional(),
});

/**
 * PUT /api/admin/news/[id] — verify/reject/archive article with incentive logic
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = validate(idParamSchema, { id });
  if (!parsedId.success) return validationErrorResponse(parsedId.error);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(manageSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();

  // Fetch article
  const existing = (await sql`
    SELECT id, title, author_name, trust_score, is_verified, status, accuracy_bonus
    FROM news_articles WHERE id = ${parsedId.data.id}
  `) as unknown as any[];

  if (existing.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const article = existing[0];

  let newStatus = article.status;
  let isVerified = article.is_verified;
  let verificationBadge = null;
  let newTrustScore = article.trust_score;
  let accuracyBonus = article.accuracy_bonus;

  switch (data.action) {
    case "verify":
      isVerified = true;
      verificationBadge = data.verificationBadge || "verified";
      newTrustScore = Math.min(100, article.trust_score + data.trustBoost);
      accuracyBonus = article.accuracy_bonus + data.accuracyBonus;
      break;
    case "reject":
      isVerified = false;
      verificationBadge = null;
      newStatus = "draft";
      break;
    case "archive":
      newStatus = "archived";
      break;
    case "publish":
      newStatus = "published";
      break;
    case "unpublish":
      newStatus = "draft";
      break;
  }

  // Update article
  const publishedAtClause =
    data.action === "publish" ? ", published_at = COALESCE(published_at, NOW())" : "";

  await sql`
    UPDATE news_articles
    SET status = ${newStatus},
        is_verified = ${isVerified},
        verification_badge = ${verificationBadge},
        trust_score = ${newTrustScore},
        accuracy_bonus = ${accuracyBonus},
        updated_at = NOW()
    WHERE id = ${parsedId.data.id}
  `;

  // Award accuracy incentive if verifying with bonus
  if (data.action === "verify" && data.accuracyBonus > 0) {
    try {
      // Get author user_hash — article may not have user_hash column directly,
      // use author_name as fallback
      await sql`
        INSERT INTO news_incentives (article_id, user_hash, incentive_type, amount, badge_name, trust_boost, reason)
        VALUES (${parsedId.data.id}, ${clerkUserId}, 'accuracy', ${data.accuracyBonus},
                ${verificationBadge}, ${data.trustBoost},
                ${data.reason || 'Article verified by admin'})
      `;
      await sql`
        INSERT INTO reward_ledger (user_hash, amount, type, description)
        VALUES (${clerkUserId}, ${data.accuracyBonus}, 'incentive',
                ${'News accuracy incentive for article #' + parsedId.data.id})
      `;
      await sql`
        UPDATE device_profiles
        SET rewards_balance = rewards_balance + ${data.accuracyBonus}
        WHERE device_id_hash = ${clerkUserId}
      `;
    } catch (err) {
      console.error("[admin/news/PUT] Incentive award error:", err);
    }
  }

  // Create audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, old_values, new_values)
      VALUES (
        ${clerkUserId}, 'admin', 'super_admin',
        ${'admin_' + data.action + '_article'},
        'news_article', ${parsedId.data.id},
        ${'Article ' + data.action + ': ' + article.title},
        ${JSON.stringify({ status: article.status, isVerified: article.is_verified, trustScore: article.trust_score })},
        ${JSON.stringify({ status: newStatus, isVerified, verificationBadge, trustScore: newTrustScore, accuracyBonus, reason: data.reason })}
      )
    `;
  } catch (err) {
    console.error("[admin/news/PUT] Audit log error:", err);
  }

  return Response.json({
    id: parsedId.data.id,
    status: newStatus,
    isVerified,
    verificationBadge,
    trustScore: newTrustScore,
    accuracyBonus,
  });
}
