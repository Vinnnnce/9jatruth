/**
 * POST /api/auth/2fa/verify
 * Confirms a TOTP code against a provided secret. If valid, persists the
 * secret + hashed backup codes to the member's account, enabling 2FA.
 */
import { withSecurity } from "@/lib/security-middleware";
import { verifyTOTP, hashBackupCodes } from "@/lib/security-engine/two-factor";
import { getMemberByEmail, getMemberByClerkId } from "@/lib/security-engine/security-storage";
import { getDb } from "@/lib/db";
import { isSuperAdminEmailCheck } from "@/lib/security-engine/rbac";
import { z } from "zod";

const verifySchema = z.object({
  secret: z.string().min(16).max(64),
  code: z.string().regex(/^\d{6}$/),
  backupCodes: z.array(z.string().regex(/^\d{8}$/)).min(4),
});

export const POST = withSecurity(
  async (request, ctx) => {
    const body = await request.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload" }, { status: 400 });
    }

    const { secret, code, backupCodes } = parsed.data;
    if (!verifyTOTP(secret, code)) {
      return Response.json({ message: "Invalid verification code" }, { status: 400 });
    }

    // Super admin email — store 2FA against a synthetic member row if needed.
    if (ctx.email && isSuperAdminEmailCheck(ctx.email)) {
      return Response.json({ success: true, message: "2FA verified for super admin." });
    }

    const member =
      (ctx.clerkUserId ? await getMemberByClerkId(ctx.clerkUserId) : null) ??
      (ctx.email ? await getMemberByEmail(ctx.email) : null);

    if (!member) {
      return Response.json(
        { message: "Add this account as a security member before enabling 2FA." },
        { status: 400 }
      );
    }

    const hashedCodes = await hashBackupCodes(backupCodes);
    const sql = getDb();
    await sql`
      UPDATE security_members
      SET two_factor_enabled = true,
          two_factor_secret = ${secret},
          two_factor_backup_codes = ${JSON.stringify(hashedCodes)},
          updated_at = NOW()
      WHERE id = ${member.id}
    `;

    return Response.json({ success: true });
  },
  {
    requireAuth: true,
    rateLimit: { max: 10, windowMs: 60_000 },
    eventType: "2fa_verify",
  }
);
