import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/roles/list
 *
 * Returns all admin roles from the database (not the hardcoded RBAC ones),
 * including a count of users assigned to each role. If no roles exist, seeds
 * the default roles.
 */

const DEFAULT_ROLES = [
  { name: "super_admin", description: "Full access to all admin features", permissions: '["*"]', is_system: true },
  { name: "content_moderator", description: "Moderate user-generated content", permissions: '["content:read","content:moderate"]', is_system: false },
  { name: "news_editor", description: "Create and edit news articles", permissions: '["news:read","news:write","news:edit"]', is_system: false },
  { name: "rewards_manager", description: "Manage rewards and incentive programs", permissions: '["rewards:read","rewards:manage"]', is_system: false },
  { name: "security_analyst", description: "Access to security and audit logs", permissions: '["security:read","audit:read"]', is_system: false },
];

export async function GET() {
  try {
    await ensureDbInitialized();
    const auth = await requireSuperAdmin();
    if ("error" in auth) return auth.error;

    const sql = getDb();

    let roles = (await sql`SELECT * FROM admin_roles ORDER BY name`) as unknown as any[];

    // If no roles exist, seed defaults
    if (roles.length === 0) {
      for (const role of DEFAULT_ROLES) {
        await sql`
          INSERT INTO admin_roles (name, description, permissions, is_system)
          VALUES (${role.name}, ${role.description}, ${role.permissions}, ${role.is_system})
          ON CONFLICT (name) DO NOTHING
        `;
      }
      roles = (await sql`SELECT * FROM admin_roles ORDER BY name`) as unknown as any[];
    }

    // Get user count per role
    const roleIds = roles.map((r) => r.id);
    let userCounts: any[] = [];
    if (roleIds.length > 0) {
      userCounts = (await sql`
        SELECT role_id, COUNT(*) AS user_count
        FROM admin_users
        WHERE role_id = ANY(${roleIds}::int[])
        GROUP BY role_id
      `) as unknown as any[];
    }

    const countMap = new Map<number, number>();
    for (const uc of userCounts) {
      countMap.set(uc.role_id, parseInt(uc.user_count, 10));
    }

    const result = roles.map((role) => ({
      ...role,
      userCount: countMap.get(role.id) ?? 0,
    }));

    return Response.json({ roles: result, count: result.length });
  } catch (err: any) {
    console.error("[admin/roles/list] GET failed:", err);
    return Response.json({ message: "Failed to load admin roles" }, { status: 500 });
  }
}
