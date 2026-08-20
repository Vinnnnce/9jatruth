/**
 * GET /api/security/alerts — Cron-triggered monitoring + alerting sweep.
 * Protected by CRON_SECRET. Scans for unacknowledged high/critical events,
 * creates alerts, and (optionally) emits notifications.
 *
 * Vercel cron schedule: every 15 minutes (see vercel.json).
 */
import { ensureDbInitialized, getDb } from "@/lib/db";
import { createSecurityAlert, listAlerts } from "@/lib/security-engine/security-storage";

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  await ensureDbInitialized();
  const sql = getDb();

  // Find high/critical events from the last 15 min that have no alert yet.
  const unreported = (await sql`
    SELECT se.id, se.event_type, se.severity, se.risk_score, se.ip_hash
    FROM security_events se
    LEFT JOIN security_alerts sa ON sa.event_id = se.id
    WHERE se.severity IN ('high', 'critical')
      AND se.created_at > NOW() - INTERVAL '15 minutes'
      AND sa.id IS NULL
    ORDER BY se.created_at DESC
    LIMIT 50
  `) as unknown as Array<Record<string, any>>;

  let created = 0;
  for (const ev of unreported) {
    const alertId = await createSecurityAlert({
      severity: ev.severity,
      title: `${ev.severity.toUpperCase()} ${ev.event_type}`,
      message: `Risk ${ev.risk_score} from ${ev.ip_hash ?? "unknown"} (event #${ev.id}).`,
      eventId: ev.id,
    });
    if (alertId) created++;
  }

  const openAlerts = await listAlerts(20);

  return Response.json({
    scanned: unreported.length,
    alertsCreated: created,
    openAlerts,
  });
}
