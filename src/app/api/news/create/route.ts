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
  "politics", "business", "technology", "sports", "entertainment",
  "health", "education", "agriculture", "security", "infrastructure",
  "environment", "local", "national", "international", "opinion",
] as const;

const createWithMediaSchema = z.object({
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
 * POST /api/news/create — create article with media upload support
 *
 * Accepts either:
 *  - JSON body (same as POST /api/news) with pre-uploaded mediaUrls, OR
 *  - multipart/form-data with file uploads (cover image + media files)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to create articles" }, { status: 401 });
    }
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

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

  let title: string;
  let excerpt: string | null;
  let content: string;
  let coverImageUrl: string | null;
  let mediaUrls: string[];
  let category: string;
  let tags: string[];
  let state: string | null;
  let lga: string | null;
  let status: string;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // Handle multipart form data with file uploads
    const formData = await request.formData();
    title = sanitizeText(String(formData.get("title") || ""));
    excerpt = formData.get("excerpt") ? sanitizeText(String(formData.get("excerpt"))) : null;
    content = String(formData.get("content") || "");
    // Normalize category to lowercase — the editor sends capitalized labels
    // (e.g. "Politics") but the DB/news feed expects the canonical lowercase
    // category key. Without this, unknown categories silently fall back to
    // "general" and the article never appears in the expected feed filter.
    category = String(formData.get("category") || "local").trim().toLowerCase();
    state = formData.get("state") ? String(formData.get("state")) : null;
    lga = formData.get("lga") ? String(formData.get("lga")) : null;
    status = String(formData.get("status") || "draft").toLowerCase();

    const tagsRaw = formData.get("tags");
    tags = tagsRaw ? String(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean) : [];

    coverImageUrl = formData.get("coverImageUrl") ? String(formData.get("coverImageUrl")) : null;
    // Harden mediaUrls parsing — a malformed value used to throw an unhandled
    // 500. Now we fall back to an empty array.
    const mediaUrlsRaw = formData.get("mediaUrls");
    if (mediaUrlsRaw) {
      try {
        const parsed = JSON.parse(String(mediaUrlsRaw));
        mediaUrls = Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
      } catch {
        mediaUrls = [];
      }
    } else {
      mediaUrls = [];
    }

    // Process uploaded files (cover + media)
    const uploadedMediaUrls: string[] = [];
    const allEntries = Array.from(formData.entries());
    for (const [key, value] of allEntries) {
      if (value instanceof File) {
        const file = value as File;
        // Validate file type
        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        const allowedVideoTypes = ["video/mp4", "video/webm"];
        const maxSize = file.type.startsWith("video/") ? 60 * 1024 * 1024 : 10 * 1024 * 1024; // 60s video ~ 60MB, images 10MB

        if (file.size > maxSize) {
          return Response.json(
            { message: `File ${file.name} exceeds maximum size` },
            { status: 400 }
          );
        }

        if (![...allowedImageTypes, ...allowedVideoTypes].includes(file.type)) {
          return Response.json(
            { message: `File type ${file.type} not supported` },
            { status: 400 }
          );
        }

        // Store the file — in production this would go to blob storage
        // For now, we return a data URL placeholder or accept pre-uploaded URLs
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        if (key === "cover" || key === "coverImage") {
          coverImageUrl = dataUrl;
        } else {
          uploadedMediaUrls.push(dataUrl);
        }
      }
    }
    mediaUrls = [...mediaUrls, ...uploadedMediaUrls];

    // Basic validation for multipart
    if (!title || title.length < 3) {
      return Response.json({ message: "Title must be at least 3 characters" }, { status: 400 });
    }
    if (!content || content.length < 10) {
      return Response.json({ message: "Content must be at least 10 characters" }, { status: 400 });
    }
  } else {
    // JSON body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "Invalid JSON" }, { status: 400 });
    }

    // Normalize category case (client sends "Politics" → "politics") so the
    // Zod enum validates instead of returning a 400 validation error.
    if (body && typeof body.category === "string") {
      body.category = body.category.trim().toLowerCase();
    }
    if (body && typeof body.status === "string") {
      body.status = body.status.trim().toLowerCase();
    }

    const parsed = validate(createWithMediaSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    title = sanitizeText(data.title);
    excerpt = data.excerpt ? sanitizeText(data.excerpt) : null;
    content = data.content;
    coverImageUrl = data.coverImageUrl || null;
    mediaUrls = data.mediaUrls;
    category = data.category;
    tags = data.tags;
    state = data.state || null;
    lga = data.lga || null;
    status = data.status;
  }

  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) + `-${Date.now().toString(36)}`;

  const publishedAt = status === "published" ? new Date() : null;

  const rows = (await sql`
    INSERT INTO news_articles (
      title, slug, excerpt, content, cover_image_url, media_urls, category, tags,
      author_name, author_type, organization_id, state, lga, status, published_at
    ) VALUES (
      ${title}, ${slug}, ${excerpt}, ${content},
      ${coverImageUrl}, ${JSON.stringify(mediaUrls)},
      ${category}, ${JSON.stringify(tags)},
      ${authorName}, ${authorType}, ${organizationId},
      ${state}, ${lga}, ${status}, ${publishedAt}
    )
    RETURNING *
  `) as unknown as any[];

  return Response.json(
    {
      id: rows[0].id,
      title: rows[0].title,
      slug: rows[0].slug,
      coverImageUrl: rows[0].cover_image_url,
      mediaUrls: rows[0].media_urls ? JSON.parse(rows[0].media_urls) : [],
      status: rows[0].status,
      createdAt: rows[0].created_at,
    },
    { status: 201 }
  );
}
