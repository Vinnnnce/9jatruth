import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const feedbackBodySchema = z.object({
  type: z.enum(["suggestion", "bug", "feature"]).default("suggestion"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
  category: z.enum(["general", "ui", "performance", "content", "security", "other"]).default("general"),
});

/**
 * GET /api/feedback
 * Returns all feedback entries ordered by most recent / most upvoted.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const type = searchParams.get("type") || "all";

  const sql = getDb();
  try {
    let rows: any[];
    if (status !== "all" && type !== "all") {
      rows = (await sql`
        SELECT * FROM user_feedback WHERE status = ${status} AND type = ${type}
        ORDER BY upvotes DESC, created_at DESC
      `) as unknown as any[];
    } else if (status !== "all") {
      rows = (await sql`
        SELECT * FROM user_feedback WHERE status = ${status}
        ORDER BY upvotes DESC, created_at DESC
      `) as unknown as any[];
    } else if (type !== "all") {
      rows = (await sql`
        SELECT * FROM user_feedback WHERE type = ${type}
        ORDER BY upvotes DESC, created_at DESC
      `) as unknown as any[];
    } else {
      rows = (await sql`
        SELECT * FROM user_feedback ORDER BY upvotes DESC, created_at DESC
      `) as unknown as any[];
    }

    return Response.json(rows.map((r) => ({
      id: r.id,
      clerkUserId: r.clerk_user_id,
      userHash: r.user_hash,
      type: r.type,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      priority: r.priority,
      upvotes: r.upvotes,
      adminResponse: r.admin_response,
      respondedAt: r.responded_at,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error("[Feedback] List error:", err);
    return Response.json({ message: "Failed to fetch feedback" }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Creates a new feedback entry (suggestion or bug report).
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  // Allow anonymous feedback but track if logged in
  const userHash = await getUserId(request).catch(() => "anonymous");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const sql = getDb();
  try {
    const rows = (await sql`
      INSERT INTO user_feedback (clerk_user_id, user_hash, type, title, description, category)
      VALUES (${clerkUserId || null}, ${userHash}, ${parsed.data.type}, ${parsed.data.title}, ${parsed.data.description}, ${parsed.data.category})
      RETURNING *
    `) as unknown as any[];

    return Response.json({
      id: rows[0].id,
      type: rows[0].type,
      title: rows[0].title,
      description: rows[0].description,
      category: rows[0].category,
      status: rows[0].status,
      upvotes: rows[0].upvotes,
      createdAt: rows[0].created_at,
    }, { status: 201 });
  } catch (err) {
    console.error("[Feedback] Create error:", err);
    return Response.json({ message: "Failed to create feedback" }, { status: 500 });
  }
}
