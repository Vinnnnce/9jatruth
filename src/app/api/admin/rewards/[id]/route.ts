import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const fulfillSchema = z.object({
  status: z.enum(["approved", "denied", "fulfilled", "pending"]),
  adminNotes: z.string().max(1000).optional(),
  fulfillmentRef: z.string().max(200).optional(),
});

/**
 * PUT /api/admin/rewards/[id] — approve/deny/fulfill redemption with audit log
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = validate(idParamSchema, { id });
  if (!parsedId.success) return validationErrorResponse(parsedId.error);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(fulfillSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();

  // Fetch redemption for audit old values
  const existing = (await sql`
    SELECT * FROM reward_redemptions WHERE id = ${parsedId.data.id}
  `) as unknown as any[];

  if (existing.length === 0) {
    return Response.json({ message: "Redemption not found" }, { status: 404 });
  }

  const oldValues = existing[0];

  // If denying, refund reward balance
  if (parsed.data.status === "denied" && oldValues.status !== "denied") {
    await sql`
      UPDATE device_profiles SET rewards_balance = rewards_balance + ${oldValues.amount}
      WHERE device_id_hash = ${oldValues.user_hash}
    `;
    await sql`
      INSERT INTO reward_ledger (user_hash, amount, type, description)
      VALUES (${oldValues.user_hash}, ${oldValues.amount}, 'refund', ${'Refund for denied redemption #' + parsedId.data.id})
    `;
  }

  // Update redemption
  const rows = (await sql`
    UPDATE reward_redemptions
    SET status = ${parsed.data.status},
        admin_notes = ${parsed.data.adminNotes || null},
        processed_by = ${clerkUserId},
        processed_at = NOW()
    WHERE id = ${parsedId.data.id}
    RETURNING *
  `) as unknown as any[];

  // Create audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, old_values, new_values)
      VALUES (
        ${clerkUserId}, 'admin', 'super_admin',
        ${'fulfill_redemption'},
        'reward_redemption', ${parsedId.data.id},
        ${'Redemption ' + parsed.data.status + ': ' + oldValues.description},
        ${JSON.stringify({ status: oldValues.status, amount: oldValues.amount, rewardType: oldValues.reward_type })},
        ${JSON.stringify({ status: parsed.data.status, adminNotes: parsed.data.adminNotes, fulfillmentRef: parsed.data.fulfillmentRef })}
      )
    `;
  } catch (err) {
    console.error("[admin/rewards/PUT] Audit log error:", err);
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    status: r.status,
    adminNotes: r.admin_notes,
    processedBy: r.processed_by,
    processedAt: r.processed_at,
  });
}
