import { ensureDbInitialized, getDb } from "@/lib/db";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(50).optional(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
});

/**
 * GET /api/news/feed — news feed for feeds page integration
 * Returns published articles with verification badges
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const parsed = validate(feedQuerySchema, Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { limit, offset, category, state, lga } = parsed.data;
  const sql = getDb();

  const conditions: string[] = ["status = 'published'"];
  const params: any[] = [];
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (state) {
    params.push(state);
    conditions.push(`state = $${params.length}`);
  }
  if (lga) {
    params.push(lga);
    conditions.push(`lga = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = `$${params.length}`;
  params.push(offset);
  const offsetIdx = `$${params.length}`;

  const where = conditions.join(" AND ");
  const rows = (await sql.query(
    `SELECT id, title, slug, excerpt, cover_image_url, media_urls, category, tags,
            author_name, author_type, organization_id, state, lga, is_verified,
            verification_badge, trust_score, view_count, like_count, comment_count,
            accuracy_bonus, published_at, created_at
     FROM news_articles
     WHERE ${where}
     ORDER BY is_verified DESC, published_at DESC NULLS LAST, created_at DESC
     LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
    params
  )) as unknown as any[];

  return Response.json({
    articles: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      coverImageUrl: r.cover_image_url,
      mediaUrls: r.media_urls ? JSON.parse(r.media_urls) : [],
      category: r.category,
      tags: r.tags ? JSON.parse(r.tags) : [],
      authorName: r.author_name,
      authorType: r.author_type,
      organizationId: r.organization_id,
      state: r.state,
      lga: r.lga,
      isVerified: r.is_verified,
      verificationBadge: r.verification_badge,
      trustScore: r.trust_score,
      viewCount: r.view_count,
      likeCount: r.like_count,
      commentCount: r.comment_count,
      accuracyBonus: r.accuracy_bonus,
      publishedAt: r.published_at,
      createdAt: r.created_at,
    })),
    limit,
    offset,
  });
}
