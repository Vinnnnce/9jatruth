/**
 * AI Security Engine — Core
 * ============================================================
 * A unified cybersecurity analysis pipeline for the 9jatruth CRL platform.
 *
 * The engine is model-agnostic: every detector returns a normalized
 * `SecurityVerdict` (0..1 risk score + signals + recommended action).
 * Detectors use deterministic, explainable baselines (statistical anomaly
 * scoring, NLP heuristics, graph analysis, cryptographic device fingerprinting)
 * so the platform is protected out-of-the-box without a trained model. Any
 * detector can be upgraded to a real ML model or external AI provider (Kimi,
 * a hosted deepfake API, a trained autoencoder) by implementing the
 * `Detector` interface — no callers need to change.
 *
 * Compliance posture: OWASP API Security Top-10, NIST Zero-Trust (800-207),
 * least-privilege RBAC, privacy-preserving IP/device hashing, full audit log.
 */

import { detectSuspiciousContent } from "@/lib/ai-security";
import { getClientIp, hashIp } from "@/lib/api-helpers";
import {
  analyzeBehavioralAnomaly,
  type BehaviorProfile,
} from "./behavioral";
import { detectBotnetCluster } from "./botnet-graph";
import { scoreRewardFraud } from "./reward-fraud";
import { scoreNewsAuthenticity } from "./nlp-fakenews";
import { scoreDeepfake } from "./deepfake";
import { scoreMeshAnomaly } from "./mesh";
import { scoreTelecomFraud } from "./telecom-fraud";
import { computeDeviceFingerprint } from "./device";

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type MitigationAction =
  | "allow"
  | "log"
  | "flag"
  | "challenge_2fa"
  | "rate_limit"
  | "suspend_token"
  | "block_ip";

export interface SecuritySignal {
  /** Stable machine code, e.g. "sqli_pattern", "behavior_burst". */
  code: string;
  /** Human-readable explanation. */
  message: string;
  /** 0..1 contribution to the overall risk score. */
  weight: number;
  /** Which detector produced this signal. */
  source: string;
}

export interface SecurityVerdict {
  /** Aggregate risk score 0..1. */
  riskScore: number;
  severity: Severity;
  /** True when the request should be blocked/challenged. */
  shouldBlock: boolean;
  action: MitigationAction;
  signals: SecuritySignal[];
  /** Stable fingerprint of the requesting device. */
  deviceFingerprint?: string;
  /** Hashed client IP (privacy-preserving). */
  ipHash?: string | null;
  analyzedAt: string;
}

export interface Detector {
  name: string;
  detect(ctx: SecurityContext): Promise<SecuritySignal[]>;
}

export interface SecurityContext {
  request: Request;
  userId?: string | null;
  ip: string | null;
  ipHash: string | null;
  body?: unknown;
  /** Recent request timestamps for this identity (for behavioral analysis). */
  recentRequestTimes?: number[];
  /** Prior behavior profile (mean/std of inter-arrival times, etc.). */
  behaviorProfile?: BehaviorProfile;
  /** Reward/telecom context for fraud detectors. */
  reward?: { userHash: string; amount: number; redemptionsLastHour: number };
  telecom?: { phoneNumber: string; amount: number; recentAttempts: number };
  /** Content under verification (news/deepfake). */
  content?: { text?: string; imageUrl?: string; videoUrl?: string; sourceUrl?: string };
  /** Mesh sync bundle metadata. */
  mesh?: { packetCount: number; bundleSize: number; deviceHash: string; duplicateRatio?: number };
}

const SEVERITY_THRESHOLDS: Array<[number, Severity]> = [
  [0.85, "critical"],
  [0.65, "high"],
  [0.4, "medium"],
  [0.2, "low"],
  [0, "info"],
];

function severityFor(score: number): Severity {
  for (const [threshold, sev] of SEVERITY_THRESHOLDS) {
    if (score >= threshold) return sev;
  }
  return "info";
}

function actionFor(score: number, signals: SecuritySignal[]): MitigationAction {
  if (score >= 0.85) return "block_ip";
  if (score >= 0.7) return "suspend_token";
  if (score >= 0.55) return "challenge_2fa";
  if (score >= 0.4) return "rate_limit";
  if (signals.some((s) => s.code.startsWith("behavior_") || s.code === "reward_velocity")) {
    return "flag";
  }
  if (score >= 0.2) return "log";
  return "allow";
}

/**
 * Run the full security pipeline against a request context.
 * Detectors run in parallel; results are merged into a single verdict.
 */
export async function runSecurityPipeline(ctx: SecurityContext): Promise<SecurityVerdict> {
  const detectors: Detector[] = [
    injectionDetector,
    makeBehavioralDetector(ctx.behaviorProfile, ctx.recentRequestTimes),
    makeBotnetDetector(),
    makeRewardFraudDetector(ctx.reward),
    makeNewsAuthenticityDetector(ctx.content),
    makeDeepfakeDetector(ctx.content),
    makeMeshDetector(ctx.mesh),
    makeTelecomFraudDetector(ctx.telecom),
  ];

  const results = await Promise.all(
    detectors.map((d) => d.detect(ctx).catch((err) => {
      console.error(`[SecurityEngine] Detector "${d.name}" failed:`, err);
      return [] as SecuritySignal[];
    }))
  );

  const signals = results.flat();
  // Weighted aggregate — no single detector can dominate beyond its weight.
  const aggregate = signals.reduce((sum, s) => sum + s.weight, 0);
  const riskScore = Math.min(1, aggregate);
  const severity = severityFor(riskScore);

  const deviceFingerprint = ctx.ip
    ? await computeDeviceFingerprint(ctx.request, ctx.ip)
    : undefined;

  return {
    riskScore: Number(riskScore.toFixed(4)),
    severity,
    shouldBlock: riskScore >= 0.7,
    action: actionFor(riskScore, signals),
    signals,
    deviceFingerprint,
    ipHash: ctx.ipHash,
    analyzedAt: new Date().toISOString(),
  };
}

/** Build a SecurityContext from a Next.js Request (the common entrypoint). */
export async function buildSecurityContext(
  request: Request,
  opts: Partial<SecurityContext> = {}
): Promise<SecurityContext> {
  const ip = getClientIp(request);
  const ipHash = ip ? hashIp(ip) : null;
  return {
    request,
    ip,
    ipHash,
    ...opts,
  };
}

// ─── Detectors ────────────────────────────────────────────────

const injectionDetector: Detector = {
  name: "injection",
  async detect(ctx) {
    const target = typeof ctx.body === "string"
      ? ctx.body
      : JSON.stringify(ctx.body ?? "");
    const { suspicious, patterns } = detectSuspiciousContent(target);
    if (!suspicious) return [];
    return [{
      code: "injection_pattern",
      message: `Suspicious injection pattern detected (${patterns.length} match${patterns.length > 1 ? "es" : ""}).`,
      weight: 0.6,
      source: "injection",
    }];
  },
};

function makeBehavioralDetector(
  profile: BehaviorProfile | undefined,
  recentTimes: number[] | undefined
): Detector {
  return {
    name: "behavioral_anomaly",
    async detect() {
      if (!profile || !recentTimes || recentTimes.length < 5) return [];
      const anomaly = analyzeBehavioralAnomaly(recentTimes, profile);
      if (!anomaly.isAnomalous) return [];
      return [{
        code: "behavior_burst",
        message: `Behavioral anomaly: ${anomaly.reason}. Z-score=${anomaly.zScore.toFixed(2)}.`,
        weight: Math.min(0.7, anomaly.deviation / 100),
        source: "behavioral",
      }];
    },
  };
}

function makeBotnetDetector(): Detector {
  return {
    name: "botnet_graph",
    async detect(ctx) {
      // The graph detector is fed from the security_events store; in a request
      // path we contribute the current device fingerprint as a graph node and
      // let the storage layer cluster later. Here we return no inline signal —
      // graph-based scoring is computed asynchronously by detectBotnetCluster.
      void ctx;
      void detectBotnetCluster;
      return [];
    },
  };
}

function makeRewardFraudDetector(reward: SecurityContext["reward"]): Detector {
  return {
    name: "reward_fraud",
    async detect() {
      if (!reward) return [];
      const result = scoreRewardFraud(reward);
      if (!result.suspicious) return [];
      return [{
        code: "reward_velocity",
        message: result.reason,
        weight: result.riskScore,
        source: "reward_fraud",
      }];
    },
  };
}

function makeNewsAuthenticityDetector(content: SecurityContext["content"]): Detector {
  return {
    name: "news_authenticity",
    async detect() {
      if (!content?.text) return [];
      const result = scoreNewsAuthenticity(content.text, content.sourceUrl);
      if (!result.suspicious) return [];
      return [{
        code: "fake_news_signal",
        message: result.reason,
        weight: result.riskScore,
        source: "nlp_fakenews",
      }];
    },
  };
}

function makeDeepfakeDetector(content: SecurityContext["content"]): Detector {
  return {
    name: "deepfake",
    async detect() {
      if (!content?.imageUrl && !content?.videoUrl) return [];
      const result = scoreDeepfake(content);
      if (!result.suspicious) return [];
      return [{
        code: "deepfake_signal",
        message: result.reason,
        weight: result.riskScore,
        source: "deepfake",
      }];
    },
  };
}

function makeMeshDetector(mesh: SecurityContext["mesh"]): Detector {
  return {
    name: "mesh_anomaly",
    async detect() {
      if (!mesh) return [];
      const result = scoreMeshAnomaly(mesh);
      if (!result.suspicious) return [];
      return [{
        code: "mesh_anomaly",
        message: result.reason,
        weight: result.riskScore,
        source: "mesh",
      }];
    },
  };
}

function makeTelecomFraudDetector(telecom: SecurityContext["telecom"]): Detector {
  return {
    name: "telecom_fraud",
    async detect() {
      if (!telecom) return [];
      const result = scoreTelecomFraud(telecom);
      if (!result.suspicious) return [];
      return [{
        code: "telecom_fraud",
        message: result.reason,
        weight: result.riskScore,
        source: "telecom_fraud",
      }];
    },
  };
}

export { SEVERITY_THRESHOLDS };
