import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/politics/abuse-signals
 * Super-admin security dashboard for politics + general platform abuse.
 *
 * Detects:
 *  - Brigading / mass downvotes: a truth hit by a spike of `dispute` actions
 *    in the last hour relative to its lifetime average.
 *  - Coordinated attacks: many dispute actions from the same user_hash or IP
 *    cluster in a short window.
 *  - Fake-news / suspicious-report signals (written by the AI fact-checker).
 *
 * Returns: recent abuse_signals + live-detected patterns + summary counts.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const sql = getDb();

  // 1. Recent stored signals (AI + manual).
  const recentSignals = (await sql`
    SELECT id, signal_type, entity_type, entity_id, severity, details, detected_by, resolved, created_at
    FROM political_abuse_signals
    ORDER BY resolved ASC, created_at DESC
    LIMIT 100
  `) as unknown as any[];

  // 2. Brigading: truths with a dispute spike in the last 1h vs lifetime.
  const brigading = (await sql`
    WITH recent AS (
      SELECT truth_id, COUNT(*) AS recent_disputes
      FROM verifications
      WHERE action = 'dispute' AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY truth_id
    ), lifetime AS (
      SELECT truth_id, COUNT(*) AS total_disputes
      FROM verifications
      WHERE action = 'dispute'
      GROUP BY truth_id
    )
    SELECT t.id AS truth_id, LEFT(t.content, 120) AS content,
           r.recent_disputes, COALESCE(l.total_disputes, 0) AS total_disputes,
           t.trust_score
    FROM recent r
    JOIN lifetime l ON l.truth_id = r.truth_id
    JOIN micro_truths t ON t.id = r.truth_id
    WHERE r.recent_disputes >= 5 AND r.recent_disputes >= (l.total_disputes * 0.3)
    ORDER BY r.recent_disputes DESC
    LIMIT 20
  `) as unknown as any[];

  // 3. Coordinated attacks: users/IPs firing many disputes quickly.
  const coordinated = (await sql`
    SELECT user_hash, COUNT(*) AS dispute_count,
           COUNT(DISTINCT truth_id) AS distinct_targets,
           MIN(created_at) AS window_start, MAX(created_at) AS window_end
    FROM verifications
    WHERE action = 'dispute' AND created_at > NOW() - INTERVAL '1 hour'
    GROUP BY user_hash
    HAVING COUNT(*) >= 4 AND COUNT(DISTINCT truth_id) >= 2
    ORDER BY dispute_count DESC
    LIMIT 20
  `) as unknown as any[];

  // 4. Mass-reported truths (truth_reports).
  const massReported = (await sql`
    SELECT truth_id, COUNT(*) AS report_count, array_agg(DISTINCT reason) AS reasons
    FROM truth_reports
    WHERE status = 'pending' AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY truth_id
    HAVING COUNT(*) >= 3
    ORDER BY report_count DESC
    LIMIT 20
  `) as unknown as any[];

  // Persist newly-detected brigading/coordinated patterns as signals — but
  // only when no unresolved signal of the same type+entity already exists,
  // so polling doesn't create duplicates.
  const existingUnresolved = new Set(
    recentSignals.filter((s) => !s.resolved).map((s) => `${s.signal_type}:${s.entity_type}:${s.entity_id}`)
  );
  for (const b of brigading) {
    const key = `brigading:truth:${b.truth_id}`;
    if (existingUnresolved.has(key)) continue;
    await sql`INSERT INTO political_abuse_signals (signal_type, entity_type, entity_id, severity, details, detected_by)
      VALUES ('brigading', 'truth', ${String(b.truth_id)}, ${b.recent_disputes >= 10 ? "high" : "medium"},
        ${JSON.stringify({ recent_disputes: b.recent_disputes, total_disputes: b.total_disputes, trust_score: b.trust_score, content_preview: b.content })}::jsonb, 'system-detector')`;
    existingUnresolved.add(key);
  }
  for (const c of coordinated) {
    const key = `coordinated_downvote:user:${c.user_hash}`;
    if (existingUnresolved.has(key)) continue;
    await sql`INSERT INTO political_abuse_signals (signal_type, entity_type, entity_id, severity, details, detected_by)
      VALUES ('coordinated_downvote', 'user', ${c.user_hash}, ${c.dispute_count >= 8 ? "high" : "medium"},
        ${JSON.stringify({ dispute_count: c.dispute_count, distinct_targets: c.distinct_targets, window_start: c.window_start, window_end: c.window_end })}::jsonb, 'system-detector')`;
    existingUnresolved.add(key);
  }

  const unresolved = recentSignals.filter((s) => !s.resolved).length;
  const highSeverity = recentSignals.filter((s) => s.severity === "high" && !s.resolved).length;

  return Response.json({
    summary: { unresolved, highSeverity, total: recentSignals.length },
    signals: recentSignals,
    detected: {
      brigading,
      coordinated,
      massReported,
    },
  });
}
