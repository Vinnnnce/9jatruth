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
});

/**
 * GET /api/rewards/gift-cards/[id] — get gift card detail
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
  const rows = (await sql`SELECT * FROM gift_cards WHERE id = ${parsed.data.id}`) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Gift card not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
    id: r.id,
    code: r.code,
    type: r.type,
    brand: r.brand,
    faceValue: r.face_value,
    balance: r.balance,
    currency: r.currency,
    expiryDate: r.expiry_date,
    status: r.status,
    redeemedBy: r.redeemed_by,
    redeemedAt: r.redeemed_at,
    createdAt: r.created_at,
  });
}

/**
 * PUT /api/rewards/gift-cards/[id] — redeem gift card
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

  const userHash = await getUserId(request);
  const sql = getDb();

  // Check gift card is valid
  const rows = (await sql`SELECT * FROM gift_cards WHERE id = ${parsedId.data.id} FOR UPDATE`) as unknown as any[];
  if (rows.length === 0) {
    return Response.json({ message: "Gift card not found" }, { status: 404 });
  }

  const card = rows[0];
  if (card.status !== "active") {
    return Response.json({ message: "Gift card is not active" }, { status: 400 });
  }
  if (new Date(card.expiry_date) < new Date()) {
    return Response.json({ message: "Gift card has expired" }, { status: 400 });
  }

  // Mark as redeemed
  await sql`
    UPDATE gift_cards
    SET status = 'redeemed', redeemed_by = ${userHash}, redeemed_at = NOW()
    WHERE id = ${parsedId.data.id}
  `;

  // Credit reward balance
  await sql`
    UPDATE device_profiles
    SET rewards_balance = rewards_balance + ${card.face_value}
    WHERE device_id_hash = ${userHash}
  `;

  // If no device profile exists, create one
  await sql`
    INSERT INTO device_profiles (device_id_hash, trust_score, total_submissions, rewards_balance)
    VALUES (${userHash}, 50, 0, ${card.face_value})
    ON CONFLICT (device_id_hash) DO NOTHING
  `;

  // Ledger entry
  await sql`
    INSERT INTO reward_ledger (user_hash, amount, type, description)
    VALUES (${userHash}, ${card.face_value}, 'gift_card_redeem', ${'Redeemed ' + card.brand + ' gift card ' + card.code})
  `;

  return Response.json({
    success: true,
    giftCardId: parsedId.data.id,
    code: card.code,
    brand: card.brand,
    faceValue: card.face_value,
    currency: card.currency,
    creditedAmount: card.face_value,
  });
}
