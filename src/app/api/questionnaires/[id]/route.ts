import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const responseBodySchema = z.object({
  answers: z.record(z.string(), z.any()),
});

/**
 * GET /api/questionnaires/[id]
 * Returns a single questionnaire with its questions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const qId = parseInt(id, 10);
  if (isNaN(qId) || qId < 1) {
    return Response.json({ message: "Invalid questionnaire ID" }, { status: 400 });
  }

  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT * FROM questionnaires WHERE id = ${qId}
    `) as unknown as any[];

    if (!rows[0]) {
      return Response.json({ message: "Questionnaire not found" }, { status: 404 });
    }

    return Response.json({
      id: rows[0].id,
      title: rows[0].title,
      description: rows[0].description,
      category: rows[0].category,
      questions: typeof rows[0].questions === "string" ? JSON.parse(rows[0].questions) : rows[0].questions,
      status: rows[0].status,
      responseCount: rows[0].response_count,
      expiresAt: rows[0].expires_at,
      createdAt: rows[0].created_at,
    });
  } catch (err) {
    console.error("[Questionnaires] Get error:", err);
    return Response.json({ message: "Failed to fetch questionnaire" }, { status: 500 });
  }
}

/**
 * POST /api/questionnaires/[id]/responses
 * Submits a response to a questionnaire.
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
  const qId = parseInt(id, 10);
  if (isNaN(qId) || qId < 1) {
    return Response.json({ message: "Invalid questionnaire ID" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = responseBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    // Check questionnaire exists and is active
    const qRows = (await sql`
      SELECT id, status, expires_at FROM questionnaires WHERE id = ${qId}
    `) as unknown as any[];

    if (!qRows[0]) {
      return Response.json({ message: "Questionnaire not found" }, { status: 404 });
    }

    if (qRows[0].status !== "active") {
      return Response.json({ message: "This questionnaire is no longer active" }, { status: 400 });
    }

    if (qRows[0].expires_at && new Date(qRows[0].expires_at) < new Date()) {
      return Response.json({ message: "This questionnaire has expired" }, { status: 400 });
    }

    // Insert or update response (unique constraint on questionnaire_id + user_hash)
    await sql`
      INSERT INTO questionnaire_responses (questionnaire_id, clerk_user_id, user_hash, answers)
      VALUES (${qId}, ${clerkUserId}, ${userHash}, ${JSON.stringify(parsed.data.answers)})
      ON CONFLICT (questionnaire_id, user_hash)
      DO UPDATE SET answers = ${JSON.stringify(parsed.data.answers)}, created_at = NOW()
    `;

    // Update response count
    await sql`
      UPDATE questionnaires
      SET response_count = (
        SELECT COUNT(*) FROM questionnaire_responses WHERE questionnaire_id = ${qId}
      )
      WHERE id = ${qId}
    `;

    return Response.json({ message: "Response submitted successfully" }, { status: 201 });
  } catch (err) {
    console.error("[Questionnaires] Response error:", err);
    return Response.json({ message: "Failed to submit response" }, { status: 500 });
  }
}
