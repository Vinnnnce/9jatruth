/**
 * AI-driven enhancements for the Community Feeds system.
 * ─────────────────────────────────────────────────────────────────────────
 * All AI calls go through the Deepseek + Kimi K3 ensemble (src/lib/ai-providers)
 * and degrade gracefully to deterministic heuristics when no provider is
 * configured. Nothing here is exposed to the client.
 *
 * Features:
 *   • tagFeedContent     — auto-tagging (Power outage, Fuel update, …)
 *   • detectFeedSpam     — fake / duplicate / bot detection
 *   • classifyCommunity  — predict community + relevance when location missing
 *   • computeTrending    — trending topics per community / ward / lga / state
 */

import { generateAiJson, generateAiJsonArray, isAiConfigured } from "@/lib/ai-providers";
import { getDb } from "@/lib/db";
import type { GeoAssignment } from "@/lib/geo-reverse";

// ─── Content tagging ──────────────────────────────────────────────────────

export const FEED_TAG_KEYWORDS: Record<string, string[]> = {
  "power-outage": ["nepa", "phcn", "light", "power", "electricity", "grid", "disco", "up nepa", "tcn", "transformer", "blackout", "outage"],
  "fuel-update": ["fuel", "petrol", "diesel", "pms", "ago", "kerosene", "filling station", "fuel scarcity", "queue", "npdc", "nnpc"],
  "security-alert": ["robbery", "thief", "thieves", "kidnap", "kidnapping", "bandit", "insecurity", "attack", "gun", "shoot", "cultist", "security", "police", "danger", "alert", "fraud", "scam", "one chance"],
  "market-prices": ["price", "prices", "market", "cost", "inflation", "naira", "exchange rate", "buy", "sell", "tomato", "rice", "garri", "expensive", "cheap", "commodity"],
  traffic: ["traffic", "gridlock", "hold up", "go-slow", "congestion", "road", "accident", "jam", "blockade"],
  civic: ["government", "governor", "local government", "chairman", "councillor", "election", "inec", "vote", "campaign", "budget", "project", "road construction", "water", "hospital"],
};

const ALL_TAGS = Object.keys(FEED_TAG_KEYWORDS);

function heuristicTags(content: string): string[] {
  const lower = content.toLowerCase();
  const matched = ALL_TAGS.filter((tag) =>
    FEED_TAG_KEYWORDS[tag].some((kw) => lower.includes(kw))
  );
  return matched.length > 0 ? matched : ["general"];
}

export interface TagResult {
  category: string;
  tags: string[];
  source: "ai" | "heuristic";
}

/**
 * Auto-tag a post. Returns a primary category + zero-or-more descriptive tags.
 * Uses the AI ensemble when configured; otherwise falls back to keyword heuristics.
 */
export async function tagFeedContent(content: string): Promise<TagResult> {
  if (!isAiConfigured()) {
    const tags = heuristicTags(content);
    return { category: tags[0], tags, source: "heuristic" };
  }

  const fallback: TagResult = {
    category: heuristicTags(content)[0],
    tags: heuristicTags(content),
    source: "heuristic",
  };

  try {
    const { data, source } = await generateAiJson<{
      category: string;
      tags: string[];
    }>(
      `You are a content classifier for a Nigerian hyper-local community news platform called 9jatruth. ` +
        `Classify the user's post into exactly ONE primary category and up to 4 descriptive tags. ` +
        `Categories: power-outage, fuel-update, security-alert, market-prices, traffic, civic, general. ` +
        `Tags should be short lowercase slugs (e.g. "blackout", "fuel-scarcity", "robbery-warning"). ` +
        `Respond with JSON {"category": "...", "tags": ["..."]}.`,
      `Post: """${content.slice(0, 1500)}"""`,
      { category: fallback.category, tags: fallback.tags },
      { temperature: 0.2, maxOutputTokens: 256 }
    );

    const category = ALL_TAGS.includes(data.category) ? data.category : fallback.category;
    const tags = Array.isArray(data.tags) && data.tags.length > 0
      ? data.tags.filter((t) => typeof t === "string").slice(0, 4)
      : fallback.tags;
    return { category, tags: [category, ...tags.filter((t) => t !== category)].slice(0, 5), source: source === "fallback" ? "heuristic" : "ai" };
  } catch {
    return fallback;
  }
}

// ─── Spam / fake / duplicate detection ──────────────────────────────────────

export interface SpamResult {
  spamScore: number; // 0–100
  verdict: "clean" | "suspicious" | "blocked";
  duplicateOfId: number | null;
  reasons: string[];
  source: "ai" | "heuristic";
}

async function findDuplicate(content: string, userHash: string): Promise<number | null> {
  const sql = getDb();
  // Exact + near-duplicate check: same user, same normalized content, last 7 days.
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 8) return null;
  const rows = (await sql`
    SELECT id, content FROM feeds
    WHERE user_hash = ${userHash}
      AND created_at >= NOW() - INTERVAL '7 days'
      AND spam_verdict <> 'blocked'
    ORDER BY created_at DESC
    LIMIT 50
  `) as unknown as Array<{ id: number; content: string }>;
  for (const r of rows) {
    const other = r.content.trim().toLowerCase().replace(/\s+/g, " ");
    if (other === normalized) return r.id;
    // Near-duplicate: Jaccard token overlap >= 0.8.
    const tokensA = new Set(normalized.split(" "));
    const tokensB = new Set(other.split(" "));
    if (tokensA.size > 3 && tokensB.size > 3) {
      let inter = 0;
      for (const t of tokensA) if (tokensB.has(t)) inter++;
      const union = tokensA.size + tokensB.size - inter;
      if (union > 0 && inter / union >= 0.8) return r.id;
    }
  }
  return null;
}

function heuristicSpamSignals(content: string): string[] {
  const reasons: string[] = [];
  const lower = content.toLowerCase();
  if (/(.)\1{6,}/.test(content)) reasons.push("repeated-character pattern");
  if ((content.match(/https?:\/\//g) || []).length > 3) reasons.push("excessive links");
  if (/buy now|click here|earn money|make money online|whatsapp me|dm me|investment|double your|crypto giveaway/i.test(lower)) {
    reasons.push("promotional/spam phrases");
  }
  if (content.trim().length < 3) reasons.push("too short");
  return reasons;
}

/**
 * Detect spam, fake content, duplicates, and bot-generated posts.
 * Blocks creation only at high confidence; lower-confidence posts are flagged
 * for review but still published.
 */
export async function detectFeedSpam(
  content: string,
  userHash: string,
  _locationContext?: GeoAssignment
): Promise<SpamResult> {
  const reasons: string[] = [];
  let spamScore = 0;

  // 1. Duplicate detection (DB-backed, always runs).
  const duplicateOfId = await findDuplicate(content, userHash);
  if (duplicateOfId) {
    reasons.push("duplicate of existing post");
    spamScore = Math.max(spamScore, 85);
  }

  // 2. Heuristic signals.
  const heuristicReasons = heuristicSpamSignals(content);
  reasons.push(...heuristicReasons);
  spamScore += heuristicReasons.length * 12;

  // 3. AI verdict (when configured) — fake/bot/promotional detection.
  if (isAiConfigured() && spamScore < 85) {
    try {
      const { data } = await generateAiJson<{
        isSpam: boolean;
        isBotGenerated: boolean;
        confidence: number;
        reason: string;
      }>(
        `You are a moderation model for a Nigerian community news platform. ` +
          `Decide whether the post is spam, fake, scam, or bot-generated. ` +
          `Legitimate community reports about power, fuel, security, prices, ` +
          `traffic and civic issues are NOT spam. Respond with JSON ` +
          `{"isSpam": bool, "isBotGenerated": bool, "confidence": 0-100, "reason": "..."}.`,
        `Post: """${content.slice(0, 1500)}"""`,
        { isSpam: false, isBotGenerated: false, confidence: 0, reason: "" },
        { temperature: 0.1, maxOutputTokens: 256 }
      );
      if (data.isSpam || data.isBotGenerated) {
        spamScore = Math.max(spamScore, data.confidence || 60);
        reasons.push(`AI: ${data.reason || (data.isBotGenerated ? "bot-generated" : "spam")}`);
      }
    } catch {
      // keep heuristic result
    }
  }

  spamScore = Math.max(0, Math.min(100, spamScore));
  let verdict: SpamResult["verdict"] = "clean";
  if (spamScore >= 80) verdict = "blocked";
  else if (spamScore >= 45) verdict = "suspicious";

  return {
    spamScore,
    verdict,
    duplicateOfId,
    reasons: [...new Set(reasons)],
    source: isAiConfigured() ? "ai" : "heuristic",
  };
}

// ─── AI community classifier ────────────────────────────────────────────────

export interface CommunityClassification {
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  relevanceScore: number; // 0–100 — is this post relevant to the group?
  reason: string;
  source: "ai" | "heuristic";
}

/**
 * When location is missing, the AI predicts which community a post belongs to
 * and whether it is relevant to the group. Used as a fallback before the user
 * is prompted to set a location manually.
 */
export async function classifyCommunity(
  content: string,
  knownContext?: { stateName?: string | null; lgaName?: string | null }
): Promise<CommunityClassification> {
  const fallback: CommunityClassification = {
    stateName: knownContext?.stateName ?? null,
    lgaName: knownContext?.lgaName ?? null,
    wardName: null,
    communityName: null,
    relevanceScore: 50,
    reason: "Location not provided — awaiting manual confirmation.",
    source: "heuristic",
  };

  if (!isAiConfigured()) return fallback;

  try {
    const { data, source } = await generateAiJson<{
      state: string | null;
      lga: string | null;
      ward: string | null;
      community: string | null;
      relevance: number;
      reason: string;
    }>(
      `You are a geo-inference model for a Nigerian hyper-local community platform. ` +
        `From the post text, infer the most likely Nigerian State, LGA, ward and ` +
        `community the post refers to (use null when unknown). Also judge whether ` +
        `the post is relevant to a local community group (0-100). ` +
        `Respond with JSON {"state": "...", "lga": "...", "ward": "...", "community": "...", "relevance": 0-100, "reason": "..."}.`,
      `Post: """${content.slice(0, 1500)}"""\nKnown context: state=${knownContext?.stateName ?? "unknown"}, lga=${knownContext?.lgaName ?? "unknown"}`,
      { state: fallback.stateName, lga: fallback.lgaName, ward: null, community: null, relevance: 50, reason: fallback.reason },
      { temperature: 0.3, maxOutputTokens: 256 }
    );
    return {
      stateName: data.state ?? fallback.stateName,
      lgaName: data.lga ?? fallback.lgaName,
      wardName: data.ward ?? null,
      communityName: data.community ?? null,
      relevanceScore: Math.max(0, Math.min(100, Number(data.relevance) || 50)),
      reason: data.reason || fallback.reason,
      source: source === "fallback" ? "heuristic" : "ai",
    };
  } catch {
    return fallback;
  }
}

// ─── Trending engine ───────────────────────────────────────────────────────

export interface TrendingTopic {
  tag: string;
  count: number;
  trend: "up" | "down" | "stable";
  scope: string;
  label: string;
}

/**
 * Trending topics per community / ward / LGA / state. Aggregates the AI tags
 * on recent feeds, weighted by recency and engagement. Falls back to the
 * storage-layer SQL aggregation when the AI is not configured.
 */
export async function computeTrending(
  scope: "community" | "ward" | "lga" | "state" | "all",
  filters: { state?: string; lga?: string; ward?: string; community?: string },
  windowHours = 24
): Promise<{ topics: TrendingTopic[]; scope: string }> {
  // Reuse the storage-layer aggregation (recency-weighted count by tag).
  const { getTrendingTags } = await import("@/lib/community-feed-storage");
  const { tags } = await getTrendingTags(scope, filters, windowHours, 10);

  let topics: TrendingTopic[] = tags.map((t) => ({
    tag: t.tag,
    count: t.count,
    trend: t.trend,
    scope,
    label: prettifyTag(t.tag),
  }));

  // If the AI is configured, ask it to surface an emerging narrative for the
  // top tags (best-effort enrichment — never blocks the response).
  if (isAiConfigured() && topics.length > 0) {
    try {
      const topTags = topics.slice(0, 6).map((t) => t.tag);
      const { data } = await generateAiJsonArray<{ tag: string; headline: string }>(
        `You are a trend analyst for a Nigerian community platform. For each tag, write a 4-8 word trending headline summarizing what is happening. Respond as a JSON array of {"tag": "...", "headline": "..."}.`,
        `Tags: ${JSON.stringify(topTags)}\nLocation context: ${filters.state || "Nigeria"}${filters.lga ? ", " + filters.lga : ""}${filters.community ? ", " + filters.community : ""}`,
        [],
        { temperature: 0.5, maxOutputTokens: 512 }
      );
      const headlineMap = new Map((data || []).map((h) => [h.tag, h.headline]));
      topics = topics.map((t) => ({
        ...t,
        label: headlineMap.get(t.tag) || t.label,
      }));
    } catch {
      // keep SQL-only trending
    }
  }

  return { topics, scope };
}

function prettifyTag(tag: string): string {
  return tag
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
