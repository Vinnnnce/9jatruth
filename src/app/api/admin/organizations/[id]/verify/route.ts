import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Verify / accept a pending organization from the super-admin dashboard.
 * POST /api/admin/organizations/[id]/verify  { action: "approve" | "reject", badge?, notes? }
 *
 * Super-admin only. Approving flips `organizations.verified` to 1 and stamps a
 * verification badge + verified_by + verified_at; rejecting sets it to 0 and
 * records verification_notes. The org row is never deleted.
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
  try {
    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;
    await ensureDbInitialized();

    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const clerkUserId = await getClerkUserId();

    const { id } = await params;
    const parsedId = idParamSchema.safeParse({ id });
    if (!parsedId.success) return Response.json({ message: "Invalid org id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return Response.json({ message: "Invalid body", errors: parsed.error.flatten() }, { status: 400 });

    const sql = getDb();
    const orgId = parsedId.data.id;
    const { action, notes } = parsed.data;

    // 1. Validate that the organization exists and is active
    const orgs = (await sql`SELECT * FROM organizations WHERE id = ${orgId} LIMIT 1`) as unknown as any[];
    if (orgs.length === 0) {
      return Response.json({ message: "Organization not found" }, { status: 404 });
    }
    const org = orgs[0];

    if (!org.active || org.active !== 1) {
      return Response.json({ message: "Organization is not active" }, { status: 400 });
    }

    // 2. Validate required fields
    const missingFields: string[] = [];
    if (!org.name) missingFields.push("name");
    if (!org.type) missingFields.push("type");
    if (!org.contact_email) missingFields.push("contact_email");
    if (missingFields.length > 0) {
      return Response.json(
        { message: "Organization is missing required fields", missingFields },
        { status: 400 }
      );
    }

    // 3. Apply verification
    if (action === "approve") {
      const badge = parsed.data.badge ?? "verified";
      const updated = (await sql`
        UPDATE organizations
        SET verified = 1,
            verification_badge = ${badge},
            verified_at = NOW(),
            verified_by = ${clerkUserId ?? null},
            verification_notes = ${notes ?? null}
        WHERE id = ${orgId}
        RETURNING *
      `) as unknown as any[];

      // Audit log entry
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId ?? "super-admin"}, 'super-admin', 'super_admin', 'approve_org', 'organization', ${orgId},
                ${"Organization approved: " + org.name},
                ${JSON.stringify({ verified: 1, badge, verified_by: clerkUserId, notes: notes ?? null })})
      `.catch(() => {});

      return Response.json({
        organization: {
          ...updated[0],
          verified: 1,
          verification_badge: badge,
          verified_at: updated[0].verified_at,
          verified_by: clerkUserId,
          verification_notes: notes ?? null,
        },
        action,
      });
    } else {
      // reject
      const updated = (await sql`
        UPDATE organizations
        SET verified = 0,
            verification_badge = NULL,
            verification_notes = ${notes ?? null}
        WHERE id = ${orgId}
        RETURNING *
      `) as unknown as any[];

      // Audit log entry
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId ?? "super-admin"}, 'super-admin', 'super_admin', 'reject_org', 'organization', ${orgId},
                ${"Organization rejected: " + org.name},
                ${JSON.stringify({ verified: 0, badge: null, notes: notes ?? null })})
      `.catch(() => {});

      return Response.json({
        organization: {
          ...updated[0],
          verified: 0,
          verification_badge: null,
          verification_notes: notes ?? null,
        },
        action,
      });
    }
  } catch (err: any) {
    console.error("[admin/organizations/verify] POST failed:", err);
    return Response.json({ message: "Failed to verify organization", detail: String(err?.message || err) }, { status: 500 });
  }
}
