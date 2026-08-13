import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const questionSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(500),
  type: z.enum(["text", "textarea", "single-choice", "multiple-choice", "rating", "boolean"]).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string().max(200)).max(20).optional(),
  placeholder: z.string().max(200).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  questions: z.array(questionSchema).min(1).max(50).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/**
 * GET /api/questionnaire/manage/[id] — get single questionnaire
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();
  const rows = (await sql`SELECT * FROM questionnaires WHERE id = ${parsed.data.id}`) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Questionnaire not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    title: r.title,
    description: r.description,
    questions: r.questions ? JSON.parse(r.questions) : [],
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

/**
 * PUT /api/questionnaire/manage/[id] — update questionnaire
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = validate(idParamSchema, { id });
  if (!parsedId.success) return validationErrorResponse(parsedId.error);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(updateSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const sql = getDb();

  // Check exists
  const existing = (await sql`SELECT id FROM questionnaires WHERE id = ${parsedId.data.id}`) as unknown as any[];
  if (existing.length === 0) {
    return Response.json({ message: "Questionnaire not found" }, { status: 404 });
  }

  // Build update
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(data.description || null);
  }
  if (data.questions !== undefined) {
    fields.push(`questions = $${idx++}`);
    values.push(JSON.stringify(data.questions));
  }
  if (data.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(data.status);
  }
  fields.push(`updated_at = NOW()`);
  values.push(parsedId.data.id);

  const rows = (await sql.query(
    `UPDATE questionnaires SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  )) as unknown as any[];

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'update_questionnaire',
              'questionnaire', ${parsedId.data.id}, ${'Updated questionnaire: ' + rows[0].title},
              ${JSON.stringify(data)})
    `;
  } catch (err) {
    console.error("[questionnaire/manage/PUT] Audit log error:", err);
  }

  return Response.json({
    id: rows[0].id,
    title: rows[0].title,
    description: rows[0].description,
    questions: JSON.parse(rows[0].questions),
    status: rows[0].status,
    updatedAt: rows[0].updated_at,
  });
}

/**
 * DELETE /api/questionnaire/manage/[id] — delete questionnaire
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();
  const rows = (await sql`DELETE FROM questionnaires WHERE id = ${parsed.data.id} RETURNING id`) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Questionnaire not found" }, { status: 404 });
  }

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'delete_questionnaire',
              'questionnaire', ${parsed.data.id}, 'Deleted questionnaire')
    `;
  } catch (err) {
    console.error("[questionnaire/manage/DELETE] Audit log error:", err);
  }

  return Response.json({ success: true });
}
