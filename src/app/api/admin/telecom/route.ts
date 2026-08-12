import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
  networkProvider: z.string().max(50).optional(),
});

/**
 * GET /api/admin/telecom — list all telecom transactions
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
  const networkProvider = parsed.success ? parsed.data.networkProvider : undefined;

  const sql = getDb();

  const conditions: string[] = [];
  const params: any[] = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (networkProvider) {
    params.push(networkProvider);
    conditions.push(`network_provider = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = `$${params.length}`;
  params.push(offset);
  const offsetIdx = `$${params.length}`;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT * FROM telecom_transactions ${where} ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
    params
  )) as unknown as any[];

  // Summary stats
  const stats = (await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'success') as successful,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) as total_amount
    FROM telecom_transactions
  `) as unknown as any[];

  return Response.json({
    transactions: rows.map((r) => ({
      id: r.id,
      userHash: r.user_hash,
      phoneNumber: r.phone_number,
      networkProvider: r.network_provider,
      serviceType: r.service_type,
      amount: r.amount,
      planCode: r.plan_code,
      planName: r.plan_name,
      status: r.status,
      providerRef: r.provider_ref,
      provider: r.provider,
      errorMessage: r.error_message,
      retryCount: r.retry_count,
      redemptionId: r.redemption_id,
      processedAt: r.processed_at,
      createdAt: r.created_at,
    })),
    stats: {
      total: stats[0]?.total ?? 0,
      successful: stats[0]?.successful ?? 0,
      failed: stats[0]?.failed ?? 0,
      pending: stats[0]?.pending ?? 0,
      totalAmount: stats[0]?.total_amount ?? 0,
    },
    limit,
    offset,
  });
}
