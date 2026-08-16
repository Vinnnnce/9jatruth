import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const redeemSchema = z.object({
  rewardType: z.enum(["airtime", "data", "giftcard", "gift-card", "giftcards", "gift-cards", "voucher", "vouchers", "cash"]).transform((val) => {
    // Normalize legacy/variant values to canonical enum
    const map: Record<string, string> = {
      "gift-card": "giftcard",
      "giftcards": "giftcard",
      "gift-cards": "giftcard",
      "vouchers": "voucher",
    };
    return (map[val] || val) as "airtime" | "data" | "giftcard" | "voucher" | "cash";
  }),
  rewardCategory: z.string().trim().min(1).max(100),
  amount: z.coerce.number().int().positive().max(100000),
  description: z.string().trim().min(1).max(300),
  recipientPhone: z.string().max(20).optional(),
  recipientName: z.string().max(200).optional(),
  networkProvider: z.string().max(50).optional(),
  giftCardCode: z.string().max(100).optional(),
  voucherCode: z.string().max(100).optional(),
  voucherStoreName: z.string().max(200).optional(),
  planCode: z.string().max(100).optional(),
  planName: z.string().max(200).optional(),
  // Backwards compat — ignored, userHash comes from auth context
  userHash: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
});

/**
 * POST /api/rewards/redeem — redeem rewards (supports airtime, data, giftcard, voucher, cash)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // Defensive normalization before Zod validation
  if (body) {
    // Normalize rewardType: strip spaces, hyphens, and lowercase
    if (typeof body.rewardType === "string") {
      const normalized = body.rewardType.toLowerCase().trim();
      const typeMap: Record<string, string> = {
        "gift-card": "giftcard", "giftcards": "giftcard", "gift-cards": "giftcard",
        "gift card": "giftcard", "vouchers": "voucher",
        "air-time": "airtime", "data-bundle": "data",
      };
      body.rewardType = typeMap[normalized] || normalized;
    }
    // Normalize amount: strip currency symbols and commas
    if (typeof body.amount === "string") {
      const cleaned = body.amount.replace(/[^\d.]/g, "");
      body.amount = cleaned ? Number(cleaned) : undefined;
    }
    // Ensure rewardCategory is a non-empty string
    if (!body.rewardCategory || (typeof body.rewardCategory === "string" && !body.rewardCategory.trim())) {
      body.rewardCategory = body.rewardType || "general";
    }
  }

  const parsed = validate(redeemSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  // Validate reward-type-specific fields
  if ((data.rewardType === "airtime" || data.rewardType === "data") && !data.recipientPhone) {
    return Response.json({ message: "recipientPhone is required for airtime/data redemption" }, { status: 400 });
  }
  if (data.rewardType === "giftcard" && !data.giftCardCode) {
    return Response.json({ message: "giftCardCode is required for gift card redemption" }, { status: 400 });
  }
  if (data.rewardType === "voucher" && !data.voucherCode) {
    return Response.json({ message: "voucherCode is required for voucher redemption" }, { status: 400 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  // Check reward balance
  const balanceRows = (await sql`
    SELECT rewards_balance FROM device_profiles WHERE device_id_hash = ${userHash}
  `) as unknown as any[];

  const balance = balanceRows.length > 0 ? balanceRows[0].rewards_balance : 0;
  if (data.amount > balance) {
    return Response.json(
      { message: "Insufficient balance for redemption", balance, required: data.amount },
      { status: 400 }
    );
  }

  // Deduct from balance
  if (balanceRows.length > 0) {
    await sql`
      UPDATE device_profiles SET rewards_balance = rewards_balance - ${data.amount}
      WHERE device_id_hash = ${userHash}
    `;
  }

  // Create ledger entry
  await sql`
    INSERT INTO reward_ledger (user_hash, amount, type, description)
    VALUES (${userHash}, ${-data.amount}, 'redemption', ${sanitizeText(data.description)})
  `;

  // Create redemption record
  const rows = (await sql`
    INSERT INTO reward_redemptions (
      user_hash, reward_type, reward_category, amount, status, description,
      recipient_phone, recipient_name, network_provider,
      gift_card_code, voucher_code, voucher_store_name
    ) VALUES (
      ${userHash}, ${data.rewardType}, ${data.rewardCategory}, ${data.amount},
      ${data.rewardType === "cash" ? "pending" : "pending"},
      ${sanitizeText(data.description)},
      ${data.recipientPhone || null}, ${data.recipientName || null},
      ${data.networkProvider || null},
      ${data.giftCardCode || null}, ${data.voucherCode || null},
      ${data.voucherStoreName || null}
    )
    RETURNING *
  `) as unknown as any[];

  return Response.json(
    {
      id: rows[0].id,
      rewardType: rows[0].reward_type,
      rewardCategory: rows[0].reward_category,
      amount: rows[0].amount,
      status: rows[0].status,
      description: rows[0].description,
      createdAt: rows[0].created_at,
    },
    { status: 201 }
  );
}
