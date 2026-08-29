/**
 * AI Community Service
 *
 * Provides AI-driven enhancements for the community feeds system:
 *   1. AI Community Classifier — predicts community/ward for posts without location
 *   2. AI Content Tagging — auto-tags posts (Power outage, Fuel update, Security alert, etc.)
 *   3. AI Spam Detection — blocks fake, duplicate, and bot-generated content
 *   4. AI Trending Engine — finds trending topics per community/ward/LGA/state
 *
 * All AI services use a modular design:
 *   - If an AI provider (Deepseek/Kimi K3) is configured, it uses the LLM.
 *   - If no provider is configured, it falls back to deterministic heuristic logic.
 *   - AI calls are non-blocking: posts are saved first, then analyzed asynchronously.
 */

import { getDb } from "@/lib/db";
import { generateAiJson, isAiConfigured } from "@/lib/ai-providers";

type SqlRow = Record<string, any>;

// ─── 1. AI Community Classifier ───

export interface CommunityPrediction {
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  confidence: number;
  reasoning: string;
  method: "ai" | "heuristic";
}

/**
 * Predict the community/ward/LGA/state for a post when location is missing.
 * Uses AI if configured, otherwise falls back to keyword-based heuristic matching.
 */
export async function predictCommunityFromContent(
  content: string,
  category?: string
): Promise<CommunityPrediction> {
  // Try AI first
  if (isAiConfigured()) {
    try {
      const fallback = { stateName: null, lgaName: null, wardName: null, communityName: null, confidence: 0.5, reasoning: "AI prediction" };
      const { data: json } = await generateAiJson(
        `You are a Nigerian geography expert. Given a community post's content and category, predict the most likely Nigerian State, LGA, Ward, and Community the post refers to. Return ONLY a JSON object with fields: stateName, lgaName, wardName, communityName, confidence (0-1), reasoning. If you cannot determine a specific location, set the field to null and explain in reasoning.`,
        `Content: "${content}"\nCategory: ${category || "general"}\n\nPredict the Nigerian geo hierarchy (state, LGA, ward, community) this post most likely belongs to.`,
        fallback,
        { temperature: 0.3, maxOutputTokens: 300 }
      );

      return {
        stateName: json.stateName ?? null,
        lgaName: json.lgaName ?? null,
        wardName: json.wardName ?? null,
        communityName: json.communityName ?? null,
        confidence: Math.min(Math.max(json.confidence ?? 0.5, 0), 1),
        reasoning: json.reasoning ?? "AI-predicted location",
        method: "ai",
      };
    } catch (err) {
      console.error("[ai-community] AI prediction failed, using heuristic:", err);
    }
  }

  // Heuristic fallback: keyword matching against known Nigerian locations
  return heuristicCommunityPrediction(content, category);
}

/**
 * Heuristic-based community prediction using keyword matching.
 * Checks for Nigerian state/LGA names in the content.
 */
function heuristicCommunityPrediction(content: string, _category?: string): CommunityPrediction {
  const lowerContent = content.toLowerCase();

  // Common Nigerian location keywords and their geo hierarchy
  const locationKeywords: Array<{
    keywords: string[];
    state: string;
    lga: string | null;
    ward: string | null;
    community: string | null;
  }> = [
    // Lagos
    { keywords: ["lekki", "victoria island", "vi ", "ikoyi"], state: "Lagos", lga: "Eti-Osa", ward: null, community: null },
    { keywords: ["ikeja", "computer village"], state: "Lagos", lga: "Ikeja", ward: null, community: null },
    { keywords: ["yaba", "sabo", "akoka"], state: "Lagos", lga: "Lagos Mainland", ward: null, community: null },
    { keywords: ["surulere", "aguda"], state: "Lagos", lga: "Surulere", ward: null, community: null },
    { keywords: ["ikorodu"], state: "Lagos", lga: "Ikorodu", ward: null, community: null },
    { keywords: ["epe"], state: "Lagos", lga: "Epe", ward: null, community: null },
    { keywords: ["badagry"], state: "Lagos", lga: "Badagry", ward: null, community: null },
    // Abuja/FCT
    { keywords: ["wuse", "garki", "maitama", "asokoro"], state: "FCT", lga: "Municipal Area Council", ward: null, community: null },
    { keywords: ["gwarinpa", "kubwa", "bwari"], state: "FCT", lga: "Bwari", ward: null, community: null },
    { keywords: ["gwagwalada", "kuje", "abaji", "kwali"], state: "FCT", lga: null, ward: null, community: null },
    // Port Harcourt
    { keywords: ["port harcourt", "ph city", "diobu", "dline", "gra ph"], state: "Rivers", lga: "Port Harcourt", ward: null, community: null },
    { keywords: ["bonny", "okrika", "eleme"], state: "Rivers", lga: null, ward: null, community: null },
    // Kano
    { keywords: ["kano municipal", "dala", "fagge", "nasarawa kano"], state: "Kano", lga: null, ward: null, community: null },
    // Enugu
    { keywords: ["enugu", "nsukka", "independence layout", "new haven enugu"], state: "Enugu", lga: null, ward: null, community: null },
    // Ibadan
    { keywords: ["ibadan", "bodija", "agodi", "dugbe"], state: "Oyo", lga: "Ibadan North", ward: null, community: null },
    { keywords: ["challenge ibadan", "ring road ibadan"], state: "Oyo", lga: "Ibadan South West", ward: null, community: null },
  ];

  for (const loc of locationKeywords) {
    if (loc.keywords.some((kw) => lowerContent.includes(kw))) {
      return {
        stateName: loc.state,
        lgaName: loc.lga,
        wardName: loc.ward,
        communityName: loc.community,
        confidence: 0.7,
        reasoning: "Heuristic match: detected location keyword in content",
        method: "heuristic",
      };
    }
  }

  // Check if content mentions a Nigerian state name directly
  const nigeriaStates = [
    "lagos", "ogun", "oyo", "osun", "ondo", "ekiti", "abia", "anambra",
    "ebonyi", "enugu", "imo", "akwa ibom", "bayelsa", "cross river",
    "delta", "edo", "rivers", "benue", "kogi", "kwara", "nasarawa",
    "plateau", "fct", "abuja", "adamawa", "bauchi", "borno", "gombe",
    "taraba", "yobe", "jigawa", "kaduna", "kano", "katsina", "kebbi",
    "sokoto", "zamfara", "niger",
  ];

  for (const state of nigeriaStates) {
    if (lowerContent.includes(state)) {
      return {
        stateName: state === "abuja" ? "FCT" : state.charAt(0).toUpperCase() + state.slice(1),
        lgaName: null,
        wardName: null,
        communityName: null,
        confidence: 0.5,
        reasoning: "Heuristic match: state name detected in content",
        method: "heuristic",
      };
    }
  }

  return {
    stateName: null,
    lgaName: null,
    wardName: null,
    communityName: null,
    confidence: 0.2,
    reasoning: "Could not determine location from content",
    method: "heuristic",
  };
}

// ─── 2. AI Content Tagging ───

export interface ContentTags {
  tags: string[];
  category: string | null;
  confidence: number;
  method: "ai" | "heuristic";
}

/**
 * Standard content tags for Nigerian community posts.
 */
export const STANDARD_TAGS = [
  "Power outage",
  "Fuel update",
  "Security alert",
  "Market prices",
  "Traffic update",
  "Road condition",
  "Water supply",
  "Health alert",
  "Education update",
  "Community event",
  "Government notice",
  "Weather alert",
  "Market update",
  "Religious activity",
  "Infrastructure",
] as const;

/**
 * Automatically tag posts based on content.
 * Uses AI if configured, otherwise heuristic keyword matching.
 */
export async function autoTagContent(content: string, category?: string): Promise<ContentTags> {
  // Try AI first
  if (isAiConfigured()) {
    try {
      const tagList = STANDARD_TAGS.join(", ");
      const fallback = { tags: [] as string[], category: null as string | null, confidence: 0.7 };
      const { data: json } = await generateAiJson(
        `You are a content classification system for a Nigerian community platform. Given a post's content, assign relevant tags from this list: ${tagList}. You may also suggest a more specific category. Return ONLY a JSON object: { "tags": ["tag1", "tag2"], "category": "specific_category", "confidence": 0.0-1.0 }`,
        `Content: "${content}"\nCurrent category: ${category || "general"}\n\nTag this content.`,
        fallback,
        { temperature: 0.2, maxOutputTokens: 200 }
      );

      return {
        tags: Array.isArray(json.tags) ? json.tags : [],
        category: json.category ?? null,
        confidence: Math.min(Math.max(json.confidence ?? 0.7, 0), 1),
        method: "ai",
      };
    } catch (err) {
      console.error("[ai-tagging] AI tagging failed, using heuristic:", err);
    }
  }

  // Heuristic fallback
  return heuristicTagContent(content, category);
}

/**
 * Keyword-based content tagging heuristics.
 */
function heuristicTagContent(content: string, _category?: string): ContentTags {
  const lower = content.toLowerCase();
  const tags: string[] = [];

  if (/power|electricity|light|outage|blackout|disco|nedc|ikdc|ecgd|phcn|grid|transformer|meter|prepaid|billing/i.test(lower)) {
    tags.push("Power outage");
  }
  if (/fuel|petrol|diesel|kerosene|pms|ago|gas station|filling station|nnpc|price.*per.*litre|fuel.*scarcity|queue.*fuel/i.test(lower)) {
    tags.push("Fuel update");
  }
  if (/security|robbery|thief|thieves|kidnap|abduction|bandit|insurgen|boko|military|police|army|vigilante|crime|attack|theft|burglar|suspicious|danger/i.test(lower)) {
    tags.push("Security alert");
  }
  if (/price|cost|market|buy|sell|naira|₦|rice|beans|yam|garri|tomato|onion|pepper|cooking.*oil|commodit/i.test(lower)) {
    tags.push("Market prices");
  }
  if (/traffic|jam|congestion|road|accident|crash|vehicle|car|bus|okada|keke|tricycle|gridlock|go-slow|hold.up/i.test(lower)) {
    tags.push("Traffic update");
  }
  if (/water|borehole|well|tap|supply|shortage|flood|rain|drainage|sewage/i.test(lower)) {
    tags.push("Water supply");
  }
  if (/health|hospital|clinic|doctor|nurse|disease|epidemic|outbreak|malaria|cholera|covid|fever|sick|illness|pharmacy|drug|medication/i.test(lower)) {
    tags.push("Health alert");
  }
  if (/school|university|college|student|teacher|exam|jamb|waec|neco|lecture|admission|academic|education/i.test(lower)) {
    tags.push("Education update");
  }
  if (/government|governor|president|senate|house.*assembly|council|chairman|local government|policy|budget|tax|nysc|ministry|agency|official/i.test(lower)) {
    tags.push("Government notice");
  }
  if (/festival|celebration|wedding|burial|funeral|naming|ceremony|event|party|gathering|meeting|town.hall/i.test(lower)) {
    tags.push("Community event");
  }
  if (/rain|weather|harmattan|heat|cold|temperature|storm|wind|humidity|forecast/i.test(lower)) {
    tags.push("Weather alert");
  }
  if (/road|bridge|construction|building|renovation|infrastructure|project|contractor|collapse|dilapidated|pothole/i.test(lower)) {
    tags.push("Infrastructure");
  }

  if (tags.length === 0) {
    tags.push("Community update");
  }

  return {
    tags: [...new Set(tags)],
    category: null,
    confidence: 0.6,
    method: "heuristic",
  };
}

// ─── 3. AI Spam Detection ───

export interface SpamDetectionResult {
  isSpam: boolean;
  spamScore: number;
  flags: string[];
  action: "allow" | "flag" | "block";
  method: "ai" | "heuristic";
}

/**
 * Detect spam, fake posts, duplicates, and bot-generated content.
 * Uses AI if configured, otherwise heuristic checks.
 */
export async function detectSpam(
  content: string,
  userHash: string,
  category?: string
): Promise<SpamDetectionResult> {
  const flags: string[] = [];
  let spamScore = 0;

  // ── Heuristic checks (always run) ──

  // 1. Duplicate detection: check if similar content exists recently
  const sql = getDb();
  try {
    const recentDuplicates = (await sql`
      SELECT id, content FROM micro_truths
      WHERE user_hash = ${userHash}
        AND created_at > NOW() - INTERVAL '24 hours'
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20
    `) as unknown as SqlRow[];

    for (const existing of recentDuplicates) {
      const similarity = textSimilarity(content.toLowerCase(), String(existing.content).toLowerCase());
      if (similarity > 0.85) {
        flags.push("duplicate_content");
        spamScore = Math.max(spamScore, 0.9);
        break;
      } else if (similarity > 0.6) {
        flags.push("similar_content");
        spamScore = Math.max(spamScore, 0.5);
      }
    }
  } catch (err) {
    console.error("[spam-detection] Duplicate check failed:", err);
  }

  // 2. Rate limiting: check if user is posting too frequently
  try {
    const recentPosts = (await sql`
      SELECT COUNT(*) AS cnt FROM micro_truths
      WHERE user_hash = ${userHash}
        AND created_at > NOW() - INTERVAL '10 minutes'
        AND deleted_at IS NULL
    `) as unknown as SqlRow[];

    const postCount = Number(recentPosts[0]?.cnt);
    if (postCount >= 10) {
      flags.push("bot_behavior");
      spamScore = Math.max(spamScore, 0.9);
    } else if (postCount >= 5) {
      flags.push("rate_limit_exceeded");
      spamScore = Math.max(spamScore, 0.7);
    }
  } catch (err) {
    console.error("[spam-detection] Rate check failed:", err);
  }

  // 3. Content quality checks
  if (content.length < 10) {
    flags.push("too_short");
    spamScore = Math.max(spamScore, 0.4);
  }

  // 4. Repetitive characters / patterns
  if (/(.)\1{10,}/.test(content)) {
    flags.push("repetitive_characters");
    spamScore = Math.max(spamScore, 0.5);
  }

  // 5. All caps (shouting)
  const upperRatio = (content.match(/[A-Z]/g) || []).length / Math.max(content.length, 1);
  if (upperRatio > 0.7 && content.length > 20) {
    flags.push("excessive_caps");
    spamScore = Math.max(spamScore, 0.3);
  }

  // 6. URL spam
  const urlCount = (content.match(/https?:\/\/\S+/gi) || []).length;
  if (urlCount > 3) {
    flags.push("url_spam");
    spamScore = Math.max(spamScore, 0.6);
  }

  // 7. Phone number spam (multiple phone numbers)
  const phoneCount = (content.match(/(?:\+?234|0)\d{10,}/g) || []).length;
  if (phoneCount > 2) {
    flags.push("phone_spam");
    spamScore = Math.max(spamScore, 0.5);
  }

  // ── AI-based spam detection (if configured) ──
  if (isAiConfigured() && spamScore < 0.7) {
    try {
      const fallback = { is_spam: false, spam_score: 0, flags: [] as string[], reasoning: "no AI available" };
      const { data: json } = await generateAiJson(
        `You are a spam detection system for a Nigerian community platform. Analyze the post for: fake news, bot-generated content, scam/fraud, irrelevant content. Return ONLY JSON: { "is_spam": bool, "spam_score": 0.0-1.0, "flags": ["flag1"], "reasoning": "..." }`,
        `Content: "${content}"\nCategory: ${category || "general"}\n\nAnalyze for spam.`,
        fallback,
        { temperature: 0.1, maxOutputTokens: 200 }
      );

      const aiScore = Math.min(Math.max(json.spam_score ?? 0, 0), 1);
      spamScore = Math.max(spamScore, aiScore);
      if (Array.isArray(json.flags)) {
        flags.push(...json.flags);
      }
      if (json.is_spam) {
        flags.push("ai_flagged_spam");
      }
    } catch (err) {
      console.error("[spam-detection] AI spam check failed:", err);
    }
  }

  const isSpam = spamScore >= 0.7;
  const action = spamScore >= 0.9 ? "block" : spamScore >= 0.5 ? "flag" : "allow";

  return {
    isSpam,
    spamScore: Math.round(spamScore * 100) / 100,
    flags: [...new Set(flags)],
    action,
    method: isAiConfigured() ? "ai" : "heuristic",
  };
}

/**
 * Simple text similarity using Jaccard similarity on word sets.
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

// ─── 4. AI Trending Engine ───

export interface TrendingTopic {
  category: string;
  tag: string | null;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalVerifications: number;
  trendingScore: number;
  sampleContent: string | null;
}

export type TrendingGeoLevel = "community" | "ward" | "lga" | "state" | "all_nigeria";

/**
 * Compute trending topics for a given geo level.
 *
 * Trending score = (postCount * 1.0) + (likes * 0.3) + (comments * 0.5) + (verifications * 0.4)
 * Weighted by recency (newer posts contribute more).
 */
export async function getTrendingTopics(
  level: TrendingGeoLevel,
  geoId: number | null,
  hoursBack = 24
): Promise<TrendingTopic[]> {
  const sql = getDb();
  const cutoff = new Date(Date.now() - hoursBack * 3600000).toISOString();

  let geoFilter = "";
  const params: any[] = [cutoff];
  let paramIdx = 2;

  switch (level) {
    case "community":
      if (geoId) {
        geoFilter = ` AND t.community_id = $${paramIdx++}`;
        params.push(geoId);
      }
      break;
    case "ward":
      if (geoId) {
        geoFilter = ` AND t.ward_id = $${paramIdx++}`;
        params.push(geoId);
      }
      break;
    case "lga":
      if (geoId) {
        geoFilter = ` AND t.lga_id = $${paramIdx++}`;
        params.push(geoId);
      }
      break;
    case "state":
      if (geoId) {
        geoFilter = ` AND t.state_id = $${paramIdx++}`;
        params.push(geoId);
      }
      break;
    case "all_nigeria":
    default:
      break;
  }

  const query = `
    WITH tagged_posts AS (
      SELECT
        t.id,
        t.category,
        t.ai_tags,
        t.content,
        t.created_at,
        COALESCE(lc.cnt, 0) AS likes,
        COALESCE(cc.cnt, 0) AS comments,
        COALESCE(vc.cnt, 0) AS verifications,
        GREATEST(0.1, 1.0 - EXTRACT(EPOCH FROM (NOW() - t.created_at)) / ${hoursBack * 3600}) AS recency_weight
      FROM micro_truths t
      LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_likes WHERE deleted_at IS NULL GROUP BY truth_id) lc ON lc.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_comments WHERE deleted_at IS NULL GROUP BY truth_id) cc ON cc.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM verifications GROUP BY truth_id) vc ON vc.truth_id = t.id
      WHERE t.deleted_at IS NULL
        AND t.status <> 'rejected'
        AND t.created_at > $1
        ${geoFilter}
    )
    SELECT
      category,
      NULLIF(ai_tags, '[]') AS tag_json,
      COUNT(*) AS post_count,
      COALESCE(SUM(likes), 0) AS total_likes,
      COALESCE(SUM(comments), 0) AS total_comments,
      COALESCE(SUM(verifications), 0) AS total_verifications,
      COALESCE(
        SUM(
          (COUNT(*) OVER (PARTITION BY category) * 1.0) +
          (likes * 0.3) +
          (comments * 0.5) +
          (verifications * 0.4)
        ) * AVG(recency_weight),
        0
      ) AS trending_score,
      (SELECT content FROM tagged_posts tp2 WHERE tp2.category = tagged_posts.category ORDER BY tp2.created_at DESC LIMIT 1) AS sample_content
    FROM tagged_posts
    GROUP BY category, ai_tags
    ORDER BY trending_score DESC
    LIMIT 20
  `;

  try {
    const rows = (await sql.query(query, params)) as unknown as SqlRow[];
    const results: TrendingTopic[] = [];

    // Aggregate by category (merge rows with different tags but same category)
    const byCategory = new Map<string, TrendingTopic>();
    for (const r of rows) {
      const cat = r.category as string;
      const existing = byCategory.get(cat) || {
        category: cat,
        tag: null as string | null,
        postCount: 0,
        totalLikes: 0,
        totalComments: 0,
        totalVerifications: 0,
        trendingScore: 0,
        sampleContent: null as string | null,
      };
      existing.postCount += Number(r.post_count);
      existing.totalLikes += Number(r.total_likes || 0);
      existing.totalComments += Number(r.total_comments || 0);
      existing.totalVerifications += Number(r.total_verifications || 0);
      existing.trendingScore += Number(r.trending_score || 0);
      if (!existing.sampleContent && r.sample_content) {
        existing.sampleContent = r.sample_content;
      }
      byCategory.set(cat, existing);
    }

    return Array.from(byCategory.values())
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 20);
  } catch (err) {
    console.error("[trending] Query failed:", err);
    return [];
  }
}

/**
 * Update trending scores for all posts.
 * This should be called periodically (e.g., via cron) to refresh trending scores.
 */
export async function refreshTrendingScores(): Promise<{ updated: number }> {
  const sql = getDb();
  try {
    const result = (await sql`
      WITH engagement AS (
        SELECT
          t.id,
          COALESCE(lc.cnt, 0) AS likes,
          COALESCE(cc.cnt, 0) AS comments,
          COALESCE(vc.cnt, 0) AS verifications,
          COALESCE(sc.cnt, 0) AS shares
        FROM micro_truths t
        LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_likes WHERE deleted_at IS NULL GROUP BY truth_id) lc ON lc.truth_id = t.id
        LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_comments WHERE deleted_at IS NULL GROUP BY truth_id) cc ON cc.truth_id = t.id
        LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM verifications GROUP BY truth_id) vc ON vc.truth_id = t.id
        LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_shares GROUP BY truth_id) sc ON sc.truth_id = t.id
        WHERE t.deleted_at IS NULL AND t.status <> 'rejected'
      )
      UPDATE micro_truths
      SET trending_score = sub.trending_score
      FROM (
        SELECT
          e.id,
          (e.likes * 0.3 + e.comments * 0.5 + e.verifications * 0.4 + e.shares * 0.2)
            * GREATEST(0.1, 1.0 - EXTRACT(EPOCH FROM (NOW() - micro_truths.created_at)) / 604800) AS trending_score
        FROM engagement e
        JOIN micro_truths ON micro_truths.id = e.id
        WHERE micro_truths.created_at > NOW() - INTERVAL '7 days'
      ) sub
      WHERE micro_truths.id = sub.id
      RETURNING micro_truths.id
    `) as unknown as SqlRow[];

    return { updated: result.length };
  } catch (err) {
    console.error("[trending] Refresh failed:", err);
    return { updated: 0 };
  }
}

/**
 * Run AI analysis on a newly created post (tags, spam check, trending update).
 * Called asynchronously after post creation — does not block the response.
 */
export async function analyzePost(truthId: number, content: string, category: string, userHash: string): Promise<void> {
  const sql = getDb();

  try {
    // 1. Auto-tag content
    const tagResult = await autoTagContent(content, category);

    // 2. Spam detection
    const spamResult = await detectSpam(content, userHash, category);

    // 3. Update the post with AI results
    await sql`
      UPDATE micro_truths
      SET ai_tags = ${JSON.stringify(tagResult.tags)}::text,
          ai_category = ${tagResult.category},
          ai_spam_score = ${spamResult.spamScore},
          ai_spam_flags = ${JSON.stringify(spamResult.flags)}::text,
          ai_analyzed_at = NOW(),
          status = CASE WHEN ${spamResult.action} = 'block' THEN 'rejected' ELSE status END
      WHERE id = ${truthId}
    `;

    // 4. If spam action is block, soft-delete
    if (spamResult.action === "block") {
      await sql`
        UPDATE micro_truths
        SET deleted_at = NOW(),
            delete_reason = 'ai_spam_detection'
        WHERE id = ${truthId}
      `;
      console.log(`[ai-community] Post ${truthId} blocked by spam detection (score: ${spamResult.spamScore})`);
    }

    // 5. Update geography if not already set
    await sql`
      UPDATE micro_truths
      SET geog = ST_MakePoint(report_lng, report_lat)::geography
      WHERE id = ${truthId}
        AND report_lat IS NOT NULL
        AND report_lng IS NOT NULL
        AND geog IS NULL
    `;
  } catch (err) {
    console.error(`[ai-community] Post ${truthId} analysis failed:`, err);
  }
}
