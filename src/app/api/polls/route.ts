import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
 validationErrorResponse,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const createPollSchema = z.object({
  question: z.string().trim().min(5).max(500),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
  expiresInHours: z.number().min(1).max(168).optional(),
  contentId: z.number().int().optional(),
});

/** GET /api/polls — list active polls */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get("contentId");
  const limit = Math.min(Number(searchParams.get("limit") || "20"), 100);

  const rows = contentId
    ? (await sql`SELECT * FROM polls WHERE content_id = ${Number(contentId)} AND is_active = true ORDER BY created_at DESC LIMIT ${limit}`) as unknown as any[]
    : (await sql`SELECT * FROM polls WHERE is_active = true ORDER BY created_at DESC LIMIT ${limit}`) as unknown as any[];

  const pollIds = rows.map(r => r.id);
  if (pollIds.length === 0) return Response.json({ polls: [] });

  const options = (await sql`SELECT * FROM poll_options WHERE poll_id = ANY(${pollIds}) ORDER BY display_order`) as unknown as any[];

  const polls = rows.map(p => ({
    id: p.id,
    question: p.question,
    contentType: p.content_type,
    contentId: p.content_id,
    isActive: p.is_active,
    totalVotes: p.total_votes,
    expiresAt: p.expires_at,
    createdAt: p.created_at,
    options: options.filter(o => o.poll_id === p.id).map(o => ({
      id: o.id,
      text: o.text,
      voteCount: o.vote_count,
    })),
  }));

  return Response.json({ polls });
}

/** POST /api/polls — create a poll (requires auth) */
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

  const parsed = validate(createPollSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const userHash = await getUserId(request);
  const sql = getDb();

  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 3600 * 1000)
    : null;

  const pollRows = (await sql`
    INSERT INTO polls (question, content_type, content_id, created_by, is_active, expires_at)
    VALUES (${data.question}, 'truth', ${data.contentId || null}, ${userHash}, true, ${expiresAt})
    RETURNING *
  `) as unknown as any[];

  const pollId = pollRows[0].id;

  for (let i = 0; i < data.options.length; i++) {
    await sql`
      INSERT INTO poll_options (poll_id, text, display_order)
      VALUES (${pollId}, ${data.options[i]}, ${i})
    `;
  }

  return Response.json({
    id: pollId,
    question: data.question,
    options: data.options.map((text, i) => ({ text, displayOrder: i })),
    expiresAt,
  }, { status: 201 });
}
