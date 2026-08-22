import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * PATCH /api/admin/politics/events/[id]
 * Approve / reject / delete a user-submitted political event (super-admin).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = z.enum(["approved", "rejected", "pending", "flagged"]).parse(body.status);
  const sql = getDb();
  const updated = (await sql`
    UPDATE political_events SET status = ${status}
    WHERE id = ${Number(id)}
    RETURNING *
  `) as unknown as any[];
  if (updated.length === 0) return Response.json({ message: "Event not found" }, { status: 404 });
  return Response.json({ event: updated[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM political_events WHERE id = ${Number(id)}`;
  return Response.json({ success: true });
}
