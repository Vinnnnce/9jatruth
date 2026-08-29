import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Sub-Admin Management API.
 * GET  /api/admin/sub-admins   → list all admin users with their roles (super admin only)
 * POST /api/admin/sub-admins   → create a new sub-admin (super admin only)
 */

export async function GET() {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const sql = getDb();
    const rows = (await sql`
      SELECT au.*, ar.name AS role_name, ar.permissions
      FROM admin_users au
      LEFT JOIN admin_roles ar ON au.role_id = ar.id
      ORDER BY au.created_at DESC
    `) as unknown as any[];

    return Response.json({ adminUsers: rows, count: rows.length });
  } catch (err: any) {
    console.error("[admin/sub-admins] GET failed:", err);
    return Response.json({ message: "Failed to load admin users" }, { status: 500 });
  }
}

const createSubAdminSchema = z.object({
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100).optional(),
  roleId: z.coerce.number().int().positive().max(1_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const csrfError = csrfCheck(request);
    if (csrfError) return csrfError;

    const clerkUserId = await getClerkUserId();

    const body = await request.json().catch(() => null);
    const parsed = createSubAdminSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid request", errors: parsed.error.flatten() }, { status: 400 });
    }
    const { email, displayName, roleId } = parsed.data;

    const sql = getDb();

    // Check if an admin_user already exists with this email
    const existing = (await sql`SELECT id FROM admin_users WHERE email = ${email} LIMIT 1`) as unknown as any[];
    if (existing.length > 0) {
      return Response.json({ message: "Admin user with this email already exists" }, { status: 409 });
    }

    // If roleId provided, validate it exists
    if (roleId) {
      const roleExists = (await sql`SELECT id FROM admin_roles WHERE id = ${roleId} LIMIT 1`) as unknown as any[];
      if (roleExists.length === 0) {
        return Response.json({ message: "Specified role does not exist" }, { status: 400 });
      }
    }

    // Create the admin_user record
    const created = (await sql`
      INSERT INTO admin_users (email, display_name, role_id, invited_by, status)
      VALUES (${email}, ${displayName ?? null}, ${roleId ?? null}, ${clerkUserId ?? null}, 'active')
      RETURNING *
    `) as unknown as any[];

    const newAdmin = created[0];

    // If roleId provided, also create an admin_assignment
    if (roleId) {
      await sql`
        INSERT INTO admin_assignments (admin_user_id, role_id, scope, assigned_by)
        VALUES (${newAdmin.id}, ${roleId}, 'global', ${clerkUserId ?? null})
        ON CONFLICT (admin_user_id, role_id, scope, scope_entity_type, scope_entity_id) DO NOTHING
      `;
    }

    // Fetch the full record with role info
    const fullRecord = (await sql`
      SELECT au.*, ar.name AS role_name, ar.permissions
      FROM admin_users au
      LEFT JOIN admin_roles ar ON au.role_id = ar.id
      WHERE au.id = ${newAdmin.id}
    `) as unknown as any[];

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
        VALUES (${clerkUserId ?? "super-admin"}, 'super-admin', 'super_admin', 'create_sub_admin',
                'admin_user', ${newAdmin.id}, ${"Created sub-admin: " + email},
                ${JSON.stringify({ email, displayName: displayName ?? null, roleId: roleId ?? null })})
      `;
    } catch (err) {
      console.error("[admin/sub-admins] Audit log error:", err);
    }

    return Response.json({ adminUser: fullRecord[0] }, { status: 201 });
  } catch (err: any) {
    console.error("[admin/sub-admins] POST failed:", err);
    return Response.json({ message: "Failed to create sub-admin" }, { status: 500 });
  }
}
