import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Decline (reject) a pending organization request.
 * POST /api/admin/organisations/[id]/decline
 *
 * Super admin only. Sets organization status to 'declined', records reason.
 * Logs to audit_log. The org row is NOT deleted.
 */
const idSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });
const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  await ensureDbInitialized();

  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const adminClerkId = await getClerkUserId();

  const { id } = await params;
  const parsedId = idSchema.safeParse({ id });
  if (!parsedId.success)
    return Response.json({ message: "Invalid org id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { message: "Invalid body", errors: parsed.error.flatten() },
      { status: 400 }
    );

  const sql = getDb();
  const orgId = parsedId.data.id;
  const { reason } = parsed.data;

  // Check org exists
  const orgs = (await sql`SELECT * FROM organizations WHERE id = ${orgId} LIMIT 1`) as unknown as any[];
  if (orgs.length === 0) {
    return Response.json({ message: "Organization not found" }, { status: 404 });
  }

  const org = orgs[0];

  if (org.verification_status === "declined") {
    return Response.json({ message: "Organization already declined" }, { status: 400 });
  }

  // Update org status
  const updated = (await sql`
    UPDATE organizations
    SET verification_status = 'declined',
        verified = 0,
        verification_notes = ${reason ?? "Declined by super admin"},
        updated_at = NOW()
    WHERE id = ${orgId}
    RETURNING *
  `) as unknown as any[];

  // Audit log
  await sql`
    INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
    VALUES (
      ${adminClerkId},
      'DECLINE_ORGANISATION',
      'organisation',
      ${orgId},
      ${org.contact_email ?? null},
      ${reason ?? "Organisation request declined"},
      ${JSON.stringify({ orgName: org.name })}
    )
  `;

  return Response.json({
    success: true,
    message: "Organisation declined",
    organization: updated[0],
  });
}
