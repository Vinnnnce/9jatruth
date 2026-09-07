import { ensureDbInitialized, getDb } from "@/lib/db";
import { getTruth, deleteTruth } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * GET /api/truths/[id] — full post detail with engagement counts + viewer state.
 * Powers the post detail page (image-1 design) opened when a user clicks a post.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();
  const truthId = parsed.data.id;

  // Core post + author display name + neighborhood name
  const rows = (await sql`
    SELECT t.*,
           u.display_name AS display_name,
           u.username AS username,
           n.name AS neighborhood_name
    FROM micro_truths t
    LEFT JOIN platform_users u ON u.user_hash = t.user_hash
    LEFT JOIN neighborhoods n ON n.id = t.neighborhood_id
    WHERE t.id = ${truthId} AND t.deleted_at IS NULL
    LIMIT 1
  `) as unknown as any[];

  if (!rows || rows.length === 0) {
    return Response.json({ message: "Truth not found" }, { status: 404 });
  }
  const t = rows[0];

  // Viewer state (best-effort — anonymous viewers just see zeros)
  const clerkUserId = await getClerkUserId();
  let viewerHash: string | null = null;
  let isAdmin = false;
  if (clerkUserId) {
    viewerHash = await getUserId(request);
    isAdmin = await isSuperAdmin();
  }

  const likeCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM feed_likes WHERE truth_id = ${truthId}`) as unknown as any[])[0]?.c ?? 0
  );
  const dislikeCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM feed_dislikes WHERE truth_id = ${truthId}`) as unknown as any[])[0]?.c ?? 0
  );
  const commentCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM feed_comments WHERE truth_id = ${truthId} AND status = 'active'`) as unknown as any[])[0]?.c ?? 0
  );
  const repostCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM feed_reposts WHERE truth_id = ${truthId}`) as unknown as any[])[0]?.c ?? 0
  );
  const giftCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM truth_gifts WHERE truth_id = ${truthId}`) as unknown as any[])[0]?.c ?? 0
  );
  const shareCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM feed_shares WHERE truth_id = ${truthId}`) as unknown as any[])[0]?.c ?? 0
  );
  const fanCount = Number(
    ((await sql`SELECT COUNT(*)::int AS c FROM user_subscriptions WHERE target_hash = ${t.user_hash}`) as unknown as any[])[0]?.c ?? 0
  );

  let viewerLiked = false;
  let viewerDisliked = false;
  let viewerReposted = false;
  let viewerSubscribed = false;
  let viewerPoints = 0;
  if (viewerHash) {
    viewerLiked = Boolean(
      ((await sql`SELECT 1 FROM feed_likes WHERE truth_id = ${truthId} AND user_hash = ${viewerHash} LIMIT 1`) as unknown as any[]).length
    );
    viewerDisliked = Boolean(
      ((await sql`SELECT 1 FROM feed_dislikes WHERE truth_id = ${truthId} AND user_hash = ${viewerHash} LIMIT 1`) as unknown as any[]).length
    );
    viewerReposted = Boolean(
      ((await sql`SELECT 1 FROM feed_reposts WHERE truth_id = ${truthId} AND user_hash = ${viewerHash} LIMIT 1`) as unknown as any[]).length
    );
    viewerSubscribed = Boolean(
      ((await sql`SELECT 1 FROM user_subscriptions WHERE subscriber_hash = ${viewerHash} AND target_hash = ${t.user_hash} LIMIT 1`) as unknown as any[]).length
    );
    const bal = (await sql`SELECT rewards_balance::int AS b FROM device_profiles WHERE device_id_hash = ${viewerHash} LIMIT 1`) as unknown as any[];
    viewerPoints = Number(bal[0]?.b ?? 0);
  }

  const isAuthor = Boolean(viewerHash && viewerHash === t.user_hash);
  const canDelete = Boolean(isAuthor || isAdmin);

  return Response.json({
    id: t.id,
    neighborhoodId: t.neighborhood_id,
    category: t.category,
    content: t.content,
    trustScore: t.trust_score,
    status: t.status,
    createdAt: t.created_at,
    userHash: t.user_hash,
    displayName: t.display_name ?? t.username ?? null,
    neighborhoodName: t.neighborhood_name ?? null,
    stateName: t.state_name ?? null,
    lgaName: t.lga_name ?? null,
    communityName: t.community_name ?? null,
    regionName: t.region_name ?? null,
    reportLat: t.report_lat ?? null,
    reportLng: t.report_lng ?? null,
    organizationId: t.organization_id ?? null,
    // engagement
    likeCount,
    dislikeCount,
    commentCount,
    repostCount,
    giftCount,
    shareCount,
    fanCount,
    // viewer state
    isAuthor,
    canDelete,
    isAdmin,
    viewerLiked,
    viewerDisliked,
    viewerReposted,
    viewerSubscribed,
    viewerPoints,
    signedIn: Boolean(clerkUserId),
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/truths/[id]] error:", msg, err);
    return Response.json({ message: "Failed to load post", error: msg }, { status: 500 });
  }
}

/**
 * Delete a truth (requires a signed-in user).
 * Author or super admin can delete; admins bypass the owner check.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;
    const clerkUserId = await getClerkUserId();
    if (!clerkUserId) {
      const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
      if (isClerkConfigured) {
        return Response.json({ message: "Unauthorized — Please sign in to delete a post" }, { status: 401 });
      }
    }

    const { id } = await params;
    const parsed = validate(idParamSchema, { id });
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const userHash = await getUserId(request);

    // Super admins (e.g. deleting from the admin panel) bypass the owner check
    // so they can remove any post, not just their own.
    const admin = await isSuperAdmin();
    const effectiveHash = admin ? undefined : userHash;

    const deleted = await deleteTruth(parsed.data.id, effectiveHash);
    if (!deleted) return Response.json({ message: "Truth not found or you don't have permission to delete it" }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[api/truths/[id]] DELETE failed:", err);
    return Response.json({ message: "Failed to delete post", detail: String(err?.message || err) }, { status: 500 });
  }
}
