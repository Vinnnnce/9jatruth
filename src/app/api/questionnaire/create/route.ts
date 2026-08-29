import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * POST /api/questionnaire/create
 *
 * Super admin creates a questionnaire with 24h expiry.
 * Body: { title, description?, questions: [{id, text, type, required?, options?}] }
 *
 * Auto-sets expires_at = NOW() + 24 hours.
 */

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

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();

    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;

    const clerkUserId = await getClerkUserId();

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
      INSERT INTO questionnaires (title, description, questions, status, created_by, expires_at)
      VALUES (${data.title}, ${data.description || null}, ${JSON.stringify(data.questions)},
              ${data.status}, ${clerkUserId}, NOW() + INTERVAL '24 hours')
      RETURNING *
    `) as unknown as any[];

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId}, 'admin', 'super_admin', 'create_questionnaire',
                'questionnaire', ${rows[0].id}, ${"Created questionnaire (24h expiry): " + data.title},
                ${JSON.stringify({ title: data.title, questionCount: data.questions.length, expiresAt: rows[0].expires_at })})
      `;
    } catch (err) {
      console.error("[questionnaire/create] Audit log error:", err);
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
        expiresAt: rows[0].expires_at,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[questionnaire/create] POST failed:", err);
    return Response.json({ message: "Failed to create questionnaire" }, { status: 500 });
  }
}
