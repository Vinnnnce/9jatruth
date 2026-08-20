/**
 * POST /api/auth/2fa/disable
 * Disables 2FA for the current member (requires the current TOTP code).
 */
import { withSecurity } from "@/lib/security-middleware";
import { verifyTOTP } from "@/lib/security-engine/two-factor";
import { getMemberByEmail, getMemberByClerkId } from "@/lib/security-engine/security-storage";
import { getDb } from "@/lib/db";
import { isSuperAdminEmailCheck } from "@/lib/security-engine/rbac";
import { z } from "zod";

const disableSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }

    if (ctx.email && isSuperAdminEmailCheck(ctx.email)) {
      return Response.json({ success: true, message: "2FA disabled for super admin." });
    }

    const member =
      (ctx.clerkUserId ? await getMemberByClerkId(ctx.clerkUserId) : null) ??
      (ctx.email ? await getMemberByEmail(ctx.email) : null);

    if (!member || !member.twoFactorEnabled) {
      return Response.json({ message: "2FA is not enabled" }, { status: 400 });
    }

    if (!verifyTOTP(member.twoFactorSecret ?? "", parsed.data.code)) {
      return Response.json({ message: "Invalid verification code" }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      UPDATE security_members
      SET two_factor_enabled = false,
          two_factor_secret = NULL,
          two_factor_backup_codes = NULL,
          updated_at = NOW()
      WHERE id = ${member.id}
    `;

    return Response.json({ success: true });
  },
  {
    requireAuth: true,
    rateLimit: { max: 10, windowMs: 60_000 },
    eventType: "2fa_disable",
  }
);
