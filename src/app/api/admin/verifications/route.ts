import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { getClerkUserId } from "@/lib/api-helpers";

/**
 * Verification requests & verification badges.
 *
 * GET   /api/admin/verifications?status=&type=   → list requests
 * POST  /api/admin/verifications                  → create a request (business/org/user/news)
 * PATCH /api/admin/verifications?id=&status=      → approve / reject, applies badge to entity
 *
 * Entity types: business | organization | user | news
 */

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const sql = getDb();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  let rows: any[];
  if (status && status !== "all") {
    rows = (await sql`SELECT * FROM verification_requests
      WHERE status = ${status}
      ORDER BY created_at DESC LIMIT 200`) as unknown as any[];
  } else if (type && type !== "all") {
    rows = (await sql`SELECT * FROM verification_requests
      WHERE entity_type = ${type}
      ORDER BY created_at DESC LIMIT 200`) as unknown as any[];
  } else {
    rows = (await sql`SELECT * FROM verification_requests
      ORDER BY created_at DESC LIMIT 200`) as unknown as any[];
  }

  const pending = (await sql`SELECT COUNT(*)::int as count FROM verification_requests WHERE status = 'pending'`) as unknown as any[];

  return Response.json({
    requests: rows,
    stats: { total: rows.length, pending: pending?.[0]?.count ?? 0 },
  });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const entityType = String(body.entityType || "").trim();
  const entityId = String(body.entityId || "").trim();
  const entityName = String(body.entityName || "").trim();

  if (!["business", "organization", "user", "news"].includes(entityType)) {
    return Response.json({ message: "Invalid entityType" }, { status: 400 });
  }
  if (!entityId || !entityName) {
    return Response.json({ message: "entityId and entityName are required" }, { status: 400 });
  }

  const requestedBy = (await getClerkUserId()) ?? null;
  const sql = getDb();

  const rows = (await sql`
    INSERT INTO verification_requests (
      entity_type, entity_id, entity_name, requested_by, contact_email,
      reason, evidence_url, status, badge_type
    ) VALUES (
      ${entityType}, ${entityId}, ${entityName}, ${requestedBy},
      ${body.contactEmail ?? null}, ${body.reason ?? null},
      ${body.evidenceUrl ?? null}, 'pending', ${body.badgeType || 'verified'}
    )
    RETURNING *
  `) as unknown as any[];

  return Response.json({ success: true, request: rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return Response.json({ message: "Valid id is required" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const status = String(body.status || "").trim();
  if (!["approved", "rejected", "pending"].includes(status)) {
    return Response.json({ message: "status must be approved, rejected, or pending" }, { status: 400 });
  }

  const reviewedBy = (await getClerkUserId()) ?? "super-admin";
  const sql = getDb();

  const req = (await sql`SELECT * FROM verification_requests WHERE id = ${id} LIMIT 1`) as unknown as any[];
  if (!req || req.length === 0) {
    return Response.json({ message: "Verification request not found" }, { status: 404 });
  }
  const vr = req[0];

  await sql`
    UPDATE verification_requests
    SET status = ${status}, reviewed_by = ${reviewedBy}, reviewed_at = NOW(),
        admin_notes = ${body.adminNotes ?? null}, updated_at = NOW()
    WHERE id = ${id}
  `;

  // When approved, apply the verification badge to the underlying entity.
  if (status === "approved") {
    try {
      if (vr.entity_type === "organization") {
        await sql`UPDATE organizations SET verified = 1, verification_badge = ${vr.badge_type || 'verified'} WHERE id = ${Number(vr.entity_id)}`;
      } else if (vr.entity_type === "user") {
        await sql`UPDATE platform_users SET is_verified = TRUE, verification_badge = ${vr.badge_type || 'verified'} WHERE id = ${Number(vr.entity_id)}`;
      } else if (vr.entity_type === "news") {
        await sql`UPDATE news_articles SET is_verified = TRUE, verification_badge = ${vr.badge_type || 'verified'} WHERE id = ${Number(vr.entity_id)}`;
      }
      // 'business' entities are modeled as organizations; nothing else to update.
    } catch (applyErr) {
      console.error("[verifications] badge apply error (non-fatal):", applyErr);
    }
  } else if (status === "rejected") {
    try {
      if (vr.entity_type === "organization") {
        await sql`UPDATE organizations SET verification_badge = NULL WHERE id = ${Number(vr.entity_id)}`;
      } else if (vr.entity_type === "user") {
        await sql`UPDATE platform_users SET verification_badge = NULL WHERE id = ${Number(vr.entity_id)}`;
      }
    } catch {
      // non-fatal
    }
  }

  const updated = (await sql`SELECT * FROM verification_requests WHERE id = ${id} LIMIT 1`) as unknown as any[];
  return Response.json({ success: true, request: updated[0] });
}
