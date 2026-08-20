/**
 * GET /api/admin/roles — list all role definitions and permissions.
 */
import { withSecurity } from "@/lib/security-middleware";
import { ROLES, getAllPermissions } from "@/lib/security-engine/rbac";

export const GET = withSecurity(
  async () => {
    return Response.json({ roles: ROLES, permissions: getAllPermissions() });
  },
  {
    requirePermission: "security.roles.manage",
    eventType: "admin_roles_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);
