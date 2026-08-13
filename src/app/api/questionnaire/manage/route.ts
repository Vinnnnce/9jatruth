import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
});

const questionSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(500),
  type: z.enum(["text", "textarea", "single-choice", "multiple-choice", "rating", "boolean"]).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string().max(200)).max(20).optional(),
  placeholder: z.string().max(200).optional(),
});

const createQuestionnaireSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionSchema).min(1).max(50),
  status: z.enum(["active", "inactive"]).default("active"),
});

/**
 * GET /api/questionnaire/manage — list all questionnaires (admin)
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 50;
  const offset = parsed.success ? parsed.data.offset : 0;
  const status = parsed.success ? parsed.data.status : undefined;

  const sql = getDb();

  const rows = status
    ? ((await sql`
        SELECT * FROM questionnaires WHERE status = ${status}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[])
    : ((await sql`
        SELECT * FROM questionnaires
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[]);

  return Response.json({
    questionnaires: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      questions: r.questions ? JSON.parse(r.questions) : [],
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    limit,
    offset,
  });
}

/**
 * POST /api/questionnaire/manage — admin create questionnaire with questions array
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(createQuestionnaireSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();

  const rows = (await sql`
    INSERT INTO questionnaires (title, description, questions, status, created_by)
    VALUES (${data.title}, ${data.description || null}, ${JSON.stringify(data.questions)},
            ${data.status}, ${clerkUserId})
    RETURNING *
  `) as unknown as any[];

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'create_questionnaire',
              'questionnaire', ${rows[0].id}, ${'Created questionnaire: ' + data.title},
              ${JSON.stringify({ title: data.title, questionCount: data.questions.length })})
    `;
  } catch (err) {
    console.error("[questionnaire/manage/POST] Audit log error:", err);
  }

  return Response.json(
    {
      id: rows[0].id,
      title: rows[0].title,
      description: rows[0].description,
      questions: JSON.parse(rows[0].questions),
      status: rows[0].status,
      createdBy: rows[0].created_by,
      createdAt: rows[0].created_at,
    },
    { status: 201 }
  );
}
