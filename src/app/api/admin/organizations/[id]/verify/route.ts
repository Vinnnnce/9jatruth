import { ensureDbInitialized, getDb } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * Verify / accept a pending organization from the super-admin dashboard.
 * POST /api/admin/organizations/[id]/verify  { action: "approve" | "reject", badge?, notes? }
 *
 * Super-admin only. Approving flips `organizations.verified` to 1 and stamps a
 * verification badge; rejecting sets it to 0. The org row is never deleted.
 */
const idParamSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });
const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  badge: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = idParamSchema.safeParse({ id });
  if (!parsedId.success) return Response.json({ message: "Invalid org id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });

  const sql = getDb();
  const orgId = parsedId.data.id;
  const { action } = parsed.data;
  const verified = action === "approve" ? 1 : 0;
  const badge = action === "approve" ? (parsed.data.badge ?? "verified") : null;

  const updated = (await sql`
    UPDATE organizations
    SET verified = ${verified}, verification_badge = ${badge}
    WHERE id = ${orgId}
    RETURNING id, name, type, verified, verification_badge
  `) as unknown as any[];

  if (updated.length === 0) {
    return Response.json({ message: "Organization not found" }, { status: 404 });
  }

  // Audit log entry
  await sql`
    INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
    VALUES ('super-admin', 'super-admin', 'super-admin', ${action + "_org"}, 'organization', ${orgId},
            ${"Organization " + action + "ed"}, ${JSON.stringify({ verified, badge, notes: parsed.data.notes ?? null })})
  `.catch(() => {});

  return Response.json({ organization: updated[0], action });
}
