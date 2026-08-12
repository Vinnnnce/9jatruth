import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * GET /api/news/[id] — single article, increments view_count
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();

  // Increment view count
  await sql`UPDATE news_articles SET view_count = view_count + 1 WHERE id = ${parsed.data.id}`;

  const rows = (await sql`
    SELECT * FROM news_articles WHERE id = ${parsed.data.id}
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    content: r.content,
    coverImageUrl: r.cover_image_url,
    mediaUrls: r.media_urls ? JSON.parse(r.media_urls) : [],
    category: r.category,
    tags: r.tags ? JSON.parse(r.tags) : [],
    authorId: r.author_id,
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
  });
}

const updateArticleSchema = z.object({
  title: z.string().trim().min(3).max(300).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).optional(),
  coverImageUrl: z.string().url().max(1000).optional(),
  mediaUrls: z.array(z.string().url().max(1000)).max(20).optional(),
  category: z
    .enum([
      "politics", "business", "technology", "sports", "entertainment",
      "health", "education", "agriculture", "security", "infrastructure",
      "environment", "local", "national", "international", "opinion",
    ])
    .optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

/**
 * PUT /api/news/[id] — update article (requires auth)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const parsedId = validate(idParamSchema, { id });
  if (!parsedId.success) return validationErrorResponse(parsedId.error);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(updateArticleSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();

  // Check article exists and user has permission
  const existing = (await sql`
    SELECT id, author_name FROM news_articles WHERE id = ${parsedId.data.id}
  `) as unknown as any[];
  if (existing.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  // Build update — only set provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const addField = (column: string, value: any) => {
    fields.push(`${column} = $${idx}`);
    values.push(value);
    idx++;
  };

  if (data.title !== undefined) addField("title", sanitizeText(data.title));
  if (data.excerpt !== undefined) addField("excerpt", data.excerpt ? sanitizeText(data.excerpt) : null);
  if (data.content !== undefined) addField("content", data.content);
  if (data.coverImageUrl !== undefined) addField("cover_image_url", data.coverImageUrl);
  if (data.mediaUrls !== undefined) addField("media_urls", JSON.stringify(data.mediaUrls));
  if (data.category !== undefined) addField("category", data.category);
  if (data.tags !== undefined) addField("tags", JSON.stringify(data.tags));
  if (data.state !== undefined) addField("state", data.state || null);
  if (data.lga !== undefined) addField("lga", data.lga || null);
  if (data.status !== undefined) {
    addField("status", data.status);
    if (data.status === "published") {
      fields.push(`published_at = COALESCE(published_at, NOW())`);
    }
  }

  fields.push(`updated_at = NOW()`);
  values.push(parsedId.data.id);

  const rows = (await sql.query(
    `UPDATE news_articles SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  )) as unknown as any[];

  return Response.json({
    id: rows[0].id,
    title: rows[0].title,
    slug: rows[0].slug,
    status: rows[0].status,
    updatedAt: rows[0].updated_at,
  });
}

/**
 * DELETE /api/news/[id] — delete article (requires auth)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();
  const rows = (await sql`
    DELETE FROM news_articles WHERE id = ${parsed.data.id} RETURNING id
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
