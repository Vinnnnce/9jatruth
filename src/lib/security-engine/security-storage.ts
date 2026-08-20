/**
 * Security Storage Layer
 * ============================================================
 * Persistence functions for the AI security system. All functions assume the
 * database has been initialized via ensureDbInitialized() by the calling route.
 * Uses the Neon serverless tagged-template client from @/lib/db directly.
 */

import { getDb } from "@/lib/db";
import type { SecurityVerdict, SecuritySignal, Severity } from "./index";
import type { MemberAccount, Permission } from "./rbac";
import {
  resolvePermissions,
  isSuperAdminEmailCheck,
  ROLES,
} from "./rbac";

type SqlRow = Record<string, any>;

function parseJsonArray(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Security Events ─────────────────────────────────────────

export async function logSecurityEvent(input: {
  eventType: string;
  severity: Severity;
  riskScore: number;
  ipHash?: string | null;
  deviceFingerprint?: string;
  userHash?: string;
  userAgent?: string;
  endpoint?: string;
  actionTaken?: string;
  signals?: SecuritySignal[];
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  const sql = getDb();
  try {
    const rows = (await sql`
      INSERT INTO security_events (
        event_type, severity, risk_score, ip_hash, device_fingerprint,
        user_hash, user_agent, endpoint, action_taken, signals, metadata
      ) VALUES (
        ${input.eventType}, ${input.severity}, ${input.riskScore}, ${input.ipHash ?? null},
        ${input.deviceFingerprint ?? null}, ${input.userHash ?? null},
        ${input.userAgent ?? null}, ${input.endpoint ?? null},
        ${input.actionTaken ?? "log"}, ${JSON.stringify(input.signals ?? [])},
        ${JSON.stringify(input.metadata ?? {})}
      )
      RETURNING id
    `) as unknown as SqlRow[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[SecurityStorage] logSecurityEvent error:", err);
    return null;
  }
}

export async function getSecurityEvents(opts: {
  limit?: number;
  offset?: number;
  severity?: string;
  acknowledged?: boolean;
} = {}): Promise<any[]> {
  const sql = getDb();
  const limit = Math.min(500, opts.limit ?? 50);
  const offset = opts.offset ?? 0;
  const rows = (await sql`
    SELECT * FROM security_events
    ${opts.severity ? sql`WHERE severity = ${opts.severity}` : sql``}
    ${opts.acknowledged !== undefined ? sql`AND acknowledged = ${opts.acknowledged}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as SqlRow[];
  return rows.map((r) => ({
    ...r,
    signals: parseJsonArray(r.signals),
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : r.metadata ?? {},
  }));
}

export async function getSecurityStats(): Promise<{
  totalEvents: number;
  criticalCount: number;
  highCount: number;
  openAlerts: number;
  blockedIps: number;
  recentVerdicts: any[];
  eventsByDay: any[];
}> {
  const sql = getDb();
  try {
    const total = (await sql`SELECT COUNT(*) as c FROM security_events`) as unknown as SqlRow[];
    const critical = (await sql`SELECT COUNT(*) as c FROM security_events WHERE severity = 'critical'`) as unknown as SqlRow[];
    const high = (await sql`SELECT COUNT(*) as c FROM security_events WHERE severity = 'high'`) as unknown as SqlRow[];
    const openAlerts = (await sql`SELECT COUNT(*) as c FROM security_alerts WHERE acknowledged = false`) as unknown as SqlRow[];
    const blocked = (await sql`SELECT COUNT(*) as c FROM mitigation_actions WHERE action = 'block_ip' AND active = true`) as unknown as SqlRow[];
    const recent = (await sql`
      SELECT id, event_type, severity, risk_score, action_taken, created_at
      FROM security_events ORDER BY created_at DESC LIMIT 10
    `) as unknown as SqlRow[];
    const byDay = (await sql`
      SELECT DATE(created_at) as day, COUNT(*) as count, MAX(risk_score) as max_risk
      FROM security_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY day ORDER BY day ASC
    `) as unknown as SqlRow[];

    return {
      totalEvents: Number(total[0]?.c ?? 0),
      criticalCount: Number(critical[0]?.c ?? 0),
      highCount: Number(high[0]?.c ?? 0),
      openAlerts: Number(openAlerts[0]?.c ?? 0),
      blockedIps: Number(blocked[0]?.c ?? 0),
      recentVerdicts: recent,
      eventsByDay: byDay,
    };
  } catch (err) {
    console.error("[SecurityStorage] getSecurityStats error:", err);
    return {
      totalEvents: 0,
      criticalCount: 0,
      highCount: 0,
      openAlerts: 0,
      blockedIps: 0,
      recentVerdicts: [],
      eventsByDay: [],
    };
  }
}

export async function acknowledgeSecurityEvent(
  eventId: number,
  acknowledgedBy: string
): Promise<boolean> {
  const sql = getDb();
  try {
    await sql`
      UPDATE security_events
      SET acknowledged = true, acknowledged_by = ${acknowledgedBy}, acknowledged_at = NOW()
      WHERE id = ${eventId}
    `;
    return true;
  } catch (err) {
    console.error("[SecurityStorage] acknowledgeSecurityEvent error:", err);
    return false;
  }
}

// ─── Device Fingerprints ─────────────────────────────────────

export async function upsertDeviceFingerprint(input: {
  fingerprint: string;
  ipHash?: string | null;
  userAgent?: string;
  platform?: string;
  isBot?: boolean;
  botReason?: string;
}): Promise<void> {
  const sql = getDb();
  try {
    await sql`
      INSERT INTO device_fingerprints (
        fingerprint, ip_hash, user_agent, platform, is_bot, bot_reason, request_count, last_seen
      ) VALUES (
        ${input.fingerprint}, ${input.ipHash ?? null}, ${input.userAgent ?? null},
        ${input.platform ?? null}, ${input.isBot ?? false}, ${input.botReason ?? null}, 1, NOW()
      )
      ON CONFLICT (fingerprint)
      DO UPDATE SET
        request_count = device_fingerprints.request_count + 1,
        last_seen = NOW(),
        is_bot = COALESCE(${input.isBot ?? null}, device_fingerprints.is_bot),
        bot_reason = COALESCE(${input.botReason ?? null}, device_fingerprints.bot_reason),
        ip_hash = COALESCE(${input.ipHash ?? null}, device_fingerprints.ip_hash)
    `;
  } catch (err) {
    console.error("[SecurityStorage] upsertDeviceFingerprint error:", err);
  }
}

export async function getDevices(limit = 100): Promise<any[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM device_fingerprints
    ORDER BY last_seen DESC LIMIT ${Math.min(500, limit)}
  `) as unknown as SqlRow[];
  return rows;
}

// ─── Member Management (RBAC) ────────────────────────────────

function mapMember(r: SqlRow): MemberAccount {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    clerkUserId: r.clerk_user_id ?? null,
    roleIds: parseJsonArray(r.role_ids),
    active: Boolean(r.active),
    twoFactorEnabled: Boolean(r.two_factor_enabled),
    twoFactorSecret: r.two_factor_secret ?? null,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at ?? null,
  };
}

export async function listMembers(): Promise<MemberAccount[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM security_members ORDER BY created_at ASC
  `) as unknown as SqlRow[];
  return rows.map(mapMember);
}

export async function getMemberByEmail(email: string): Promise<MemberAccount | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM security_members WHERE email = ${email.toLowerCase().trim()}
  `) as unknown as SqlRow[];
  return rows[0] ? mapMember(rows[0]) : null;
}

export async function getMemberByClerkId(clerkUserId: string): Promise<MemberAccount | null> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM security_members WHERE clerk_user_id = ${clerkUserId}
  `) as unknown as SqlRow[];
  return rows[0] ? mapMember(rows[0]) : null;
}

export async function createMember(input: {
  email: string;
  displayName: string;
  clerkUserId?: string;
  roleIds: string[];
}): Promise<MemberAccount> {
  const sql = getDb();
  const rows = (await sql`
    INSERT INTO security_members (email, display_name, clerk_user_id, role_ids)
    VALUES (${input.email.toLowerCase().trim()}, ${input.displayName}, ${input.clerkUserId ?? null}, ${JSON.stringify(input.roleIds)})
    RETURNING *
  `) as unknown as SqlRow[];
  return mapMember(rows[0]);
}

export async function updateMemberRoles(
  memberId: number,
  roleIds: string[]
): Promise<boolean> {
  const sql = getDb();
  try {
    await sql`
      UPDATE security_members SET role_ids = ${JSON.stringify(roleIds)}, updated_at = NOW()
      WHERE id = ${memberId}
    `;
    return true;
  } catch (err) {
    console.error("[SecurityStorage] updateMemberRoles error:", err);
    return false;
  }
}

export async function setMemberActive(memberId: number, active: boolean): Promise<boolean> {
  const sql = getDb();
  try {
    await sql`UPDATE security_members SET active = ${active}, updated_at = NOW() WHERE id = ${memberId}`;
    return true;
  } catch (err) {
    console.error("[SecurityStorage] setMemberActive error:", err);
    return false;
  }
}

export async function upsertMemberFromClerk(input: {
  email: string;
  clerkUserId: string;
  displayName: string;
}): Promise<MemberAccount> {
  const existing = await getMemberByEmail(input.email);
  if (existing) {
    const sql = getDb();
    await sql`
      UPDATE security_members
      SET clerk_user_id = ${input.clerkUserId}, last_active_at = NOW(), updated_at = NOW()
      WHERE id = ${existing.id}
    `;
    return { ...existing, clerkUserId: input.clerkUserId };
  }
  // New Clerk user — create as an inactive security_analyst pending role assignment.
  return createMember({
    email: input.email,
    displayName: input.displayName,
    clerkUserId: input.clerkUserId,
    roleIds: ["security_analyst"],
  });
}

/**
 * Resolve the effective permissions for the current request user.
 * Super admin email ⇒ all permissions. Otherwise, look up the member's roles.
 */
export async function resolveMemberPermissions(opts: {
  email?: string | null;
  clerkUserId?: string | null;
}): Promise<{ permissions: Permission[]; member: MemberAccount | null }> {
  if (opts.email && isSuperAdminEmailCheck(opts.email)) {
    return { permissions: ROLES.find((r) => r.id === "super_admin")!.permissions, member: null };
  }
  let member: MemberAccount | null = null;
  if (opts.clerkUserId) {
    member = await getMemberByClerkId(opts.clerkUserId);
  }
  if (!member && opts.email) {
    member = await getMemberByEmail(opts.email);
  }
  if (!member || !member.active) {
    return { permissions: [], member: null };
  }
  return { permissions: resolvePermissions(member.roleIds), member };
}

// ─── Content Verification ────────────────────────────────────

export async function logContentVerification(input: {
  contentType: string;
  referenceId?: number;
  sourceUrl?: string;
  textContent?: string;
  mediaUrl?: string;
  authenticityScore: number;
  riskScore: number;
  verdict: string;
  signals: string[];
}): Promise<number | null> {
  const sql = getDb();
  try {
    const rows = (await sql`
      INSERT INTO content_verifications (
        content_type, reference_id, source_url, text_content, media_url,
        authenticity_score, risk_score, verdict, signals
      ) VALUES (
        ${input.contentType}, ${input.referenceId ?? null}, ${input.sourceUrl ?? null},
        ${input.textContent ?? null}, ${input.mediaUrl ?? null},
        ${input.authenticityScore}, ${input.riskScore}, ${input.verdict},
        ${JSON.stringify(input.signals)}
      )
      RETURNING id
    `) as unknown as SqlRow[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[SecurityStorage] logContentVerification error:", err);
    return null;
  }
}

export async function getContentVerifications(limit = 50): Promise<any[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM content_verifications
    ORDER BY created_at DESC LIMIT ${Math.min(500, limit)}
  `) as unknown as SqlRow[];
  return rows.map((r) => ({ ...r, signals: parseJsonArray(r.signals) }));
}

export async function reviewContentVerification(
  id: number,
  verdict: string,
  reviewedBy: string
): Promise<boolean> {
  const sql = getDb();
  try {
    await sql`
      UPDATE content_verifications
      SET verdict = ${verdict}, reviewed_by = ${reviewedBy}, reviewed_at = NOW()
      WHERE id = ${id}
    `;
    return true;
  } catch (err) {
    console.error("[SecurityStorage] reviewContentVerification error:", err);
    return false;
  }
}

// ─── Fraud Signals ────────────────────────────────────────────

export async function logFraudSignal(input: {
  fraudType: string;
  userHash?: string;
  ipHash?: string;
  riskScore: number;
  signals: string[];
}): Promise<number | null> {
  const sql = getDb();
  try {
    const rows = (await sql`
      INSERT INTO fraud_signals (fraud_type, user_hash, ip_hash, risk_score, signals)
      VALUES (${input.fraudType}, ${input.userHash ?? null}, ${input.ipHash ?? null},
              ${input.riskScore}, ${JSON.stringify(input.signals)})
      RETURNING id
    `) as unknown as SqlRow[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[SecurityStorage] logFraudSignal error:", err);
    return null;
  }
}

export async function getFraudSignals(limit = 50): Promise<any[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM fraud_signals ORDER BY created_at DESC LIMIT ${Math.min(500, limit)}
  `) as unknown as SqlRow[];
  return rows.map((r) => ({ ...r, signals: parseJsonArray(r.signals) }));
}

export async function mitigateFraudSignal(
  id: number,
  mitigatedBy: string,
  status = "mitigated"
): Promise<boolean> {
  const sql = getDb();
  try {
    await sql`
      UPDATE fraud_signals
      SET status = ${status}, mitigated_by = ${mitigatedBy}, mitigated_at = NOW()
      WHERE id = ${id}
    `;
    return true;
  } catch (err) {
    console.error("[SecurityStorage] mitigateFraudSignal error:", err);
    return false;
  }
}

// ─── Mitigation Actions ───────────────────────────────────────

export async function createMitigationAction(input: {
  targetType: string;
  targetValue: string;
  action: string;
  reason?: string;
  durationMinutes?: number;
  createdBy: string;
}): Promise<number | null> {
  const sql = getDb();
  const expiresAt = input.durationMinutes
    ? new Date(Date.now() + input.durationMinutes * 60_000).toISOString()
    : null;
  try {
    const rows = (await sql`
      INSERT INTO mitigation_actions (target_type, target_value, action, reason, duration_minutes, expires_at, created_by)
      VALUES (${input.targetType}, ${input.targetValue}, ${input.action}, ${input.reason ?? null},
              ${input.durationMinutes ?? null}, ${expiresAt}, ${input.createdBy})
      RETURNING id
    `) as unknown as SqlRow[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[SecurityStorage] createMitigationAction error:", err);
    return null;
  }
}

export async function isBlocked(targetValue: string, action = "block_ip"): Promise<boolean> {
  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT id FROM mitigation_actions
      WHERE target_value = ${targetValue} AND action = ${action}
        AND active = true AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `) as unknown as SqlRow[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function listMitigationActions(limit = 50): Promise<any[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM mitigation_actions ORDER BY created_at DESC LIMIT ${Math.min(500, limit)}
  `) as unknown as SqlRow[];
  return rows;
}

// ─── Alerts ───────────────────────────────────────────────────

export async function createSecurityAlert(input: {
  severity: Severity;
  title: string;
  message: string;
  eventId?: number;
}): Promise<number | null> {
  const sql = getDb();
  try {
    const rows = (await sql`
      INSERT INTO security_alerts (severity, title, message, event_id)
      VALUES (${input.severity}, ${input.title}, ${input.message}, ${input.eventId ?? null})
      RETURNING id
    `) as unknown as SqlRow[];
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[SecurityStorage] createSecurityAlert error:", err);
    return null;
  }
}

export async function listAlerts(limit = 50): Promise<any[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT * FROM security_alerts WHERE acknowledged = false
    ORDER BY created_at DESC LIMIT ${Math.min(500, limit)}
  `) as unknown as SqlRow[];
  return rows;
}

// ─── Request Telemetry (behavioral baseline) ──────────────────

export async function recordTelemetry(identityHash: string, endpoint: string): Promise<void> {
  const sql = getDb();
  try {
    await sql`
      INSERT INTO request_telemetry (identity_hash, endpoint, timestamp)
      VALUES (${identityHash}, ${endpoint}, ${Date.now()})
    `;
    // Prune telemetry older than 24h to bound table growth.
    await sql`DELETE FROM request_telemetry WHERE timestamp < ${Date.now() - 24 * 60 * 60 * 1000}`;
  } catch (err) {
    console.error("[SecurityStorage] recordTelemetry error:", err);
  }
}

export async function getRecentTelemetry(identityHash: string, limit = 50): Promise<number[]> {
  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT timestamp FROM request_telemetry
      WHERE identity_hash = ${identityHash}
      ORDER BY timestamp DESC LIMIT ${Math.min(200, limit)}
    `) as unknown as SqlRow[];
    return rows.map((r) => Number(r.timestamp)).reverse();
  } catch {
    return [];
  }
}

export async function persistVerdict(
  verdict: SecurityVerdict,
  ctx: { eventType: string; endpoint?: string; userHash?: string; userAgent?: string }
): Promise<void> {
  await logSecurityEvent({
    eventType: ctx.eventType,
    severity: verdict.severity,
    riskScore: verdict.riskScore,
    ipHash: verdict.ipHash,
    deviceFingerprint: verdict.deviceFingerprint,
    userHash: ctx.userHash,
    userAgent: ctx.userAgent,
    endpoint: ctx.endpoint,
    actionTaken: verdict.action,
    signals: verdict.signals,
  });

  if (verdict.deviceFingerprint) {
    await upsertDeviceFingerprint({
      fingerprint: verdict.deviceFingerprint,
      ipHash: verdict.ipHash,
    });
  }

  // High-severity verdicts auto-create alerts for the monitoring pipeline.
  if (verdict.severity === "critical" || verdict.severity === "high") {
    const eventId = await logSecurityEvent({
      eventType: `${ctx.eventType}_alert`,
      severity: verdict.severity,
      riskScore: verdict.riskScore,
      ipHash: verdict.ipHash,
      deviceFingerprint: verdict.deviceFingerprint,
      endpoint: ctx.endpoint,
      actionTaken: "alert",
      signals: verdict.signals,
    });
    await createSecurityAlert({
      severity: verdict.severity,
      title: `${verdict.severity.toUpperCase()} threat detected`,
      message: `${ctx.eventType} from ${verdict.ipHash ?? "unknown"} — risk ${verdict.riskScore}. Action: ${verdict.action}.`,
      eventId: eventId ?? undefined,
    });
  }
}
