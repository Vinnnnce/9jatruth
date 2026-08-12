import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const NEWS_CATEGORIES = [
  "politics",
  "business",
  "technology",
  "sports",
  "entertainment",
  "health",
  "education",
  "agriculture",
  "security",
  "infrastructure",
  "environment",
  "local",
  "national",
  "international",
  "opinion",
] as const;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.enum(NEWS_CATEGORIES).optional(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
});

/**
 * GET /api/news — list published articles with filters
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const parsed = validate(listQuerySchema, Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { limit, offset, category, state, lga, tag, search } = parsed.data;
  const sql = getDb();

  const conditions: string[] = ["status = 'published'"];
  const params: any[] = [];
  const build = (clause: string, value: any) => {
    params.push(value);
    conditions.push(clause.replace("$$", `$${params.length}`));
  };

  if (category) build("category = $$", category);
  if (state) build("state = $$", state);
  if (lga) build("lga = $$", lga);
  if (tag) build("tags::jsonb @> $$::jsonb", JSON.stringify([tag]));
  if (search) build("(title ILIKE $$ OR excerpt ILIKE $$)", `%${search}%`);

  // For the search placeholder duplication, we need to handle the two-$$ case
  // Rebuild more carefully with parameterized approach
  params.length = 0;
  conditions.length = 0;
  conditions.push("status = 'published'");
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
  if (tag) {
    params.push(JSON.stringify([tag]));
    conditions.push(`tags::jsonb @> $${params.length}::jsonb`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(title ILIKE $${params.length} OR excerpt ILIKE $${params.length})`);
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
            published_at, created_at
     FROM news_articles
     WHERE ${where}
     ORDER BY published_at DESC NULLS LAST, created_at DESC
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
      publishedAt: r.published_at,
      createdAt: r.created_at,
    })),
    total: rows.length,
    limit,
    offset,
  });
}

const createArticleSchema = z.object({
  title: z.string().trim().min(3).max(300),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10),
  coverImageUrl: z.string().url().max(1000).optional(),
  mediaUrls: z.array(z.string().url().max(1000)).max(20).default([]),
  category: z.enum(NEWS_CATEGORIES).default("local"),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

/**
 * POST /api/news — create an article (requires auth)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(createArticleSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const userHash = await getUserId(request);
  const sql = getDb();

  // Look up platform user for author name
  let authorName = "Anonymous";
  let authorType = "user";
  let organizationId: number | null = null;
  try {
    const userRows = (await sql`
      SELECT display_name, role, is_admin, is_org_admin, organization_id
      FROM platform_users WHERE clerk_user_id = ${clerkUserId}
    `) as unknown as any[];
    if (userRows.length > 0) {
      authorName = userRows[0].display_name || "User";
      authorType = userRows[0].is_admin ? "admin" : userRows[0].is_org_admin ? "agency" : "user";
      organizationId = userRows[0].organization_id ?? null;
    }
  } catch {
    // Non-critical
  }

  const title = sanitizeText(data.title);
  const excerpt = data.excerpt ? sanitizeText(data.excerpt) : null;
  const content = data.content; // rich HTML content — keep as-is
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) + `-${Date.now().toString(36)}`;

  const publishedAt = data.status === "published" ? new Date() : null;

  const rows = (await sql`
    INSERT INTO news_articles (
      title, slug, excerpt, content, cover_image_url, media_urls, category, tags,
      author_name, author_type, organization_id, state, lga, status, published_at
    ) VALUES (
      ${title}, ${slug}, ${excerpt}, ${content},
      ${data.coverImageUrl || null}, ${JSON.stringify(data.mediaUrls)},
      ${data.category}, ${JSON.stringify(data.tags)},
      ${authorName}, ${authorType}, ${organizationId},
      ${data.state || null}, ${data.lga || null}, ${data.status}, ${publishedAt}
    )
    RETURNING *
  `) as unknown as any[];

  return Response.json(
    {
      id: rows[0].id,
      title: rows[0].title,
      slug: rows[0].slug,
      status: rows[0].status,
      createdAt: rows[0].created_at,
    },
    { status: 201 }
  );
}
