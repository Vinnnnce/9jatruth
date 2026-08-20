import { ensureDbInitialized } from "@/lib/db";
import { getReferralStats, recordReferral, ReferralStats } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

/**
 * GET /api/rewards/referrals
 * Returns the current user's referral code, shareable link, and stats.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const userHash = await getUserId(request);
  const stats: ReferralStats = await getReferralStats(userHash);
  return Response.json(stats);
}

/**
 * POST /api/rewards/referrals  { referrerCode: string }
 * Records that the current user was referred by `referrerCode`. Idempotent;
 * rejects self-referrals and users who already have a referrer.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const body = await request.json().catch(() => ({}));
  const referrerCode = typeof body?.referrerCode === "string" ? body.referrerCode.trim() : "";

  if (!referrerCode) {
    return Response.json({ ok: false, reason: "no_code" }, { status: 400 });
  }

  const referredHash = await getUserId(request);
  if (!referredHash || referredHash === "dev_anon" || referredHash === "dev_1d6e") {
    return Response.json({ ok: false, reason: "not_authenticated" }, { status: 401 });
  }

  const result = await recordReferral(referrerCode, referredHash);
  return Response.json({ ok: result.created, reason: result.reason ?? null });
}
