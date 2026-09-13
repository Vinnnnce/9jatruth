import { ensureDbInitialized, getDb } from "@/lib/db";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(50).optional(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  source: z.enum(["internal", "external", "all"]).optional().default("all"),
});

/**
 * GET /api/news/feed — unified news feed for feeds page integration
 *
 * Returns published articles from both internal (news_articles) and external
 * (news_external) sources, merged and sorted by publication date.
 *
 * Query params:
 *   - source: "internal" | "external" | "all" (default: "all")
 *   - category, state, lga: optional filters
 *   - limit, offset: pagination
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const parsed = validate(feedQuerySchema, Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { limit, offset, category, state, lga, source } = parsed.data;
  const sql = getDb();

  const internalArticles: any[] = [];
  const externalArticles: any[] = [];

  // ── Fetch internal news (news_articles) ──
  if (source === "all" || source === "internal") {
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
    try {
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

      internalArticles.push(...rows.map((r) => ({
        id: r.id,
        source: "internal" as const,
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
        url: null,
        publishedAt: r.published_at || r.created_at,
        createdAt: r.created_at,
      })));
    } catch (err) {
      console.error("[news/feed] internal news query failed:", err);
    }
  }

  // ── Fetch external news (news_external) ──
  if (source === "all" || source === "external") {
    const extConditions: string[] = [];
    const extParams: any[] = [];
    if (category) {
      extParams.push(category);
      extConditions.push(`category = $${extParams.length}`);
    }

    extParams.push(limit);
    const extLimitIdx = `$${extParams.length}`;
    extParams.push(offset);
    const extOffsetIdx = `$${extParams.length}`;

    const extWhere = extConditions.length > 0 ? `WHERE ${extConditions.join(" AND ")}` : "";
    try {
      const extRows = (await sql.query(
        `SELECT id, source_name, author, title, description, content, url,
                image_url, published_at, category, created_at,
                is_audio_generated, audio_url
         FROM news_external
         ${extWhere}
         ORDER BY published_at DESC NULLS LAST, created_at DESC
         LIMIT ${extLimitIdx} OFFSET ${extOffsetIdx}`,
        extParams
      )) as unknown as any[];

      externalArticles.push(...extRows.map((r) => ({
        id: r.id,
        source: "external" as const,
        title: r.title,
        slug: null,
        excerpt: r.description,
        coverImageUrl: r.image_url,
        mediaUrls: [],
        category: r.category,
        tags: [],
        authorName: r.source_name || r.author,
        authorType: "external",
        organizationId: null,
        state: null,
        lga: null,
        isVerified: false,
        verificationBadge: null,
        trustScore: 50,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        accuracyBonus: null,
        url: r.url,
        publishedAt: r.published_at || r.created_at,
        createdAt: r.created_at,
      })));
    } catch (err) {
      console.error("[news/feed] external news query failed:", err);
    }
  }

  // ── Merge and sort by published_at ──
  const allArticles = [...internalArticles, ...externalArticles]
    .sort((a, b) => {
      const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, limit);

  return Response.json({
    articles: allArticles,
    total: allArticles.length,
    limit,
    offset,
    sources: {
      internal: internalArticles.length,
      external: externalArticles.length,
    },
  });
}
