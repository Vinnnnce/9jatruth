/**
 * GET /api/admin/security — Security dashboard overview stats.
 * Super admin or members with security.dashboard.view permission.
 */
import { withSecurity } from "@/lib/security-middleware";
import { getSecurityStats } from "@/lib/security-engine/security-storage";

export const GET = withSecurity(
  async () => {
    const stats = await getSecurityStats();
    return Response.json(stats);
  },
  {
    requirePermission: "security.dashboard.view",
    eventType: "admin_security_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);
