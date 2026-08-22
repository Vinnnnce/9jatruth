import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * PATCH /api/admin/politics/abuse-signals/[id]
 * Resolve / unresolve an abuse signal (super-admin).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const resolved = z.boolean().optional().parse(body.resolved);
  const sql = getDb();
  const updated = (await sql`
    UPDATE political_abuse_signals
    SET resolved = COALESCE(${resolved ?? null}, resolved)
    WHERE id = ${Number(id)}
    RETURNING *
  `) as unknown as any[];
  if (updated.length === 0) return Response.json({ message: "Signal not found" }, { status: 404 });
  return Response.json({ signal: updated[0] });
}
