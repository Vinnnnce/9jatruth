import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
});

/**
 * GET /api/rewards/redemptions — list user's redemption history
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const userHash = await getUserId(request);
  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 50;
  const offset = parsed.success ? parsed.data.offset : 0;
  const status = parsed.success ? parsed.data.status : undefined;

  const sql = getDb();

  const rows = status
    ? ((await sql`
        SELECT * FROM reward_redemptions
        WHERE user_hash = ${userHash} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[])
    : ((await sql`
        SELECT * FROM reward_redemptions
        WHERE user_hash = ${userHash}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[]);

  return Response.json({
    redemptions: rows.map((r) => ({
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
    })),
    limit,
    offset,
  });
}
