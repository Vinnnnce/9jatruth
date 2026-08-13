import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getClerkUserId,
  getUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { verifyTransaction, type Provider } from "@/lib/telecom";
import { z } from "zod";

const verifySchema = z.object({
  transactionId: z.number().int().positive().max(1_000_000).optional(),
  providerRef: z.string().max(200).optional(),
  provider: z.enum(["vtpass", "africastalking", "termii", "mock"]).optional(),
}).refine(
  (data) => data.transactionId || data.providerRef,
  { message: "Either transactionId or providerRef is required" }
);

/**
 * POST /api/telecom/verify — verify transaction status
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

  const parsed = validate(verifySchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const userHash = await getUserId(request);
  const sql = getDb();

  // Look up transaction
  let transaction: any = null;
  if (data.transactionId) {
    const rows = (await sql`
      SELECT * FROM telecom_transactions
      WHERE id = ${data.transactionId} AND user_hash = ${userHash}
    `) as unknown as any[];
    transaction = rows[0] || null;
  } else if (data.providerRef) {
    const rows = (await sql`
      SELECT * FROM telecom_transactions
      WHERE provider_ref = ${data.providerRef} AND user_hash = ${userHash}
    `) as unknown as any[];
    transaction = rows[0] || null;
  }

  if (!transaction) {
    return Response.json({ message: "Transaction not found" }, { status: 404 });
  }

  // If no provider ref, can't verify externally
  if (!transaction.provider_ref || !transaction.provider) {
    return Response.json({
      transactionId: transaction.id,
      status: transaction.status,
      verified: transaction.status === "success",
      message: "No provider reference available for verification",
    });
  }

  // Verify with provider
  const provider = (data.provider || transaction.provider) as Provider;
  const isVerified = await verifyTransaction(transaction.provider_ref, provider);

  // Update transaction status if verification differs
  if (isVerified && transaction.status !== "success") {
    await sql`
      UPDATE telecom_transactions
      SET status = 'success', updated_at = NOW()
      WHERE id = ${transaction.id}
    `;
  }

  // Fetch updated transaction
  const updated = (await sql`SELECT * FROM telecom_transactions WHERE id = ${transaction.id}`) as unknown as any[];

  return Response.json({
    transactionId: transaction.id,
    status: updated[0].status,
    verified: isVerified,
    provider: provider,
    providerRef: transaction.provider_ref,
  });
}
