import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** GET /api/politics/candidates/[id] — single candidate with full metadata */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const { id } = await params;
  const sql = getDb();
  const rows = (await sql`
    SELECT c.*, p.name AS party_name, p.color AS party_color, p.logo_url AS party_logo
    FROM political_candidates c
    LEFT JOIN political_parties p ON c.party_acronym = p.acronym
    WHERE c.id = ${parseInt(id, 10)}
  `) as unknown as any[];
  if (!rows.length) return Response.json({ message: "Not found" }, { status: 404 });
  // bump views
  await sql`UPDATE political_candidates SET views = COALESCE(views, 0) + 1 WHERE id = ${parseInt(id, 10)}`.catch(() => {});
  return Response.json({ candidate: rows[0] });
}

/** DELETE /api/politics/candidates/[id] — super admin only */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM political_candidates WHERE id = ${parseInt(id, 10)}`;
  return Response.json({ ok: true });
}

/** PATCH /api/politics/candidates/[id] — update verification_status / data_confidence */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const sql = getDb();
  const rows = (await sql`
    UPDATE political_candidates SET
      verification_status = COALESCE(${body.verification_status ?? null}, verification_status),
      data_confidence = COALESCE(${body.data_confidence ?? null}, data_confidence),
      updated_at = NOW()
    WHERE id = ${parseInt(id, 10)}
    RETURNING *
  `) as unknown as any[];
  if (!rows.length) return Response.json({ message: "Not found" }, { status: 404 });
  return Response.json({ candidate: rows[0] });
}
