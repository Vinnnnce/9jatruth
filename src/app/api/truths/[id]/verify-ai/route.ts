import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId } from "@/lib/api-helpers";
import { verifyTruth, type TruthForAnalysis } from "@/lib/ai-verification";

/**
 * POST /api/truths/[id]/verify-ai
 * Runs AI verification on a truth report and returns the analysis.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) {
    return Response.json({ message: "Invalid truth ID" }, { status: 400 });
  }

  const sql = getDb();

  // Fetch the truth with org info and engagement counts
  const rows = (await sql`
    SELECT t.*,
      o.name as org_name,
      o.verified as org_verified,
      COALESCE(like_counts.cnt, 0) as like_count,
      COALESCE(share_counts.cnt, 0) as share_count,
      COALESCE(comment_counts.cnt, 0) as comment_count,
      COALESCE(corr_counts.cnt, 0) as corroboration_count,
      COALESCE(disp_counts.cnt, 0) as dispute_count,
      COALESCE(author_stats.total_reports, 0) as author_total_reports,
      COALESCE(author_stats.trust_score, 50) as author_trust_score
    FROM micro_truths t
    LEFT JOIN organizations o ON t.organization_id = o.id
    LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_likes GROUP BY truth_id) like_counts ON like_counts.truth_id = t.id
    LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_shares GROUP BY truth_id) share_counts ON share_counts.truth_id = t.id
    LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_comments GROUP BY truth_id) comment_counts ON comment_counts.truth_id = t.id
    LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'corroborate' GROUP BY truth_id) corr_counts ON corr_counts.truth_id = t.id
    LEFT JOIN (SELECT truth_id, COUNT(*) as cnt FROM truth_verifications WHERE action = 'dispute' GROUP BY truth_id) disp_counts ON disp_counts.truth_id = t.id
    LEFT JOIN (
      SELECT device_hash,
        COUNT(*) as total_reports,
        AVG(trust_score) as trust_score
      FROM micro_truths
      GROUP BY device_hash
    ) author_stats ON author_stats.device_hash = t.user_hash
    WHERE t.id = ${truthId}
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Truth not found" }, { status: 404 });
  }

  const r = rows[0];

  const truthForAnalysis: TruthForAnalysis = {
    id: r.id,
    content: r.content,
    category: r.category,
    trustScore: r.trust_score ?? 50,
    status: r.status,
    userHash: r.user_hash,
    createdAt: r.created_at,
    neighborhoodId: r.neighborhood_id,
    corroborationCount: parseInt(r.corroboration_count) || 0,
    disputeCount: parseInt(r.dispute_count) || 0,
    likeCount: parseInt(r.like_count) || 0,
    shareCount: parseInt(r.share_count) || 0,
    commentCount: parseInt(r.comment_count) || 0,
    authorTrustScore: parseFloat(r.author_trust_score) || 50,
    authorTotalReports: parseInt(r.author_total_reports) || 0,
  };

  const result = await verifyTruth(truthForAnalysis);

  // Store the verification result
  try {
    await sql`
      INSERT INTO ai_verifications (truth_id, verdict, confidence, score, explanation, signals, verified_at)
      VALUES (${result.truthId}, ${result.verdict}, ${result.confidence}, ${result.score}, ${result.explanation}, ${JSON.stringify(result.signals)}::jsonb, ${result.verifiedAt})
      ON CONFLICT (truth_id) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        confidence = EXCLUDED.confidence,
        score = EXCLUDED.score,
        explanation = EXCLUDED.explanation,
        signals = EXCLUDED.signals,
        verified_at = EXCLUDED.verified_at
    `;
  } catch {
    // Table might not exist yet — non-fatal, still return the result
  }

  return Response.json(result);
}
