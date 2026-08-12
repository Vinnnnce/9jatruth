import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
  getUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const redeemSchema = z.object({
  action: z.enum(["redeem"]).default("redeem"),
  purchaseAmount: z.number().int().min(0).max(1000000).optional(),
});

/**
 * GET /api/rewards/vouchers/[id] — get voucher detail
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

  const sql = getDb();
  const rows = (await sql`SELECT * FROM store_vouchers WHERE id = ${parsed.data.id}`) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Voucher not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    code: r.code,
    storeName: r.store_name,
    storeType: r.store_type,
    description: r.description,
    discountType: r.discount_type,
    discountValue: r.discount_value,
    minPurchase: r.min_purchase,
    maxDiscount: r.max_discount,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    status: r.status,
    partnerBusiness: r.partner_business,
    createdAt: r.created_at,
  });
}

/**
 * PUT /api/rewards/vouchers/[id] — redeem voucher
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

  const { id } = await params;
  const parsedId = validate(idParamSchema, { id });
  if (!parsedId.success) return validationErrorResponse(parsedId.error);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body optional
  }

  const parsed = validate(redeemSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userHash = await getUserId(request);
  const sql = getDb();

  // Lock the voucher row
  const rows = (await sql`SELECT * FROM store_vouchers WHERE id = ${parsedId.data.id} FOR UPDATE`) as unknown as any[];
  if (rows.length === 0) {
    return Response.json({ message: "Voucher not found" }, { status: 404 });
  }

  const voucher = rows[0];
  if (voucher.status !== "active") {
    return Response.json({ message: "Voucher is not active" }, { status: 400 });
  }
  if (new Date(voucher.valid_until) < new Date()) {
    return Response.json({ message: "Voucher has expired" }, { status: 400 });
  }
  if (parsed.data.purchaseAmount !== undefined && parsed.data.purchaseAmount < voucher.min_purchase) {
    return Response.json(
      { message: `Minimum purchase of ${voucher.min_purchase} required` },
      { status: 400 }
    );
  }

  // Calculate discount
  let discount = voucher.discount_value;
  if (voucher.discount_type === "percentage" && parsed.data.purchaseAmount !== undefined) {
    discount = Math.floor((parsed.data.purchaseAmount * voucher.discount_value) / 100);
    if (voucher.max_discount && discount > voucher.max_discount) {
      discount = voucher.max_discount;
    }
  }

  // Mark as used
  await sql`
    UPDATE store_vouchers
    SET status = 'used', used_by = ${userHash}, used_at = NOW()
    WHERE id = ${parsedId.data.id}
  `;

  // Credit reward balance with discount value
  if (discount > 0) {
    await sql`
      UPDATE device_profiles
      SET rewards_balance = rewards_balance + ${discount}
      WHERE device_id_hash = ${userHash}
    `;
    await sql`
      INSERT INTO device_profiles (device_id_hash, trust_score, total_submissions, rewards_balance)
      VALUES (${userHash}, 50, 0, ${discount})
      ON CONFLICT (device_id_hash) DO NOTHING
    `;
    await sql`
      INSERT INTO reward_ledger (user_hash, amount, type, description)
      VALUES (${userHash}, ${discount}, 'voucher_redeem', ${'Redeemed ' + voucher.store_name + ' voucher ' + voucher.code})
    `;
  }

  return Response.json({
    success: true,
    voucherId: parsedId.data.id,
    code: voucher.code,
    storeName: voucher.store_name,
    discountType: voucher.discount_type,
    discountValue: voucher.discount_value,
    discountApplied: discount,
  });
}
