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

  // 4. Score and rank notifications based on user preferences
  const notifications: Array<{
    id: string;
    type: "trending" | "breaking" | "recommended" | "local";
    title: string;
    message: string;
    urgency: "low" | "medium" | "high";
    category?: string;
    actionUrl?: string;
    score: number;
  }> = [];

  // Process trending truths
  for (const truth of trendingTruths.slice(0, limit)) {
    const ageHours = (Date.now() - new Date(truth.created_at).getTime()) / (1000 * 60 * 60);
    const verifications = truth.verification_count || 0;
    const trustScore = truth.trust_score || 50;

    // Calculate urgency score
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
    });
  }

  // 5. Optional: Use AI to generate a predictive insight
  let aiInsight: string | null = null;
  if (isKimiConfigured() && notifications.length > 0) {
    try {
      const topItems = notifications.slice(0, 5).map(n => ({
        title: n.title,
        category: n.category,
        urgency: n.urgency,
      }));

      aiInsight = await generateKimiText(
        "You are a predictive news assistant. Based on the trending topics, predict what the user should pay attention to next. Keep it under 100 words.",
        `User's preferred categories: ${userCategories.join(", ") || "general"}\nTrending items: ${JSON.stringify(topItems)}`,
        { temperature: 0.4, maxOutputTokens: 256 }
      );
    } catch {
      // AI insight is optional
    }
  }

  // Sort by score and return top results
  notifications.sort((a, b) => b.score - a.score);

  return Response.json({
    notifications: notifications.slice(0, limit),
    aiInsight,
    userPreferences: {
      categories: userCategories,
      neighborhoods: userNeighborhoods,
    },
  });
}
