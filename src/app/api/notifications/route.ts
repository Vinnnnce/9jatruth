import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, sanitizeText, validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * GET /api/notifications — List notifications for the current user
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();
  const rows = (await sql`
    SELECT id, title, message, type, read, action_url, created_at
    FROM notifications
    WHERE user_hash = ${userHash}
    ORDER BY created_at DESC
    LIMIT 50
  `) as unknown as any[];

  return Response.json(rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.read,
    actionUrl: r.action_url,
    createdAt: r.created_at,
  })));
}

/**
 * POST /api/notifications — Create a notification (system/admin use)
 */
const createSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  type: z.string().max(50).default("info"),
  userHash: z.string().min(1).max(100),
  actionUrl: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = validate(createSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    const sql = getDb();
    const rows = (await sql`
      INSERT INTO notifications (user_hash, title, message, type, action_url, read, created_at)
      VALUES (${data.userHash}, ${sanitizeText(data.title)}, ${sanitizeText(data.message)}, ${data.type}, ${data.actionUrl ?? null}, 0, ${new Date().toISOString()})
      RETURNING id, title, message, type, read, action_url, created_at
    `) as unknown as any[];

    return Response.json({
      id: rows[0].id,
      title: rows[0].title,
      message: rows[0].message,
      type: rows[0].type,
      read: rows[0].read,
      actionUrl: rows[0].action_url,
      createdAt: rows[0].created_at,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({ message: "Validation error", errors: err.issues });
    }
    throw err;
  }
}
