/**
 * NLP Fake-News / Authenticity Detection
 * ============================================================
 * A transparent, rule + lexicon based authenticity scorer for news content
 * submitted to the platform. It evaluates credibility signals that correlate
 * with misinformation, then returns an authenticity score (0..100) and a
 * risk score for the security pipeline.
 *
 * This is a baseline NLP model. It is intentionally explainable: every point
 * deducted maps to a named signal so moderators can audit the decision. A
 * transformer-based classifier can be plugged in via `registerNlpModel`.
 */

export interface NewsScoreResult {
  authenticityScore: number; // 0..100 (higher = more trustworthy)
  riskScore: number; // 0..1
  suspicious: boolean;
  reason: string;
  signals: string[];
}

// Sensationalism / clickbait lexicon.
const CLICKBAIT_PATTERNS = [
  /\b(shocking|unbelievable|you won't believe|mind-blowing|jaw-dropping|bombshell)\b/i,
  /\b(breaking|urgent|alert|must see|gone wrong|exposed)\b/i,
  /\b(doctors hate|this one trick|what happens next)\b/i,
];

// Hedging / uncertainty lexicon (mild signals of unverified claims).
const HEDGE_PATTERNS = [
  /\b(sources say|reportedly|allegedly|supposedly|rumored|word is|it is said)\b/i,
  /\b(many people are saying|some say|people are saying)\b/i,
];

// Impersonation / authority-faking.
const IMPERSONATION_PATTERNS = [
  /\b(as (a|an) (doctor|scientist|expert|official|senator|minister))\b/i,
  /\b(trust me|i guarantee|i promise you|100% true|definitely real)\b/i,
];

const ALL_CAPS_RATIO_THRESHOLD = 0.25;
const MAX_REASONABLE_EXCLAMATIONS = 3;

export function scoreNewsAuthenticity(text: string, sourceUrl?: string): NewsScoreResult {
  const signals: string[] = [];
  const clean = (text || "").trim();
  let score = 100;

  if (clean.length < 40) {
    signals.push("content_too_short");
    score -= 20;
  }

  // Clickbait patterns.
  const clickbaitHits = CLICKBAIT_PATTERNS.filter((p) => p.test(clean));
  if (clickbaitHits.length > 0) {
    signals.push(`clickbait_phrasing`);
    score -= clickbaitHits.length * 10;
  }

  // Excessive exclamations.
  const exclamations = (clean.match(/!/g) || []).length;
  if (exclamations > MAX_REASONABLE_EXCLAMATIONS) {
    signals.push("excessive_exclamations");
    score -= 8;
  }

  // ALL-CAPS shouting (ratio of uppercased words).
  const words = clean.split(/\s+/).filter(Boolean);
  const upperWords = words.filter((w) => w.length > 3 && w === w.toUpperCase());
  if (words.length > 5 && upperWords.length / words.length > ALL_CAPS_RATIO_THRESHOLD) {
    signals.push("all_caps_shouting");
    score -= 10;
  }

  // Hedging language (unverified sourcing).
  const hedgeHits = HEDGE_PATTERNS.filter((p) => p.test(clean));
  if (hedgeHits.length > 0) {
    signals.push("unverified_sourcing");
    score -= hedgeHits.length * 6;
  }

  // Impersonation of authority.
  const impersonationHits = IMPERSONATION_PATTERNS.filter((p) => p.test(clean));
  if (impersonationHits.length > 0) {
    signals.push("authority_impersonation");
    score -= impersonationHits.length * 12;
  }

  // Source URL quality.
  if (!sourceUrl) {
    signals.push("no_source_url");
    score -= 8;
  } else {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
      const tld = host.split(".").pop();
      if (tld && !["com", "org", "net", "gov", "edu", "ng", "co"].includes(tld)) {
        signals.push("unusual_tld");
        score -= 6;
      }
    } catch {
      signals.push("malformed_source_url");
      score -= 6;
    }
  }

  const clamped = Math.max(0, Math.min(100, score));
  const riskScore = Number(((100 - clamped) / 100).toFixed(3));
  const suspicious = clamped < 55;
  const reason = suspicious
    ? `Low authenticity (${clamped}/100): ${signals.join(", ")}`
    : `Authenticity score ${clamped}/100`;

  return {
    authenticityScore: clamped,
    riskScore,
    suspicious,
    reason,
    signals,
  };
}

// ─── Pluggable model interface ───────────────────────────────
export interface NlpModel {
  predict(text: string): Promise<{ probability: number; label: string }>;
}

let registeredModel: NlpModel | null = null;

/** Register a trained classifier to replace the heuristic baseline. */
export function registerNlpModel(model: NlpModel) {
  registeredModel = model;
}

export async function scoreWithModel(text: string): Promise<NewsScoreResult | null> {
  if (!registeredModel) return null;
  const { probability, label } = await registeredModel.predict(text);
  const authenticityScore = Math.round((1 - probability) * 100);
  return {
    authenticityScore,
    riskScore: Number(probability.toFixed(3)),
    suspicious: probability > 0.5,
    reason: `Model verdict: ${label} (p=${probability.toFixed(2)})`,
    signals: ["ml_model"],
  };
}
