import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";

/**
 * GET /api/analytics/user — Per-user analytics for user dashboard
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  // User's stats
  const userStats = (await sql`
    SELECT
      (SELECT COUNT(*) FROM micro_truths WHERE user_hash = ${userHash}) as posts_count,
      (SELECT COUNT(*) FROM verifications WHERE user_hash = ${userHash}) as verifications_count,
      (SELECT COUNT(*) FROM feed_likes WHERE user_hash = ${userHash}) as likes_given,
      (SELECT COUNT(*) FROM feed_likes l JOIN micro_truths t ON l.truth_id = t.id WHERE t.user_hash = ${userHash}) as likes_received,
      (SELECT COUNT(*) FROM feed_comments WHERE user_hash = ${userHash}) as comments_count,
      (SELECT COUNT(*) FROM user_subscriptions WHERE subscriber_hash = ${userHash}) as subscriptions_count,
      (SELECT COUNT(*) FROM user_subscriptions WHERE target_hash = ${userHash}) as subscribers_count,
      (SELECT COALESCE(SUM(points), 0) FROM reward_ledger WHERE user_hash = ${userHash}) as reward_points
  `) as unknown as any[];

  // User's posts by category
  const postsByCategory = (await sql`
    SELECT category, COUNT(*) as count
    FROM micro_truths
    WHERE user_hash = ${userHash}
    GROUP BY category
    ORDER BY count DESC
  `) as unknown as any[];

  // User's posting activity over last 30 days
  const postingTrend = (await sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM micro_truths
    WHERE user_hash = ${userHash} AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // User's engagement over last 30 days
  const engagementTrend = (await sql`
    SELECT DATE(created_at) as date, 'likes' as type, COUNT(*) as count
    FROM feed_likes WHERE user_hash = ${userHash} AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    UNION ALL
    SELECT DATE(created_at) as date, 'comments' as type, COUNT(*) as count
    FROM feed_comments WHERE user_hash = ${userHash} AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // Recent posts with engagement
  const recentPosts = (await sql`
    SELECT t.id, t.category, t.content, t.status, t.created_at,
      (SELECT COUNT(*) FROM feed_likes WHERE truth_id = t.id) as like_count,
      (SELECT COUNT(*) FROM feed_comments WHERE truth_id = t.id AND status = 'active') as comment_count,
      (SELECT COUNT(*) FROM feed_shares WHERE truth_id = t.id) as share_count
    FROM micro_truths t
    WHERE t.user_hash = ${userHash}
    ORDER BY t.created_at DESC
    LIMIT 10
  `) as unknown as any[];

  return Response.json({
    stats: {
      posts: Number(userStats[0].posts_count),
      verifications: Number(userStats[0].verifications_count),
      likesGiven: Number(userStats[0].likes_given),
      likesReceived: Number(userStats[0].likes_received),
      comments: Number(userStats[0].comments_count),
      subscriptions: Number(userStats[0].subscriptions_count),
      subscribers: Number(userStats[0].subscribers_count),
      rewardPoints: Number(userStats[0].reward_points),
    },
    postsByCategory: postsByCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    postingTrend: postingTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
    engagementTrend: engagementTrend.map((r) => ({ date: r.date, type: r.type, count: Number(r.count) })),
    recentPosts: recentPosts.map((r) => ({
      id: r.id,
      category: r.category,
      content: r.content,
      status: r.status,
      createdAt: r.created_at,
      likeCount: Number(r.like_count),
      commentCount: Number(r.comment_count),
      shareCount: Number(r.share_count),
    })),
  });
}
