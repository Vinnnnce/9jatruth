import { ensureDbInitialized, getDb } from "@/lib/db";
import { sanitizeText } from "@/lib/api-helpers";

/**
 * POST /api/schedule/process — process due scheduled content
 * Called by Vercel cron every hour. Auth via CRON_SECRET bearer token.
 */
export async function POST(request: Request) {
  // Auth: CRON_SECRET
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureDbInitialized();
  const sql = getDb();

  // Find all due scheduled content
  const due = (await sql`
    SELECT * FROM scheduled_content
    WHERE status = 'scheduled' AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT 50
  `) as unknown as any[];

  let processed = 0;
  let failed = 0;
  const errors: { id: number; error: string }[] = [];

  for (const item of due) {
    try {
      const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;

      if (item.content_type === "news") {
        // Create news article
        const title = sanitizeText(payload.title || "Untitled");
        const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80) + `-${Date.now().toString(36)}`;
        const rows = (await sql`
          INSERT INTO news_articles (
            title, slug, excerpt, content, cover_image_url, media_urls,
            category, tags, author_name, author_type, state, lga, status, published_at
          ) VALUES (
            ${title}, ${slug}, ${payload.excerpt || null}, ${payload.content || ""},
            ${payload.coverImageUrl || null}, ${JSON.stringify(payload.mediaUrls || [])},
            ${payload.category || "local"}, ${JSON.stringify(payload.tags || [])},
            ${payload.authorName || "Scheduled"}, ${payload.authorType || "user"},
            ${payload.state || null}, ${payload.lga || null}, 'published', NOW()
          ) RETURNING id
        `) as unknown as any[];

        await sql`UPDATE scheduled_content SET status = 'published', published_ref_id = ${rows[0].id} WHERE id = ${item.id}`;
      } else if (item.content_type === "truth") {
        // Create micro-truth
        let neighborhoodId = payload.neighborhoodId;

        // Resolve neighborhood name if needed
        if (!neighborhoodId && payload.neighborhoodName) {
          const existing = (await sql`SELECT id FROM neighborhoods WHERE name ILIKE ${payload.neighborhoodName} LIMIT 1`) as unknown as any[];
          if (existing.length > 0) {
            neighborhoodId = existing[0].id;
          } else {
            const created = (await sql`INSERT INTO neighborhoods (name, region, geo_hash, lat, lng) VALUES (${payload.neighborhoodName}, ${payload.regionName || "Unknown"}, ${"manual_" + String(payload.neighborhoodName).toLowerCase().replace(/\s/g, "_")}, 0.0, 0.0) RETURNING id`) as unknown as any[];
            neighborhoodId = created[0].id;
          }
        }

        if (neighborhoodId) {
          const rows = (await sql`
            INSERT INTO micro_truths (
              neighborhood_id, category, content, user_hash, trust_score, status
            ) VALUES (
              ${neighborhoodId}, ${payload.category || "safety"},
              ${sanitizeText(payload.content || "")}, ${item.created_by}, 50, 'active'
            ) RETURNING id
          `) as unknown as any[];

          await sql`UPDATE scheduled_content SET status = 'published', published_ref_id = ${rows[0].id} WHERE id = ${item.id}`;
        } else {
          throw new Error("Could not resolve neighborhood");
        }
      }

      processed++;
    } catch (err: any) {
      failed++;
      errors.push({ id: item.id, error: err.message || "Unknown error" });
      await sql`UPDATE scheduled_content SET status = 'failed', error_message = ${err.message || "Unknown error"} WHERE id = ${item.id}`;
    }
  }

  return Response.json({ processed, failed, errors: errors.slice(0, 10) });
}
