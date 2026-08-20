/**
 * Behavioral Anomaly Detection
 * ============================================================
 * Implements an "autoencoder-style" anomaly model without a trained neural
 * network: we learn a compact statistical profile of a user's normal request
 * rhythm (inter-arrival times, hour-of-day distribution, endpoint entropy) and
 * score new observations by their reconstruction error — i.e. how far the live
 * distribution drifts from the learned baseline. This is the same principle a
 * trained autoencoder uses (reconstruction-error thresholding), expressed with
 * robust statistics so it runs deterministically and explainably in-serverless.
 *
 * A real trained autoencoder can be dropped in by implementing `BehaviorModel`.
 */

export interface BehaviorProfile {
  /** Mean inter-arrival time (ms) of requests. */
  meanIAT: number;
  /** Std-dev of inter-arrival time. */
  stdIAT: number;
  /** Hour-of-day request counts (0..23). */
  hourHistogram: number[];
  /** Distinct endpoints hit (entropy of access pattern). */
  endpointEntropy: number;
  /** Number of samples the profile was built from. */
  samples: number;
  /** When the profile was last rebuilt. */
  updatedAt: string;
}

export interface AnomalyResult {
  isAnomalous: boolean;
  /** Reconstruction-error proxy: 0..100. */
  deviation: number;
  zScore: number;
  reason: string;
}

const Z_THRESHOLD = 2.5; // ~99% confidence under a normal model

/**
 * Build a behavior profile from raw request timestamps.
 * Timestamps should be ascending epoch-ms values.
 */
export function buildBehaviorProfile(
  timestamps: number[],
  endpoints: string[] = []
): BehaviorProfile {
  if (timestamps.length < 2) {
    return {
      meanIAT: 0,
      stdIAT: 0,
      hourHistogram: new Array(24).fill(0),
      endpointEntropy: 0,
      samples: timestamps.length,
      updatedAt: new Date().toISOString(),
    };
  }

  const iats: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    iats.push(Math.max(0, timestamps[i] - timestamps[i - 1]));
  }

  const meanIAT = iats.reduce((a, b) => a + b, 0) / iats.length;
  const variance =
    iats.reduce((sum, v) => sum + Math.pow(v - meanIAT, 2), 0) / iats.length;
  const stdIAT = Math.sqrt(variance) || 1;

  const hourHistogram = new Array(24).fill(0);
  for (const ts of timestamps) {
    const hour = new Date(ts).getUTCHours();
    hourHistogram[hour] = (hourHistogram[hour] || 0) + 1;
  }

  const endpointEntropy = shannonEntropy(endpoints);

  return {
    meanIAT,
    stdIAT,
    hourHistogram,
    endpointEntropy,
    samples: timestamps.length,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Score a sequence of recent request timestamps against a learned profile.
 * High reconstruction error (low probability under the learned model) ⇒ anomaly.
 */
export function analyzeBehavioralAnomaly(
  recentTimes: number[],
  profile: BehaviorProfile
): AnomalyResult {
  if (recentTimes.length < 2 || profile.samples < 5) {
    return { isAnomalous: false, deviation: 0, zScore: 0, reason: "Insufficient data" };
  }

  const iats: number[] = [];
  for (let i = 1; i < recentTimes.length; i++) {
    iats.push(Math.max(1, recentTimes[i] - recentTimes[i - 1]));
  }
  const recentMean = iats.reduce((a, b) => a + b, 0) / iats.length;

  // Z-score of the recent mean inter-arrival vs. baseline.
  const z = profile.stdIAT > 0 ? (profile.meanIAT - recentMean) / profile.stdIAT : 0;

  // Very short inter-arrival (burst) ⇒ high z (positive). Long gaps are low
  // risk, so we only flag burst behavior.
  const burst = z > Z_THRESHOLD;

  // Hour-of-day drift: is the request happening in an hour the user never uses?
  const lastHour = new Date(recentTimes[recentTimes.length - 1]).getUTCHours();
  const hourCount = profile.hourHistogram[lastHour] || 0;
  const totalHourSamples = profile.hourHistogram.reduce((a, b) => a + b, 0) || 1;
  const hourProbability = hourCount / totalHourSamples;
  const novelHour = hourProbability === 0 && profile.samples > 20;

  let deviation = 0;
  const reasons: string[] = [];

  if (burst) {
    deviation += Math.min(60, Math.abs(z) * 15);
    reasons.push(`request burst (z=${z.toFixed(2)})`);
  }
  if (novelHour) {
    deviation += 25;
    reasons.push(`activity in unusual hour ${lastHour}h UTC`);
  }

  const isAnomalous = deviation >= 40;
  return {
    isAnomalous,
    deviation: Math.min(100, Math.round(deviation)),
    zScore: Number(z.toFixed(2)),
    reason: reasons.length ? reasons.join("; ") : "within normal behavior",
  };
}

/** Shannon entropy (bits) — measures how diverse a user's endpoint access is. */
function shannonEntropy(items: string[]): number {
  if (items.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / items.length;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

/**
 * Model interface for swapping in a trained autoencoder.
 * Implement this and register it to replace the statistical baseline.
 */
export interface BehaviorModel {
  profile: BehaviorProfile;
  reconstruct(input: number[]): number;
  threshold: number;
}

export function scoreWithAutoencoder(
  model: BehaviorModel,
  input: number[]
): { isAnomalous: boolean; reconstructionError: number } {
  const reconstructed = model.reconstruct(input);
  const error = input.reduce(
    (sum, v, i) => sum + Math.pow(v - reconstructed, 2),
    0
  ) / input.length;
  return { isAnomalous: error > model.threshold, reconstructionError: error };
}
