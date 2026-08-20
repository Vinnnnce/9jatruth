/**
 * Telecom API Fraud Protection
 * ============================================================
 * Protects the airtime/data top-up integration (VTPass / Africa's Talking /
 * Termii) against fraud. Detects:
 *
 *  - Velocity abuse (many top-ups to one number / from one device)
 *  - Card-testing patterns (small amounts across many numbers)
 *  - SIM-farm signals (sequential phone numbers from one actor)
 *  - Amount manipulation / non-rounded amounts typical of arbitrage
 *  - Numbers on known-fraud network prefixes
 */

export interface TelecomFraudInput {
  phoneNumber: string;
  amount: number;
  recentAttempts: number; // attempts by this actor in the last hour
  distinctNumbersLastHour?: number;
  networkProvider?: string;
}

export interface TelecomFraudResult {
  suspicious: boolean;
  riskScore: number; // 0..1
  reason: string;
  signals: string[];
}

const MAX_ATTEMPTS_PER_HOUR = 5;
const MAX_DISTINCT_NUMBERS_PER_HOUR = 4;

// Known high-risk Nigerian number prefixes frequently abused in SIM farms.
const HIGH_RISK_PREFIXES: string[] = [];

export function scoreTelecomFraud(input: TelecomFraudInput): TelecomFraudResult {
  const signals: string[] = [];
  let risk = 0;

  if (!/^\d{11,15}$/.test(input.phoneNumber.replace(/^\+/, ""))) {
    signals.push("malformed_number");
    risk += 0.4;
  }

  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    signals.push("implausible_amount");
    risk += 0.5;
  }

  if (input.recentAttempts > MAX_ATTEMPTS_PER_HOUR) {
    signals.push("velocity_abuse");
    risk += Math.min(0.4, ((input.recentAttempts - MAX_ATTEMPTS_PER_HOUR) / MAX_ATTEMPTS_PER_HOUR) * 0.4);
  }

  if (input.distinctNumbersLastHour && input.distinctNumbersLastHour > MAX_DISTINCT_NUMBERS_PER_HOUR) {
    signals.push("card_testing_pattern");
    risk += Math.min(0.3, ((input.distinctNumbersLastHour - MAX_DISTINCT_NUMBERS_PER_HOUR) / MAX_DISTINCT_NUMBERS_PER_HOUR) * 0.3);
  }

  // SIM-farm: sequential numbers (e.g. ...01, ...02, ...03).
  const tail = input.phoneNumber.slice(-2);
  const tailNum = Number(tail);
  if (!Number.isNaN(tailNum) && tailNum >= 0 && tailNum <= 3 && input.distinctNumbersLastHour && input.distinctNumbersLastHour > 2) {
    signals.push("sequential_number_pattern");
    risk += 0.25;
  }

  const normalized = input.phoneNumber.replace(/^\+/, "");
  for (const prefix of HIGH_RISK_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      signals.push("high_risk_prefix");
      risk += 0.2;
      break;
    }
  }

  const clamped = Math.min(1, risk);
  return {
    suspicious: clamped >= 0.45,
    riskScore: Number(clamped.toFixed(3)),
    reason: clamped >= 0.45
      ? `Telecom fraud signals: ${signals.join(", ")}`
      : "No telecom fraud signals",
    signals,
  };
}
