import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "single_choice", "multiple_choice", "rating", "scale"]),
  question: z.string().min(3),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  minRating: z.number().optional(),
  maxRating: z.number().optional(),
});

const questionnaireBodySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["general", "power", "fuel", "traffic", "prices", "safety", "community"]).default("general"),
  questions: z.array(questionSchema).min(1).max(20),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/questionnaires
 * Lists all active questionnaires.
 */
export async function GET() {
  await ensureDbInitialized();
  const sql = getDb();

  try {
    const rows = (await sql`
      SELECT * FROM questionnaires
      WHERE status = 'active'
      ORDER BY created_at DESC
    `) as unknown as any[];

    return Response.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      questions: typeof r.questions === "string" ? JSON.parse(r.questions) : r.questions,
      status: r.status,
      responseCount: r.response_count,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })));
  } catch (err) {
    console.error("[Questionnaires] List error:", err);
    return Response.json({ message: "Failed to fetch questionnaires" }, { status: 500 });
  }
}

/**
 * POST /api/questionnaires
 * Creates a new questionnaire.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = questionnaireBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    const rows = (await sql`
      INSERT INTO questionnaires (clerk_user_id, user_hash, title, description, category, questions, expires_at)
      VALUES (${clerkUserId}, ${userHash}, ${parsed.data.title}, ${parsed.data.description || null}, ${parsed.data.category}, ${JSON.stringify(parsed.data.questions)}, ${parsed.data.expiresAt || null})
      RETURNING *
    `) as unknown as any[];

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
    }, { status: 201 });
  } catch (err) {
    console.error("[Questionnaires] Create error:", err);
    return Response.json({ message: "Failed to create questionnaire" }, { status: 500 });
  }
}
