import { ensureDbInitialized, getDb } from "@/lib/db";
import { generatePrediction, type TruthForAnalysis } from "@/lib/ai-verification";
import { z } from "zod";

const predictSchema = z.object({
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]),
  neighborhoodId: z.coerce.number().int().positive().max(1_000_000).optional(),
});

/**
 * POST /api/ai/predict
 * Generates an AI prediction for a category based on recent truth reports.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = predictSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid input", errors: parsed.error.issues }, { status: 400 });
  }

  const { category, neighborhoodId } = parsed.data;
  const sql = getDb();

  // Fetch recent truths for this category (last 7 days)
  let rows: any[];
  if (neighborhoodId) {
    rows = (await sql`
      SELECT t.*,
        COALESCE(corr_counts.cnt, 0) as corroboration_count,
        COALESCE(disp_counts.cnt, 0) as dispute_count,
        COALESCE(like_counts.cnt, 0) as like_count,
        COALESCE(share_counts.cnt, 0) as share_count,
        COALESCE(comment_counts.cnt, 0) as comment_count
      FROM micro_truths t
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_likes GROUP BY truth_id) like_counts ON like_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_shares GROUP BY truth_id) share_counts ON share_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_comments GROUP BY truth_id) comment_counts ON comment_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'corroborate' GROUP BY truth_id) corr_counts ON corr_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'dispute' GROUP BY truth_id) disp_counts ON disp_counts.truth_id = t.id
      WHERE t.category = ${category} AND t.neighborhood_id = ${neighborhoodId}
        AND t.created_at > NOW() - INTERVAL '7 days'
      ORDER BY t.created_at DESC
      LIMIT 50
    `) as unknown as any[];
  } else {
    rows = (await sql`
      SELECT t.*,
        COALESCE(corr_counts.cnt, 0) as corroboration_count,
        COALESCE(disp_counts.cnt, 0) as dispute_count,
        COALESCE(like_counts.cnt, 0) as like_count,
        COALESCE(share_counts.cnt, 0) as share_count,
        COALESCE(comment_counts.cnt, 0) as comment_count
      FROM micro_truths t
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_likes GROUP BY truth_id) like_counts ON like_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_shares GROUP BY truth_id) share_counts ON share_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_comments GROUP BY truth_id) comment_counts ON comment_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'corroborate' GROUP BY truth_id) corr_counts ON corr_counts.truth_id = t.id
      LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'dispute' GROUP BY truth_id) disp_counts ON disp_counts.truth_id = t.id
      WHERE t.category = ${category}
        AND t.created_at > NOW() - INTERVAL '7 days'
      ORDER BY t.created_at DESC
      LIMIT 50
    `) as unknown as any[];
  }

  const truthsForAnalysis: TruthForAnalysis[] = rows.map((r) => ({
    id: r.id,
    content: r.content,
    category: r.category,
    trustScore: r.trust_score ?? 50,
    status: r.status,
    userHash: r.user_hash,
    createdAt: r.created_at,
    corroborationCount: parseInt(r.corroboration_count) || 0,
    disputeCount: parseInt(r.dispute_count) || 0,
    likeCount: parseInt(r.like_count) || 0,
    shareCount: parseInt(r.share_count) || 0,
    commentCount: parseInt(r.comment_count) || 0,
  }));

  const prediction = generatePrediction({
    category,
    neighborhoodId,
    recentTruths: truthsForAnalysis,
  });

  return Response.json(prediction);
}
