import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import {
  purchaseAirtimeOrData,
  validatePhoneNumber,
  detectNetwork,
  type NetworkProvider,
} from "@/lib/telecom";
import { z } from "zod";

const purchaseSchema = z.object({
  phoneNumber: z.string().min(11).max(15),
  network: z.enum(["MTN", "Airtel", "Glo", "9mobile"]),
  serviceType: z.enum(["airtime", "data"]),
  amount: z.number().int().positive().max(100000),
  planCode: z.string().max(100).optional(),
  planName: z.string().max(200).optional(),
  redemptionId: z.number().int().positive().max(1_000_000).optional(),
});

/**
 * POST /api/telecom/purchase — purchase airtime/data
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

  const parsed = validate(purchaseSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  // Validate phone number
  if (!validatePhoneNumber(data.phoneNumber)) {
    return Response.json({ message: "Invalid phone number. Must be 11 digits starting with 0." }, { status: 400 });
  }

  // Auto-detect network if not matching
  const detectedNetwork = detectNetwork(data.phoneNumber);
  if (detectedNetwork && detectedNetwork !== data.network) {
    return Response.json(
      { message: `Phone number appears to belong to ${detectedNetwork}, not ${data.network}` },
      { status: 400 }
    );
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  // Create transaction record (pending)
  const txRows = (await sql`
    INSERT INTO telecom_transactions (
      user_hash, phone_number, network_provider, service_type, amount,
      plan_code, plan_name, status
    ) VALUES (
      ${userHash}, ${data.phoneNumber}, ${data.network}, ${data.serviceType},
      ${data.amount}, ${data.planCode || null}, ${data.planName || null}, 'pending'
    )
    RETURNING *
  `) as unknown as any[];

  const transaction = txRows[0];

  // Attempt purchase via telecom library
  const result = await purchaseAirtimeOrData({
    phoneNumber: data.phoneNumber,
    network: data.network as NetworkProvider,
    serviceType: data.serviceType,
    amount: data.amount,
    planCode: data.planCode,
    planName: data.planName,
    userHash,
    redemptionId: data.redemptionId,
  });

  // Update transaction with result
  await sql`
    UPDATE telecom_transactions
    SET status = ${result.status},
        provider_ref = ${result.providerRef || null},
        provider = ${result.provider},
        error_message = ${result.errorMessage || null},
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${transaction.id}
  `;

  // If linked to a redemption, update its status
  if (data.redemptionId) {
    await sql`
      UPDATE reward_redemptions
      SET status = ${result.success ? "fulfilled" : "failed"},
          processed_by = 'telecom_auto',
          processed_at = NOW()
      WHERE id = ${data.redemptionId}
    `;
  }

  if (result.success) {
    return Response.json({
      success: true,
      transactionId: transaction.id,
      status: result.status,
      provider: result.provider,
      providerRef: result.providerRef,
    });
  }

  return Response.json(
    {
      success: false,
      transactionId: transaction.id,
      status: result.status,
      provider: result.provider,
      errorMessage: result.errorMessage,
    },
    { status: 502 }
  );
}
