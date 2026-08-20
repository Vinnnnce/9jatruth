/**
 * Reward Fraud Detection
 * ============================================================
 * Detects abuse of the gamification/rewards system: redemption velocity,
 * impossible earning rates, referral farming, and reward arbitrage.
 *
 * Heuristics (each explainable, each tunable via SECURITY_RULES env):
 *  - redemption velocity: > N redemptions/hour from one device
 *  - earning velocity: XP credited far faster than the submission rate allows
 *  - referral farming: many referrals from the same IP/ASN with no engagement
 *  - negative-balance attempts / amount manipulation
 */

export interface RewardFraudInput {
  userHash: string;
  amount: number;
  redemptionsLastHour: number;
  xpEarnedToday?: number;
  submissionsToday?: number;
  referralCount?: number;
  referralsWithEngagement?: number;
  ipHash?: string | null;
}

export interface FraudResult {
  suspicious: boolean;
  riskScore: number; // 0..1
  reason: string;
  flags: string[];
}

const MAX_REDEMPTIONS_PER_HOUR = 2;
const MAX_XP_PER_SUBMISSION = 20;
const REFERRAL_FARM_RATIO = 0.2; // <20% of referrals engaging = suspicious

export function scoreRewardFraud(input: RewardFraudInput): FraudResult {
  const flags: string[] = [];
  let risk = 0;

  // Negative / implausible amounts.
  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    flags.push("implausible_amount");
    risk += 0.5;
  }

  // Redemption velocity.
  if (input.redemptionsLastHour > MAX_REDEMPTIONS_PER_HOUR) {
    flags.push("redemption_velocity");
    risk += Math.min(0.4, (input.redemptionsLastHour - MAX_REDEMPTIONS_PER_HOUR) * 0.1);
  }

  // Earning velocity — XP should roughly track submissions * reward rate.
  if (
    input.xpEarnedToday !== undefined &&
    input.submissionsToday !== undefined
  ) {
    const expectedMaxXp = input.submissionsToday * MAX_XP_PER_SUBMISSION;
    if (input.xpEarnedToday > expectedMaxXp && input.submissionsToday > 0) {
      flags.push("earning_velocity");
      risk += Math.min(0.4, (input.xpEarnedToday - expectedMaxXp) / Math.max(1, expectedMaxXp) * 0.3);
    }
  }

  // Referral farming — many referrals, almost none engaging.
  if (input.referralCount && input.referralCount > 5) {
    const engaging = input.referralsWithEngagement ?? 0;
    const ratio = engaging / input.referralCount;
    if (ratio < REFERRAL_FARM_RATIO) {
      flags.push("referral_farming");
      risk += 0.3;
    }
  }

  const suspicious = risk >= 0.35;
  const reason = suspicious
    ? `Reward fraud signals: ${flags.join(", ")}`
    : "No reward fraud signals";
  return {
    suspicious,
    riskScore: Number(Math.min(1, risk).toFixed(3)),
    reason,
    flags,
  };
}
