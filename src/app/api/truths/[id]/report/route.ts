import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const reportBodySchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(2000),
});

/**
 * POST /api/truths/[id]/report
 * Allows users to report a post for review.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId) || truthId < 1) {
    return Response.json({ message: "Invalid truth ID" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reportBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    // Check truth exists
    const truthRows = (await sql`SELECT id FROM micro_truths WHERE id = ${truthId}`) as unknown as any[];
    if (!truthRows[0]) {
      return Response.json({ message: "Truth not found" }, { status: 404 });
    }

    // Check for duplicate report from same user
    const existing = (await sql`
      SELECT id FROM truth_reports WHERE truth_id = ${truthId} AND user_hash = ${userHash} LIMIT 1
    `) as unknown as any[];

    if (existing.length > 0) {
      return Response.json(
        { message: "You have already reported this post" },
        { status: 409 }
      );
    }

    // Insert report
    await sql`
      INSERT INTO truth_reports (truth_id, user_hash, reason, status)
      VALUES (${truthId}, ${userHash}, ${parsed.data.reason}, 'pending')
    `;

    return Response.json(
      { message: "Report submitted successfully" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Report] Error:", err);
    return Response.json(
      { message: "Failed to submit report" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/truths/[id]/report
 * Admin endpoint to list reports for a truth.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId) || truthId < 1) {
    return Response.json({ message: "Invalid truth ID" }, { status: 400 });
  }

  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT * FROM truth_reports WHERE truth_id = ${truthId} ORDER BY created_at DESC
    `) as unknown as any[];

    return Response.json(rows.map((r) => ({
      id: r.id,
      truthId: r.truth_id,
      userHash: r.user_hash,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error("[Report] List error:", err);
    return Response.json({ message: "Failed to fetch reports" }, { status: 500 });
  }
}
