import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/news/article?slug=<slug> — single article by slug, increments view_count
 * GET /api/news/article?id=<id> — single article by id, increments view_count
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("id");

  if (!slug && !id) {
    return Response.json({ message: "slug or id parameter required" }, { status: 400 });
  }

  const sql = getDb();

  let rows: any[];

  if (slug) {
    // Increment view count
    await sql`UPDATE news_articles SET view_count = view_count + 1 WHERE slug = ${slug} AND status = 'published'`;
    rows = (await sql`
      SELECT * FROM news_articles WHERE slug = ${slug} AND status = 'published'
    `) as unknown as any[];
  } else {
    const articleId = parseInt(id!, 10);
    if (isNaN(articleId)) {
      return Response.json({ message: "Invalid article id" }, { status: 400 });
    }
    await sql`UPDATE news_articles SET view_count = view_count + 1 WHERE id = ${articleId} AND status = 'published'`;
    rows = (await sql`
      SELECT * FROM news_articles WHERE id = ${articleId} AND status = 'published'
    `) as unknown as any[];
  }

  if (rows.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const r = rows[0];

  // Get related articles (same category, excluding current)
  const related = (await sql`
    SELECT id, slug, title, cover_image_url, category, published_at
    FROM news_articles
    WHERE category = ${r.category} AND id != ${r.id} AND status = 'published'
    ORDER BY published_at DESC
    LIMIT 3
  `) as unknown as any[];

  return Response.json({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    content: r.content,
    coverImage: r.cover_image_url,
    coverImageUrl: r.cover_image_url,
    mediaUrls: r.media_urls ? JSON.parse(r.media_urls) : [],
    category: r.category,
    tags: r.tags ? JSON.parse(r.tags) : [],
    authorId: r.author_id,
    authorName: r.author_name,
    authorAvatar: null,
    authorVerified: r.is_verified,
    authorType: r.author_type,
    organizationId: r.organization_id,
    state: r.state,
    lga: r.lga,
    status: r.status,
    isVerified: r.is_verified,
    verified: r.is_verified,
    verificationBadge: r.verification_badge,
    trustScore: r.trust_score,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    accuracyBonus: r.accuracy_bonus,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    related: related.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      coverImage: a.cover_image_url,
      category: a.category,
      publishedAt: a.published_at,
    })),
  });
}
