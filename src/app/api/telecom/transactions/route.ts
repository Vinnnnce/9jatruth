import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(50).optional(),
});

/**
 * GET /api/telecom/transactions — list user's telecom transactions
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
        SELECT * FROM telecom_transactions
        WHERE user_hash = ${userHash} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[])
    : ((await sql`
        SELECT * FROM telecom_transactions
        WHERE user_hash = ${userHash}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as unknown as any[]);

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
      updatedAt: r.updated_at,
    })),
    limit,
    offset,
  });
}
