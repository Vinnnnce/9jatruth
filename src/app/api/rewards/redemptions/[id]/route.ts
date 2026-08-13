import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
  getUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const approveSchema = z.object({
  status: z.enum(["approved", "denied", "fulfilled", "pending"]),
  adminNotes: z.string().max(1000).optional(),
});

/**
 * GET /api/rewards/redemptions/[id] — single redemption detail
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userHash = await getUserId(request);
  const sql = getDb();

  // User can view their own redemption; admin can view any
  const isAdmin = await isSuperAdmin();
  const rows = isAdmin
    ? ((await sql`SELECT * FROM reward_redemptions WHERE id = ${parsed.data.id}`) as unknown as any[])
    : ((await sql`SELECT * FROM reward_redemptions WHERE id = ${parsed.data.id} AND user_hash = ${userHash}`) as unknown as any[]);

  if (rows.length === 0) {
    return Response.json({ message: "Redemption not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    userHash: r.user_hash,
    rewardType: r.reward_type,
    rewardCategory: r.reward_category,
    amount: r.amount,
    status: r.status,
    description: r.description,
    recipientPhone: r.recipient_phone,
    recipientName: r.recipient_name,
    networkProvider: r.network_provider,
    giftCardCode: r.gift_card_code,
    voucherCode: r.voucher_code,
    voucherStoreName: r.voucher_store_name,
    adminNotes: r.admin_notes,
    processedBy: r.processed_by,
    processedAt: r.processed_at,
    createdAt: r.created_at,
  });
}

/**
 * PUT /api/rewards/redemptions/[id] — admin approve/deny redemption
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

  const parsed = validate(approveSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();

  // If denying, refund the reward balance
  if (parsed.data.status === "denied") {
    const redemption = (await sql`
      SELECT user_hash, amount FROM reward_redemptions WHERE id = ${parsedId.data.id}
    `) as unknown as any[];
    if (redemption.length === 0) {
      return Response.json({ message: "Redemption not found" }, { status: 404 });
    }
    // Refund
    await sql`
      UPDATE device_profiles SET rewards_balance = rewards_balance + ${redemption[0].amount}
      WHERE device_id_hash = ${redemption[0].user_hash}
    `;
    await sql`
      INSERT INTO reward_ledger (user_hash, amount, type, description)
      VALUES (${redemption[0].user_hash}, ${redemption[0].amount}, 'refund', ${'Refund for denied redemption #' + parsedId.data.id})
    `;
  }

  const rows = (await sql`
    UPDATE reward_redemptions
    SET status = ${parsed.data.status},
        admin_notes = ${parsed.data.adminNotes || null},
        processed_by = ${clerkUserId},
        processed_at = NOW()
    WHERE id = ${parsedId.data.id}
    RETURNING *
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Redemption not found" }, { status: 404 });
  }

  // Audit log
  try {
    await sql`
      INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, entity_type, entity_id, description, new_values)
      VALUES (${clerkUserId}, 'admin', 'super_admin', 'update_redemption',
              'reward_redemption', ${parsedId.data.id},
              ${'Redemption ' + parsed.data.status},
              ${JSON.stringify({ status: parsed.data.status, adminNotes: parsed.data.adminNotes })})
    `;
  } catch (err) {
    console.error("[redemptions/PUT] Audit log error:", err);
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
