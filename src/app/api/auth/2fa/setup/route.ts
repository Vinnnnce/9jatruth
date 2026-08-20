/**
 * POST /api/auth/2fa/setup
 * Generates a TOTP secret + otpauth URI for the current user to scan.
 * The secret is NOT persisted until /verify confirms the user can produce a
 * valid code (prevents locking out a user who can't scan the QR).
 */
import { withSecurity } from "@/lib/security-middleware";
import { createTwoFactorSetup } from "@/lib/security-engine/two-factor";

export const POST = withSecurity(
  async (request, ctx) => {
    if (!ctx.email) {
      return Response.json({ message: "Email required to set up 2FA" }, { status: 400 });
    }
    const setup = createTwoFactorSetup(ctx.email);
    // Return the secret + URI + backup codes to the client. The client shows
    // the QR; the user enters a code; /verify confirms and persists.
    // NOTE: backup codes are returned once here — they must be saved by the user.
    return Response.json({
      secret: setup.secret,
      otpAuthUri: setup.otpAuthUri,
      backupCodes: setup.backupCodes,
    });
  },
  {
    requireAuth: true,
    rateLimit: { max: 5, windowMs: 60_000 },
    eventType: "2fa_setup",
  }
);
