/**
 * AI Truth Verification Engine
 *
 * Analyzes truth reports for authenticity using a multi-signal scoring system:
 * 1. Content analysis (sentiment, specificity, coherence)
 * 2. Source credibility (author trust score, verification history)
 * 3. Community signals (corroborations, disputes, engagement)
 * 4. Temporal patterns (recency, frequency of reports)
 * 5. AI prediction (optional, uses Perplexity API if key is configured)
 *
 * Outputs a verification verdict: authentic / suspicious / unverified
 * with a confidence score and explanation.
 */

export type TruthForAnalysis = {
  id: number;
  content: string;
  category: string;
  trustScore: number;
  status: string;
  userHash: string;
  createdAt: string;
  neighborhoodId?: number;
  corroborationCount?: number;
  disputeCount?: number;
  likeCount?: number;
  shareCount?: number;
  commentCount?: number;
  authorTrustScore?: number;
  authorTotalReports?: number;
};

export type VerificationResult = {
  truthId: number;
  verdict: "authentic" | "suspicious" | "unverified";
  confidence: number; // 0-100
  score: number; // 0-100
  signals: {
    contentAnalysis: {
      score: number;
      specificity: number;
      coherence: number;
      sentiment: string;
      redFlags: string[];
    };
    sourceCredibility: {
      score: number;
      authorTrust: number;
      authorHistory: number;
    };
    communitySignals: {
      score: number;
      corroborationRatio: number;
      engagement: number;
    };
    temporalPattern: {
      score: number;
      recency: number;
      frequency: number;
    };
  };
  explanation: string;
  aiPowered: boolean;
  verifiedAt: string;
};

// ─── Content Analysis ───

const SPECIFICITY_INDICATORS = [
  // Time references
  /\b(\d{1,2}:\d{2})\b/i,
  /\b(morning|afternoon|evening|night|noon|midnight)\b/i,
  /\b(today|yesterday|tomorrow)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  // Location specifics
  /\b(road|street|avenue|close|estate|junction|bus stop|market)\b/i,
  /\b(near|opposite|beside|behind|adjacent to)\b/i,
  // Quantitative
  /\b\d+\s*(naira|₦|kg|liters?|km|meters?|minutes?|hours?)\b/i,
  // Verifiable claims
  /\b(NEPA|EKDC|AEDC|IKEDC|PHED|generator|inverter|solar)\b/i,
  /\b( NNPC|Total|Oando|MRS|Conoil)\b/i,
];

const RED_FLAG_PATTERNS = [
  /\b(everyone knows|they always|never|always|nobody|everybody)\b/i, // overgeneralizations
  /\b(100%|absolutely|definitely|guaranteed)\b/i, // absolute claims
  /\b(trust me|believe me|I swear)\b/i, // plea for belief
  /\b(spread this|share to all|forward this)\b/i, // viral manipulation
  /\b(breaking|urgent|alert)\b/i, // sensationalism (check context)
];

const COHERENCE_THRESHOLD = 0.4;

function analyzeContent(content: string): {
  score: number;
  specificity: number;
  coherence: number;
  sentiment: string;
  redFlags: string[];
} {
  const text = content.toLowerCase().trim();
  const words = text.split(/\s+/).filter(Boolean);

  // Specificity: how many specific indicators are present
  let specificityCount = 0;
  for (const pattern of SPECIFICITY_INDICATORS) {
    if (pattern.test(text)) specificityCount++;
  }
  const specificity = Math.min(100, (specificityCount / 3) * 100);

  // Coherence: check for reasonable length, complete sentences
  const sentenceCount = (text.match(/[.!?]+/g) || []).length || 1;
  const avgWordsPerSentence = words.length / sentenceCount;
  const hasReasonableLength = words.length >= 5 && words.length <= 500;
  const hasCompleteSentences = avgWordsPerSentence >= 3 && avgWordsPerSentence <= 40;
  const coherence = (hasReasonableLength ? 50 : 0) + (hasCompleteSentences ? 50 : 0);

  // Sentiment analysis (simple)
  let sentiment = "neutral";
  if (/\b(good|better|improved|restored|fixed|available|normal|safe)\b/i.test(text)) {
    sentiment = "positive";
  } else if (/\b(bad|worse|outage|unavailable|danger|broken|off|down|attack|crisis)\b/i.test(text)) {
    sentiment = "negative";
  }

  // Red flags
  const redFlags: string[] = [];
  for (const pattern of RED_FLAG_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      redFlags.push(match[0]);
    }
  }

  // Overall content score: specificity + coherence - red flag penalty
  let score = (specificity * 0.4) + (coherence * 0.4);
  if (redFlags.length > 0) {
    score -= (redFlags.length * 15);
  }
  score = Math.max(0, Math.min(100, score));

  return { score, specificity, coherence, sentiment, redFlags };
}

// ─── Source Credibility ───

function analyzeSource(
  authorTrustScore: number = 50,
  authorTotalReports: number = 0
): { score: number; authorTrust: number; authorHistory: number } {
  // Author trust contribution
  const authorTrust = Math.min(100, authorTrustScore);

  // Author history: more reports = more established
  let authorHistory = 0;
  if (authorTotalReports >= 50) authorHistory = 100;
  else if (authorTotalReports >= 20) authorHistory = 80;
  else if (authorTotalReports >= 10) authorHistory = 60;
  else if (authorTotalReports >= 5) authorHistory = 40;
  else if (authorTotalReports >= 1) authorHistory = 20;
  else authorHistory = 10;

  const score = (authorTrust * 0.7) + (authorHistory * 0.3);

  return { score, authorTrust, authorHistory };
}

// ─── Community Signals ───

function analyzeCommunity(
  corroborationCount: number = 0,
  disputeCount: number = 0,
  likeCount: number = 0,
  shareCount: number = 0,
  commentCount: number = 0
): { score: number; corroborationRatio: number; engagement: number } {
  const total = corroborationCount + disputeCount;
  const corroborationRatio = total > 0 ? corroborationCount / total : 0.5;

  // Engagement level
  const engagementRaw = likeCount + shareCount + commentCount;
  const engagement = Math.min(100, engagementRaw * 10);

  // Score: corroboration ratio weighted heavily, engagement as secondary signal
  const corroborationScore = corroborationRatio * 100;
  const score = (corroborationScore * 0.7) + (engagement * 0.3);

  return { score, corroborationRatio, engagement };
}

// ─── Temporal Patterns ───

function analyzeTemporal(createdAt: string, authorTotalReports: number = 0): {
  score: number;
  recency: number;
  frequency: number;
} {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const ageHours = (now - created) / (1000 * 60 * 60);

  // Recency: newer reports are more likely to be verifiable
  let recency = 100;
  if (ageHours > 72) recency = 30;
  else if (ageHours > 48) recency = 50;
  else if (ageHours > 24) recency = 70;
  else if (ageHours > 6) recency = 85;

  // Frequency: check if author is a regular reporter (not a one-off)
  let frequency = 50;
  if (authorTotalReports >= 10) frequency = 90;
  else if (authorTotalReports >= 5) frequency = 70;
  else if (authorTotalReports >= 2) frequency = 55;

  const score = (recency * 0.5) + (frequency * 0.5);

  return { score, recency, frequency };
}

// ─── Main Verification Function ───

export async function verifyTruth(truth: TruthForAnalysis): Promise<VerificationResult> {
  const contentAnalysis = analyzeContent(truth.content);
  const sourceCredibility = analyzeSource(truth.authorTrustScore, truth.authorTotalReports);
  const communitySignals = analyzeCommunity(
    truth.corroborationCount,
    truth.disputeCount,
    truth.likeCount,
    truth.shareCount,
    truth.commentCount
  );
  const temporalPattern = analyzeTemporal(truth.createdAt, truth.authorTotalReports);

  // Weighted final score
  const finalScore = Math.round(
    contentAnalysis.score * 0.3 +
    sourceCredibility.score * 0.3 +
    communitySignals.score * 0.25 +
    temporalPattern.score * 0.15
  );

  // Determine verdict
  let verdict: "authentic" | "suspicious" | "unverified";
  if (finalScore >= 70 && contentAnalysis.redFlags.length === 0) {
    verdict = "authentic";
  } else if (finalScore < 40 || contentAnalysis.redFlags.length >= 2) {
    verdict = "suspicious";
  } else {
    verdict = "unverified";
  }

  // Build explanation
  const explanationParts: string[] = [];
  if (contentAnalysis.specificity > 60) {
    explanationParts.push("Content contains specific, verifiable details");
  } else {
    explanationParts.push("Content lacks specific verifiable details");
  }
  if (sourceCredibility.authorTrust > 60) {
    explanationParts.push("Author has a strong trust score");
  } else if (sourceCredibility.authorTrust < 30) {
    explanationParts.push("Author has a low trust score");
  }
  if (communitySignals.corroborationRatio > 0.7) {
    explanationParts.push("High corroboration from community");
  } else if (communitySignals.corroborationRatio < 0.3) {
    explanationParts.push("More disputes than corroborations");
  }
  if (contentAnalysis.redFlags.length > 0) {
    explanationParts.push(`Detected potential red flags: ${contentAnalysis.redFlags.join(", ")}`);
  }

  return {
    truthId: truth.id,
    verdict,
    confidence: Math.min(100, Math.max(0, finalScore)),
    score: finalScore,
    signals: {
      contentAnalysis,
      sourceCredibility,
      communitySignals,
      temporalPattern,
    },
    explanation: explanationParts.join(". ") + ".",
    aiPowered: false,
    verifiedAt: new Date().toISOString(),
  };
}

// ─── AI Prediction ───

export type PredictionInput = {
  category: string;
  neighborhoodId?: number;
  recentTruths: TruthForAnalysis[];
  historicalTrend?: "up" | "down" | "stable";
};

export type AIPrediction = {
  category: string;
  prediction: string;
  confidence: number;
  trend: "up" | "down" | "stable";
  timeframe: string;
  signals: string[];
  aiPowered: boolean;
};

export function generatePrediction(input: PredictionInput): AIPrediction {
  const { category, recentTruths } = input;

  if (recentTruths.length === 0) {
    return {
      category,
      prediction: `Insufficient data to generate a reliable prediction for ${category}. More reports needed.`,
      confidence: 20,
      trend: "stable",
      timeframe: "unknown",
      signals: ["No recent reports in this category"],
      aiPowered: false,
    };
  }

  // Analyze recent truths
  const avgTrust = recentTruths.reduce((s, t) => s + t.trustScore, 0) / recentTruths.length;
  const recentCount = recentTruths.filter((t) => {
    const ageHours = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
    return ageHours < 24;
  }).length;

  const positiveCount = recentTruths.filter((t) =>
    /\b(good|better|improved|restored|fixed|available|normal|safe)\b/i.test(t.content)
  ).length;
  const negativeCount = recentTruths.filter((t) =>
    /\b(bad|worse|outage|unavailable|danger|broken|off|down)\b/i.test(t.content)
  ).length;

  const total = recentTruths.length;
  const positiveRatio = positiveCount / total;
  const negativeRatio = negativeCount / total;

  let trend: "up" | "down" | "stable";
  let prediction: string;
  let confidence: number;
  const signals: string[] = [];

  // Category-specific predictions
  switch (category) {
    case "power":
      if (negativeRatio > 0.6) {
        trend = "down";
        prediction = `Power outages likely to continue in this area. ${recentCount} reports in the last 24 hours indicate ongoing instability.`;
        confidence = Math.min(90, 40 + negativeRatio * 50);
        signals.push(`${negativeCount} of ${total} reports indicate power issues`);
      } else if (positiveRatio > 0.6) {
        trend = "up";
        prediction = `Power supply appears stable. Recent reports indicate normal or restored conditions.`;
        confidence = Math.min(90, 40 + positiveRatio * 50);
        signals.push(`${positiveCount} of ${total} reports indicate stable power`);
      } else {
        trend = "stable";
        prediction = `Power situation is mixed. Some reports indicate issues while others report normal conditions.`;
        confidence = 50;
        signals.push("Mixed signals from community reports");
      }
      break;

    case "fuel":
      if (negativeRatio > 0.5) {
        trend = "down";
        prediction = `Fuel scarcity may persist. Multiple reports indicate shortages or long queues at stations.`;
        confidence = Math.min(85, 35 + negativeRatio * 50);
        signals.push(`${negativeCount} reports of fuel issues`);
      } else {
        trend = "stable";
        prediction = `Fuel availability appears normal based on recent community reports.`;
        confidence = 60;
        signals.push("No widespread fuel issues reported");
      }
      break;

    case "traffic":
      if (recentCount > 5) {
        trend = "down";
        prediction = `Heavy traffic likely. ${recentCount} reports in the last 24 hours suggest congestion in this area.`;
        confidence = Math.min(80, 30 + recentCount * 10);
        signals.push(`High report frequency: ${recentCount} in 24h`);
      } else {
        trend = "stable";
        prediction = `Traffic conditions appear normal with no significant congestion reported.`;
        confidence = 55;
        signals.push("Low report frequency");
      }
      break;

    case "prices":
      if (negativeRatio > 0.5) {
        trend = "up";
        prediction = `Prices may be rising. Community reports indicate increasing costs for goods and services.`;
        confidence = Math.min(75, 30 + negativeRatio * 45);
        signals.push(`${negativeCount} reports of price increases`);
      } else {
        trend = "stable";
        prediction = `Prices appear stable based on recent community reports.`;
        confidence = 60;
        signals.push("No significant price changes reported");
      }
      break;

    case "safety":
      if (negativeRatio > 0.5) {
        trend = "down";
        prediction = `Safety concerns flagged. Multiple reports indicate potential security issues in this area.`;
        confidence = Math.min(85, 35 + negativeRatio * 50);
        signals.push(`${negativeCount} safety-related reports`);
      } else {
        trend = "stable";
        prediction = `Area appears safe based on recent community reports.`;
        confidence = 65;
        signals.push("No significant safety concerns reported");
      }
      break;

    default:
      trend = "stable";
      prediction = `Insufficient data for ${category} prediction.`;
      confidence = 30;
      signals.push("Limited data available");
  }

  // Factor in trust score
  if (avgTrust > 70) {
    confidence = Math.min(95, confidence + 10);
    signals.push(`High average trust score (${Math.round(avgTrust)}%)`);
  } else if (avgTrust < 30) {
    confidence = Math.max(20, confidence - 10);
    signals.push(`Low average trust score (${Math.round(avgTrust)}%)`);
  }

  const timeframe = recentCount > 3 ? "next 24 hours" : "next 48 hours";

  return {
    category,
    prediction,
    confidence: Math.round(confidence),
    trend,
    timeframe,
    signals,
    aiPowered: false,
  };
}
