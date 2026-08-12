import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  verified: z.enum(["true", "false"]).optional(),
});

/**
 * GET /api/admin/news — list all news articles for admin
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 100;
  const offset = parsed.success ? parsed.data.offset : 0;
  const status = parsed.success ? parsed.data.status : undefined;
  const category = parsed.success ? parsed.data.category : undefined;
  const verified = parsed.success ? parsed.data.verified : undefined;

  const sql = getDb();

  const conditions: string[] = [];
  const params: any[] = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (verified === "true") {
    conditions.push(`is_verified = TRUE`);
  } else if (verified === "false") {
    conditions.push(`is_verified = FALSE`);
  }

  params.push(limit);
  const limitIdx = `$${params.length}`;
  params.push(offset);
  const offsetIdx = `$${params.length}`;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT id, title, slug, excerpt, cover_image_url, category, tags, author_name,
            author_type, organization_id, state, lga, status, is_verified,
            verification_badge, trust_score, view_count, like_count, comment_count,
            accuracy_bonus, published_at, created_at, updated_at
     FROM news_articles ${where}
     ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
    params
  )) as unknown as any[];

  return Response.json({
    articles: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      category: r.category,
      tags: r.tags ? JSON.parse(r.tags) : [],
      authorName: r.author_name,
      authorType: r.author_type,
      organizationId: r.organization_id,
      state: r.state,
      lga: r.lga,
      status: r.status,
      isVerified: r.is_verified,
      verificationBadge: r.verification_badge,
      trustScore: r.trust_score,
      viewCount: r.view_count,
      likeCount: r.like_count,
      commentCount: r.comment_count,
      accuracyBonus: r.accuracy_bonus,
      publishedAt: r.published_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    limit,
    offset,
  });
}
