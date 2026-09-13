import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Accept (approve) a pending organization request.
 * POST /api/admin/organisations/[id]/accept
 *
 * Super admin only. Sets organization status to 'accepted', stamps verification
 * badge, verified_by, verified_at. Logs to audit_log.
 */
const idSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });
const bodySchema = z.object({
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
  const { badge, notes } = parsed.data;

  // Check org exists
  const orgs = (await sql`SELECT * FROM organizations WHERE id = ${orgId} LIMIT 1`) as unknown as any[];
  if (orgs.length === 0) {
    return Response.json({ message: "Organization not found" }, { status: 404 });
  }

  const org = orgs[0];

  if (org.verification_status === "accepted") {
    return Response.json({ message: "Organization already accepted" }, { status: 400 });
  }

  // Update org status
  const updated = (await sql`
    UPDATE organizations
    SET verification_status = 'accepted',
        verified = 1,
        verification_badge = ${badge ?? "verified"},
        verified_at = NOW(),
        verified_by = ${adminClerkId ?? null},
        verification_notes = ${notes ?? null},
        updated_at = NOW()
    WHERE id = ${orgId}
    RETURNING *
  `) as unknown as any[];

  // Audit log
  await sql`
    INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
    VALUES (
      ${adminClerkId},
      'ACCEPT_ORGANISATION',
      'organisation',
      ${orgId},
      ${org.contact_email ?? null},
      ${notes ?? "Organisation request accepted"},
      ${JSON.stringify({ orgName: org.name, badge: badge ?? "verified" })}
    )
  `;

  return Response.json({
    success: true,
    message: "Organisation accepted successfully",
    organization: updated[0],
  });
}
