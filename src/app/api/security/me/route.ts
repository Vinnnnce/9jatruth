/**
 * GET /api/security/me — returns the current user's security member profile,
 * effective permissions, and whether 2FA is enabled. Used by the member
 * dashboard to render a role-scoped view.
 */
import { withSecurity } from "@/lib/security-middleware";
import { resolveMemberPermissions } from "@/lib/security-engine/security-storage";
import { isSuperAdminEmailCheck } from "@/lib/security-engine/rbac";

export const GET = withSecurity(
  async (_request, ctx) => {
    const isSuper = isSuperAdminEmailCheck(ctx.email);
    if (isSuper) {
      return Response.json({
        isSuperAdmin: true,
        member: null,
        permissions: ["*"],
        twoFactorEnabled: false,
      });
    }
    const { permissions, member } = await resolveMemberPermissions({
      email: ctx.email,
      clerkUserId: ctx.clerkUserId,
    });
    return Response.json({
      isSuperAdmin: false,
      member,
      permissions,
      twoFactorEnabled: member?.twoFactorEnabled ?? false,
    });
  },
  {
    requireAuth: true,
    rateLimit: { max: 60, windowMs: 60_000 },
    eventType: "security_me",
  }
);
