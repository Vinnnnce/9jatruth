import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * POST /api/news/publish
 *
 * Robust publication flow for verified agencies only.
 *  - Validates title, body (content), category, agency_id, and optional media.
 *  - Enforces that the publishing agency is verified (verification_badge present
 *    OR platform_users.is_verified = true).
 *  - Status workflow: draft → pending_review → published → rejected.
 *    Agencies submit as `pending_review`; super-admins can publish directly.
 *  - On any validation / auth failure, the attempt is logged to
 *    `news_publish_errors` with a code + message for auditability.
 *
 * Body: { title, content, excerpt?, category, agency_id, state?, lga?,
 *        cover_image_url?, media_urls?: string[], status?: 'draft'|'pending_review' }
 */
export const dynamic = "force-dynamic";

const NEWS_CATEGORIES = [
  "politics", "business", "technology", "sports", "entertainment",
  "health", "education", "agriculture", "security", "infrastructure",
  "environment", "local", "national", "international", "opinion",
] as const;

const schema = z.object({
  title: z.string().trim().min(3).max(300),
  content: z.string().trim().min(10),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")).optional(),
  category: z.enum(NEWS_CATEGORIES),
  agency_id: z.number().int().positive(),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  cover_image_url: z.string().url().max(1000).optional().or(z.literal("")),
  media_urls: z.array(z.string().url().max(1000)).max(20).default([]),
  status: z.enum(["draft", "pending_review"]).default("pending_review"),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function logFailure(sql: any, params: {
  agency_id?: number | null; title?: string | null; category?: string | null;
  code: string; message: string; attempted_by?: string | null; payload?: unknown;
}) {
  try {
    await sql`INSERT INTO news_publish_errors
      (agency_id, title, category, error_code, error_message, payload, attempted_by)
      VALUES (${params.agency_id ?? null}, ${params.title ?? null}, ${params.category ?? null},
              ${params.code}, ${params.message}, ${JSON.stringify(params.payload ?? {})}::jsonb, ${params.attempted_by ?? null})`;
  } catch (e) {
    console.error("[news/publish] failed to log error:", e);
  }
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) {
    await logFailure(getDb(), { code: "CSRF_FAILED", message: "CSRF check failed" });
    return csrfError;
  }

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized — sign in to publish" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await logFailure(getDb(), {
      agency_id: body?.agency_id, title: body?.title, category: body?.category,
      code: "VALIDATION_FAILED", message: "Title, content, category, agency_id required and must be valid",
      attempted_by: clerkUserId, payload: body,
    });
    return Response.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const sql = getDb();

  // Resolve the agency + verify it belongs to the caller and is verified.
  const orgRows = (await sql`
    SELECT o.id, o.name, o.verification_badge,
           u.id AS user_id, u.is_verified, u.display_name, u.is_admin
    FROM organizations o
    JOIN platform_users u ON u.organization_id = o.id
    WHERE o.id = ${p.agency_id} AND u.clerk_user_id = ${clerkUserId}
    LIMIT 1`) as any;

  if (!orgRows || orgRows.length === 0) {
    await logFailure(sql, { agency_id: p.agency_id, title: p.title, category: p.category,
      code: "AGENCY_NOT_OWNED", message: "Agency does not belong to the authenticated user",
      attempted_by: clerkUserId, payload: p });
    return Response.json({ message: "Agency not found or not owned by you" }, { status: 403 });
  }

  const agency = orgRows[0];
  const isVerified = !!agency.verification_badge || !!agency.is_verified || !!agency.is_admin;
  if (!isVerified) {
    await logFailure(sql, { agency_id: p.agency_id, title: p.title, category: p.category,
      code: "AGENCY_NOT_VERIFIED", message: "Only verified agencies can publish news",
      attempted_by: clerkUserId, payload: p });
    return Response.json({ message: "Only verified agencies can publish. Submit for verification first." }, { status: 403 });
  }

  // Insert as pending_review (or draft). Super-admins can publish directly via /api/admin/news.
  const status = p.status; // draft | pending_review
  let slug = slugify(p.title);
  // de-duplicate slug
  const slugCheck = (await sql`SELECT id FROM news_articles WHERE slug = ${slug} LIMIT 1`) as any;
  if (slugCheck && slugCheck.length > 0) {
    slug = `${slug}-${Date.now().toString(36).slice(-5)}`;
  }

  const mediaUrls = Array.isArray(p.media_urls) ? p.media_urls : [];
  const cover = p.cover_image_url || (mediaUrls.length > 0 ? mediaUrls[0] : null);
  // author_id is INTEGER (platform_users.id); media_urls is TEXT (JSON-encoded).
  const authorId = agency.user_id ?? null;

  const inserted = (await sql`
    INSERT INTO news_articles
      (title, slug, excerpt, content, cover_image_url, media_urls, category,
       author_id, author_name, author_type, organization_id, state, lga,
       status, is_verified, verification_badge)
    VALUES (${sanitizeText(p.title)}, ${slug}, ${p.excerpt || null}, ${sanitizeText(p.content)},
            ${cover || null}, ${JSON.stringify(mediaUrls)}, ${p.category},
            ${authorId}, ${agency.display_name || agency.name}, 'agency',
            ${p.agency_id}, ${p.state || null}, ${p.lga || null},
            ${status}, TRUE, ${agency.verification_badge || 'verified'})
    RETURNING id, slug, status`) as any;

  return Response.json({
    ok: true,
    article: inserted?.[0],
    message: status === "draft" ? "Saved as draft" : "Submitted for review",
  });
}
