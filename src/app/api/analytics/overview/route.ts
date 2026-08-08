import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/analytics/overview — Platform-wide analytics for admin dashboard
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const adminCheck = await isSuperAdmin();
  if (!adminCheck) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();

  // Total counts
  const totals = (await sql`
    SELECT
      (SELECT COUNT(*) FROM micro_truths) as total_truths,
      (SELECT COUNT(*) FROM platform_users) as total_users,
      (SELECT COUNT(*) FROM organizations) as total_orgs,
      (SELECT COUNT(*) FROM verifications) as total_verifications,
      (SELECT COUNT(*) FROM feed_likes) as total_likes,
      (SELECT COUNT(*) FROM feed_comments) as total_comments,
      (SELECT COUNT(*) FROM feed_shares) as total_shares,
      (SELECT COUNT(*) FROM user_subscriptions) as total_subscriptions
  `) as unknown as any[];

  // Truths by category
  const byCategory = (await sql`
    SELECT category, COUNT(*) as count
    FROM micro_truths
    GROUP BY category
    ORDER BY count DESC
    LIMIT 20
  `) as unknown as any[];

  // Truths by region
  const byRegion = (await sql`
    SELECT n.region, COUNT(*) as count
    FROM micro_truths t
    JOIN neighborhoods n ON t.neighborhood_id = n.id
    GROUP BY n.region
    ORDER BY count DESC
  `) as unknown as any[];

  // Truths by state
  const byState = (await sql`
    SELECT n.state, COUNT(*) as count
    FROM micro_truths t
    JOIN neighborhoods n ON t.neighborhood_id = n.id
    GROUP BY n.state
    ORDER BY count DESC
  `) as unknown as any[];

  // Posts over last 30 days
  const postsTrend = (await sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM micro_truths
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // New users over last 30 days
  const usersTrend = (await sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM platform_users
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // Top contributors
  const topContributors = (await sql`
    SELECT user_hash, COUNT(*) as count
    FROM micro_truths
    WHERE user_hash IS NOT NULL
    GROUP BY user_hash
    ORDER BY count DESC
    LIMIT 10
  `) as unknown as any[];

  // Verification rate (status: verified, rejected, pending)
  const verificationRate = (await sql`
    SELECT
      COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(*) as total
    FROM micro_truths
  `) as unknown as any[];

  // Engagement trend (likes + comments + shares over last 30 days)
  const engagementTrend = (await sql`
    SELECT DATE(created_at) as date, 'likes' as type, COUNT(*) as count
    FROM feed_likes WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    UNION ALL
    SELECT DATE(created_at) as date, 'comments' as type, COUNT(*) as count
    FROM feed_comments WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    UNION ALL
    SELECT DATE(created_at) as date, 'shares' as type, COUNT(*) as count
    FROM feed_shares WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // Trust score distribution
  const trustScoreDistribution = (await sql`
    SELECT
      COUNT(CASE WHEN trust_score >= 80 THEN 1 END) as high,
      COUNT(CASE WHEN trust_score >= 60 AND trust_score < 80 THEN 1 END) as medium_high,
      COUNT(CASE WHEN trust_score >= 40 AND trust_score < 60 THEN 1 END) as medium,
      COUNT(CASE WHEN trust_score >= 20 AND trust_score < 40 THEN 1 END) as low,
      COUNT(CASE WHEN trust_score < 20 THEN 1 END) as very_low
    FROM micro_truths
  `) as unknown as any[];

  // Truths by LGA (top 10)
  const byLga = (await sql`
    SELECT COALESCE(state_name, 'Unknown') as lga, COUNT(*) as count
    FROM micro_truths
    GROUP BY COALESCE(state_name, 'Unknown')
    ORDER BY count DESC
    LIMIT 10
  `) as unknown as any[];

  // Trust score trend (average trust per day, last 30 days)
  const trustTrend = (await sql`
    SELECT DATE(created_at) as date, ROUND(AVG(trust_score)) as avg_trust
    FROM micro_truths
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `) as unknown as any[];

  // Engagement by type (total)
  const engagementByType = (await sql`
    SELECT 'likes' as type, COUNT(*) as count FROM feed_likes
    UNION ALL
    SELECT 'comments' as type, COUNT(*) as count FROM feed_comments
    UNION ALL
    SELECT 'shares' as type, COUNT(*) as count FROM feed_shares
    UNION ALL
    SELECT 'subscriptions' as type, COUNT(*) as count FROM user_subscriptions
  `) as unknown as any[];

  return Response.json({
    totals: {
      truths: Number(totals[0].total_truths),
      users: Number(totals[0].total_users),
      organizations: Number(totals[0].total_orgs),
      verifications: Number(totals[0].total_verifications),
      likes: Number(totals[0].total_likes),
      comments: Number(totals[0].total_comments),
      shares: Number(totals[0].total_shares),
      subscriptions: Number(totals[0].total_subscriptions),
    },
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    byRegion: byRegion.map((r) => ({ region: r.region, count: Number(r.count) })),
    byState: byState.map((r) => ({ state: r.state, count: Number(r.count) })),
    postsTrend: postsTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
    usersTrend: usersTrend.map((r) => ({ date: r.date, count: Number(r.count) })),
    topContributors: topContributors.map((r) => ({ userHash: r.user_hash, count: Number(r.count) })),
    verificationRate: {
      verified: Number(verificationRate[0].verified),
      rejected: Number(verificationRate[0].rejected),
      pending: Number(verificationRate[0].pending),
      total: Number(verificationRate[0].total),
    },
    trustScoreDistribution: {
      high: Number(trustScoreDistribution[0].high),
      mediumHigh: Number(trustScoreDistribution[0].medium_high),
      medium: Number(trustScoreDistribution[0].medium),
      low: Number(trustScoreDistribution[0].low),
      veryLow: Number(trustScoreDistribution[0].very_low),
    },
    byLga: byLga.map((r) => ({ lga: r.lga, count: Number(r.count) })),
    trustTrend: trustTrend.map((r) => ({ date: r.date, avgTrust: Number(r.avg_trust) })),
    engagementByType: engagementByType.map((r) => ({ type: r.type, count: Number(r.count) })),
    engagementTrend: engagementTrend.map((r) => ({ date: r.date, type: r.type, count: Number(r.count) })),
  });
}
