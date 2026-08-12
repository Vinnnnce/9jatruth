import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
  getUserId,
} from "@/lib/api-helpers";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * GET /api/telecom/transactions/[id] — single transaction detail
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

  const rows = (await sql`
    SELECT * FROM telecom_transactions
    WHERE id = ${parsed.data.id} AND user_hash = ${userHash}
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Transaction not found" }, { status: 404 });
  }

  const r = rows[0];
  return Response.json({
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
    ledgerEntryId: r.ledger_entry_id,
    redemptionId: r.redemption_id,
    processedAt: r.processed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}
