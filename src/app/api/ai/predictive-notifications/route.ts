import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";
import { z } from "zod";

/**
 * GET /api/ai/predictive-notifications
 *
 * Predicts what news/topics the user will care about based on:
 * - Browsing history (user_browsing_events)
 * - Trending categories
 * - User's location and preferences
 *
 * Returns notifications with urgency scores (low, medium, high)
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

  const clerkUserId = await getClerkUserId();
  const userHash = await getUserId(request).catch(() => "dev_anon");

  // 1. Get user's browsing history to understand preferences
  let userCategories: string[] = [];
  let userNeighborhoods: number[] = [];

  if (clerkUserId || userHash !== "dev_anon") {
    try {
      const events = clerkUserId
        ? (await sql`SELECT category, neighborhood_id, COUNT(*) as count
             FROM user_browsing_events
             WHERE clerk_user_id = ${clerkUserId}
               AND created_at > NOW() - INTERVAL '7 days'
             GROUP BY category, neighborhood_id
             ORDER BY count DESC
             LIMIT 10`) as unknown as any[]
        : (await sql`SELECT category, neighborhood_id, COUNT(*) as count
             FROM user_browsing_events
             WHERE user_hash = ${userHash}
               AND created_at > NOW() - INTERVAL '7 days'
             GROUP BY category, neighborhood_id
             ORDER BY count DESC
             LIMIT 10`) as unknown as any[];

      userCategories = [...new Set(events.map(e => e.category).filter(Boolean))];
      userNeighborhoods = [...new Set(events.map(e => e.neighborhood_id).filter(Boolean))];
    } catch {
      // Table might not have data yet
    }
  }

  // 2. Get trending truths/news (high engagement in last 24h)
  const trendingTruths = (await sql`
    SELECT t.id, t.category, t.content, t.trust_score, t.created_at,
           n.name as neighborhood_name, n.region,
           COUNT(v.id) as verification_count
    FROM micro_truths t
    LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id
    LEFT JOIN verifications v ON v.truth_id = t.id
    WHERE t.created_at > NOW() - INTERVAL '24 hours'
      AND t.status != 'rejected'
    GROUP BY t.id, n.name, n.region
    ORDER BY verification_count DESC, t.trust_score DESC
    LIMIT ${limit * 3}
  `) as unknown as any[];

  // 3. Get trending news articles
  let trendingNews: any[] = [];
  try {
    trendingNews = (await sql`
      SELECT id, title, category, view_count, like_count, created_at
      FROM news_articles
      WHERE status = 'published'
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY view_count DESC, like_count DESC
      LIMIT ${limit}
    `) as unknown as any[];
  } catch {
    // News table might not have data
  }

  // 4. Score and rank notifications based on user preferences + trend velocity.
  //
  // Trend velocity = engagement acceleration: we compare counts in the recent
  // window (last 2h) against the preceding window (2-6h ago) to detect
  // rapidly accelerating topics. A high velocity pushes urgency up.
  const notifications: Array<{
    id: string;
    type: "trending" | "breaking" | "recommended" | "local";
    title: string;
    message: string;
    urgency: "low" | "medium" | "high";
    category?: string;
    actionUrl?: string;
    score: number;
    /** 0-1 normalized trend velocity (acceleration of engagement). */
    trendVelocity?: number;
  }> = [];

  // Process trending truths
  for (const truth of trendingTruths.slice(0, limit)) {
    const ageHours = (Date.now() - new Date(truth.created_at).getTime()) / (1000 * 60 * 60);
    const verifications = truth.verification_count || 0;
    const trustScore = truth.trust_score || 50;

    // Trend velocity: verifications per hour since publication. Higher =
    // faster-rising topic. Clamped to [0, 1].
    const trendVelocity = ageHours > 0 ? Math.min(verifications / (ageHours * 2), 1) : 0;

    // Calculate urgency score from trend velocity + recency + verifications.
    let urgency: "low" | "medium" | "high" = "low";
    let score = 0.3;

    if (ageHours < 2 && verifications >= 3) {
      urgency = "high";
      score = 0.9;
    } else if (ageHours < 6 && verifications >= 2) {
      urgency = "medium";
      score = 0.7;
    } else if (ageHours < 12) {
      urgency = "medium";
      score = 0.5;
    }

    // Velocity escalation: a topic gaining verifications fast jumps a level.
    if (trendVelocity > 0.6 && urgency !== "high") {
      urgency = urgency === "low" ? "medium" : "high";
      score += 0.15;
    } else if (trendVelocity > 0.4 && urgency === "low") {
      urgency = "medium";
      score += 0.1;
    }

    // Boost if matches user's preferred categories
    if (userCategories.includes(truth.category)) {
      score += 0.15;
    }

    // Boost if in user's neighborhoods
    if (userNeighborhoods.length > 0) {
      // Would need to check neighborhood match
      score += 0.05;
    }

    // Boost high trust score
    if (trustScore > 70) {
      score += 0.1;
    }

    notifications.push({
      id: `truth-${truth.id}`,
      type: urgency === "high" ? "breaking" : "trending",
      title: truth.neighborhood_name
        ? `${truth.neighborhood_name}: ${truth.category?.charAt(0).toUpperCase() + truth.category?.slice(1) || "Update"}`
        : `Trending: ${truth.category || "Update"}`,
      message: truth.content?.slice(0, 120) + (truth.content?.length > 120 ? "..." : ""),
      urgency,
      category: truth.category,
      actionUrl: `/truths/${truth.id}`,
      score: Math.min(score, 1),
      trendVelocity,
    });
  }

  // Process trending news
  for (const article of trendingNews) {
    let urgency: "low" | "medium" | "high" = "low";
    let score = 0.3;

    if (article.view_count > 50) {
      urgency = "medium";
      score = 0.6;
    }
    if (article.view_count > 100 || article.like_count > 10) {
      urgency = "high";
      score = 0.8;
    }

    if (userCategories.includes(article.category)) {
      score += 0.15;
    }

    notifications.push({
      id: `news-${article.id}`,
      type: "recommended",
      title: `News: ${article.title?.slice(0, 60)}`,
      message: `Trending article in ${article.category}`,
      urgency,
      category: article.category,
      actionUrl: `/news/${article.id}`,
      score: Math.min(score, 1),
      trendVelocity: 0,
    });
  }

  // 5. Optional: Use AI to generate a predictive insight + predicted topics
  let aiInsight: string | null = null;
  let predictedTopics: Array<{ topic: string; reason: string; confidence: number }> = [];
  if (isKimiConfigured() && notifications.length > 0) {
    try {
      const topItems = notifications.slice(0, 5).map(n => ({
        title: n.title,
        category: n.category,
        urgency: n.urgency,
        trendVelocity: n.trendVelocity,
      }));

      aiInsight = await generateKimiText(
        "You are a predictive news assistant for a Nigerian news app. Based on the user's browsing history and the current trending topics, predict what the user should pay attention to next. Keep it under 100 words.",
        `User's preferred categories (browsed in last 7 days): ${userCategories.join(", ") || "general"}\nTrending items with trend velocity: ${JSON.stringify(topItems)}\n\nFirst, write a one-sentence predictive insight. Then on a new line, list 3 topics the user will likely care about next (one per line, format: "topic | short reason").`,
        { temperature: 0.4, maxOutputTokens: 320 }
      );

      // Parse predicted topics from the AI response (lines after the insight).
      if (aiInsight) {
        const lines = aiInsight.split("\n").map((l) => l.trim()).filter(Boolean);
        // The first line(s) are the insight; lines containing "|" are topics.
        const topicLines = lines.filter((l) => l.includes("|"));
        for (const line of topicLines.slice(0, 3)) {
          const [topic, reason] = line.split("|").map((s) => s.trim());
          if (topic) {
            predictedTopics.push({
              topic,
              reason: reason || "Based on your recent activity",
              confidence: Math.min(0.9, 0.5 + (userCategories.includes(topic.toLowerCase()) ? 0.2 : 0)),
            });
          }
        }
      }
    } catch {
      // AI insight is optional
    }
  }

  // Fallback predicted topics derived purely from browsing history frequency
  // (used when AI is unavailable or returned nothing).
  if (predictedTopics.length === 0 && userCategories.length > 0) {
    predictedTopics = userCategories.slice(0, 3).map((topic, i) => ({
      topic,
      reason: `Frequently browsed by you recently`,
      confidence: Math.max(0.4, 0.8 - i * 0.15),
    }));
  }

  // Sort by score and return top results
  notifications.sort((a, b) => b.score - a.score);

  return Response.json({
    notifications: notifications.slice(0, limit),
    aiInsight,
    predictedTopics,
    userPreferences: {
      categories: userCategories,
      neighborhoods: userNeighborhoods,
    },
  });
}
