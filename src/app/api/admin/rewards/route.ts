import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
  rewardType: z.string().max(50).optional(),
});

/**
 * GET /api/admin/rewards — list all reward redemptions for admin dashboard
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 100;
  const offset = parsed.success ? parsed.data.offset : 0;
  const status = parsed.success ? parsed.data.status : undefined;
  const rewardType = parsed.success ? parsed.data.rewardType : undefined;

  const sql = getDb();

  const conditions: string[] = [];
  const params: any[] = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (rewardType) {
    params.push(rewardType);
    conditions.push(`reward_type = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = `$${params.length}`;
  params.push(offset);
  const offsetIdx = `$${params.length}`;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT * FROM reward_redemptions ${where} ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
    params
  )) as unknown as any[];

  // Also get summary stats
  const stats = (await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'fulfilled') as fulfilled,
      COUNT(*) FILTER (WHERE status = 'denied') as denied,
      COALESCE(SUM(amount) FILTER (WHERE status = 'fulfilled'), 0) as total_fulfilled_amount
    FROM reward_redemptions
  `) as unknown as any[];

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
    stats: {
      total: stats[0]?.total ?? 0,
      pending: stats[0]?.pending ?? 0,
      approved: stats[0]?.approved ?? 0,
      fulfilled: stats[0]?.fulfilled ?? 0,
      denied: stats[0]?.denied ?? 0,
      totalFulfilledAmount: stats[0]?.total_fulfilled_amount ?? 0,
    },
    limit,
    offset,
  });
}
