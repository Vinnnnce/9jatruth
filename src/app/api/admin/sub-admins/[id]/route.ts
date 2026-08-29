import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Sub-Admin Management by ID.
 * GET    /api/admin/sub-admins/[id]   → get a specific sub-admin with assignments
 * PATCH  /api/admin/sub-admins/[id]   → update sub-admin (role, status, display_name)
 * DELETE /api/admin/sub-admins/[id]   → deactivate sub-admin (soft delete)
 */

const idParamSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });

const updateSubAdminSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  roleId: z.coerce.number().int().positive().max(1_000_000).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsedId = idParamSchema.safeParse({ id });
    if (!parsedId.success) {
      return Response.json({ message: "Invalid sub-admin id" }, { status: 400 });
    }

    const sql = getDb();
    const subAdminId = parsedId.data.id;

    const rows = (await sql`
      SELECT au.*, ar.name AS role_name, ar.permissions
      FROM admin_users au
      LEFT JOIN admin_roles ar ON au.role_id = ar.id
      WHERE au.id = ${subAdminId}
      LIMIT 1
    `) as unknown as any[];

    if (rows.length === 0) {
      return Response.json({ message: "Sub-admin not found" }, { status: 404 });
    }

    // Fetch assignments
    const assignments = (await sql`
      SELECT aa.*, ar.name AS role_name
      FROM admin_assignments aa
      LEFT JOIN admin_roles ar ON aa.role_id = ar.id
      WHERE aa.admin_user_id = ${subAdminId}
      ORDER BY aa.assigned_at DESC
    `) as unknown as any[];

    return Response.json({
      adminUser: rows[0],
      assignments,
    });
  } catch (err: any) {
    console.error("[admin/sub-admins/[id]] GET failed:", err);
    return Response.json({ message: "Failed to load sub-admin" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;

    const clerkUserId = await getClerkUserId();

    const { id } = await params;
    const parsedId = idParamSchema.safeParse({ id });
    if (!parsedId.success) {
      return Response.json({ message: "Invalid sub-admin id" }, { status: 400 });
    }
    const subAdminId = parsedId.data.id;

    const body = await request.json().catch(() => null);
    const parsed = updateSubAdminSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid request", errors: parsed.error.flatten() }, { status: 400 });
    }
    const { displayName, roleId, status } = parsed.data;

    const sql = getDb();

    // Verify the sub-admin exists
    const existing = (await sql`SELECT * FROM admin_users WHERE id = ${subAdminId} LIMIT 1`) as unknown as any[];
    if (existing.length === 0) {
      return Response.json({ message: "Sub-admin not found" }, { status: 404 });
    }

    // If roleId is provided, validate it exists
    if (roleId) {
      const roleExists = (await sql`SELECT id FROM admin_roles WHERE id = ${roleId} LIMIT 1`) as unknown as any[];
      if (roleExists.length === 0) {
        return Response.json({ message: "Specified role does not exist" }, { status: 400 });
      }
    }

    // Build the UPDATE query dynamically
    const updated = (await sql`
      UPDATE admin_users
      SET
        display_name = COALESCE(${displayName ?? null}, display_name),
        role_id = COALESCE(${roleId ?? null}, role_id),
        status = COALESCE(${status ?? null}, status),
        updated_at = NOW()
      WHERE id = ${subAdminId}
      RETURNING *
    `) as unknown as any[];

    // If roleId changed, update admin_assignments
    if (roleId && existing[0].role_id !== roleId) {
      // Deactivate old assignments
      await sql`
        UPDATE admin_assignments
        SET status = 'inactive', revoked_at = NOW()
        WHERE admin_user_id = ${subAdminId} AND status = 'active'
      `;
      // Create new assignment
      await sql`
        INSERT INTO admin_assignments (admin_user_id, role_id, scope, assigned_by)
        VALUES (${subAdminId}, ${roleId}, 'global', ${clerkUserId ?? null})
        ON CONFLICT (admin_user_id, role_id, scope, scope_entity_type, scope_entity_id) DO NOTHING
      `;
    }

    // Fetch the full record with role info
    const fullRecord = (await sql`
      SELECT au.*, ar.name AS role_name, ar.permissions
      FROM admin_users au
      LEFT JOIN admin_roles ar ON au.role_id = ar.id
      WHERE au.id = ${subAdminId}
    `) as unknown as any[];

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId ?? "super-admin"}, 'super-admin', 'super_admin', 'update_sub_admin',
                'admin_user', ${subAdminId}, ${"Updated sub-admin: " + existing[0].email},
                ${JSON.stringify({ displayName: displayName ?? null, roleId: roleId ?? null, status: status ?? null })})
      `;
    } catch (err) {
      console.error("[admin/sub-admins/[id]] Audit log error:", err);
    }

    return Response.json({ adminUser: fullRecord[0] });
  } catch (err: any) {
    console.error("[admin/sub-admins/[id]] PATCH failed:", err);
    return Response.json({ message: "Failed to update sub-admin" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;

    const clerkUserId = await getClerkUserId();

    const { id } = await params;
    const parsedId = idParamSchema.safeParse({ id });
    if (!parsedId.success) {
      return Response.json({ message: "Invalid sub-admin id" }, { status: 400 });
    }
    const subAdminId = parsedId.data.id;

    const sql = getDb();

    // Verify the sub-admin exists
    const existing = (await sql`SELECT * FROM admin_users WHERE id = ${subAdminId} LIMIT 1`) as unknown as any[];
    if (existing.length === 0) {
      return Response.json({ message: "Sub-admin not found" }, { status: 404 });
    }

    // Soft delete: set status to 'inactive', don't actually delete
    await sql`
      UPDATE admin_users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = ${subAdminId}
    `;

    // Also deactivate all assignments
    await sql`
      UPDATE admin_assignments
      SET status = 'inactive', revoked_at = NOW()
      WHERE admin_user_id = ${subAdminId} AND status = 'active'
    `;

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId ?? "super-admin"}, 'super-admin', 'super_admin', 'deactivate_sub_admin',
                'admin_user', ${subAdminId}, ${"Deactivated sub-admin: " + existing[0].email},
                ${JSON.stringify({ status: "inactive" })})
      `;
    } catch (err) {
      console.error("[admin/sub-admins/[id]] Audit log error:", err);
    }

    return Response.json({ message: "Sub-admin deactivated successfully" });
  } catch (err: any) {
    console.error("[admin/sub-admins/[id]] DELETE failed:", err);
    return Response.json({ message: "Failed to deactivate sub-admin" }, { status: 500 });
  }
}
