import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const scheduleSchema = z.object({
  contentType: z.enum(["truth", "news"]),
  payload: z.record(z.string(), z.any()),
  scheduledAt: z.string().datetime(),
});

/** POST /api/schedule — create a scheduled post */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });

  const { contentType, payload, scheduledAt } = parsed.data;
  const scheduledDate = new Date(scheduledAt);

  if (scheduledDate <= new Date()) {
    return Response.json({ message: "Scheduled time must be in the future" }, { status: 400 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  const rows = (await sql`
    INSERT INTO scheduled_content (content_type, payload, scheduled_at, created_by)
    VALUES (${contentType}, ${JSON.stringify(payload)}, ${scheduledDate}, ${userHash})
    RETURNING *
  `) as unknown as any[];

  return Response.json({
    id: rows[0].id,
    contentType: rows[0].content_type,
    payload: rows[0].payload,
    scheduledAt: rows[0].scheduled_at,
    status: rows[0].status,
    createdAt: rows[0].created_at,
  }, { status: 201 });
}

/** GET /api/schedule — list user's scheduled posts */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const userHash = await getUserId(request);
  const sql = getDb();

  const rows = (await sql`
    SELECT * FROM scheduled_content
    WHERE created_by = ${userHash}
    ORDER BY scheduled_at ASC
  `) as unknown as any[];

  return Response.json({
    scheduled: rows.map(r => ({
      id: r.id,
      contentType: r.content_type,
      payload: r.payload,
      scheduledAt: r.scheduled_at,
      status: r.status,
      publishedRefId: r.published_ref_id,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    })),
  });
}
