import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/gift — Send reward points as a gift to another user.
 *
 * Body:
 *   - recipientUserHash: string (required) — the user_hash of the recipient
 *   - amount: number (required) — points to gift (must be positive, max 1000)
 *   - message: string (optional) — gift message (max 200 chars)
 *
 * This is a transactional operation:
 *   1. Check sender has sufficient balance
 *   2. Debit sender's reward balance
 *   3. Credit recipient's reward balance
 *   4. Write ledger entries for both sender (debit) and recipient (credit)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const senderHash = await getUserId(request);
  if (!senderHash) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { recipientUserHash, amount, message } = body;

  // Validate inputs
  if (!recipientUserHash || typeof recipientUserHash !== "string") {
    return Response.json({ message: "Recipient user hash is required" }, { status: 400 });
  }
  if (!amount || typeof amount !== "number" || amount <= 0 || amount > 1000) {
    return Response.json({ message: "Amount must be between 1 and 1000" }, { status: 400 });
  }
  if (senderHash === recipientUserHash) {
    return Response.json({ message: "Cannot gift yourself" }, { status: 400 });
  }
  const giftMessage = message ? String(message).slice(0, 200) : null;

  const sql = getDb();

  try {
    // Use a transaction to ensure atomicity
    await sql`BEGIN`;

    try {
      // 1. Check sender's balance
      const senderRows = await sql`
        SELECT rewards_balance FROM device_profiles WHERE device_id_hash = ${senderHash}
      ` as unknown as any[];

      let senderBalance = 0;
      if (senderRows.length > 0) {
        senderBalance = senderRows[0].rewards_balance;
      } else {
        // Check if user exists in users table (fallback auth)
        const fallbackUser = await sql`
          SELECT user_hash FROM users WHERE user_hash = ${senderHash}
        ` as unknown as any[];
        if (fallbackUser.length === 0) {
          await sql`ROLLBACK`;
          return Response.json({ message: "Sender account not found" }, { status: 404 });
        }
      }

      if (senderBalance < amount) {
        await sql`ROLLBACK`;
        return Response.json({ message: `Insufficient balance. You have ${senderBalance} points.` }, { status: 400 });
      }

      // 2. Verify recipient exists
      const recipientRows = await sql`
        SELECT device_id_hash FROM device_profiles WHERE device_id_hash = ${recipientUserHash}
      ` as unknown as any[];

      if (recipientRows.length === 0) {
        // Check users table (fallback auth)
        const fallbackRecipient = await sql`
          SELECT user_hash FROM users WHERE user_hash = ${recipientUserHash}
        ` as unknown as any[];
        if (fallbackRecipient.length === 0) {
          await sql`ROLLBACK`;
          return Response.json({ message: "Recipient not found" }, { status: 404 });
        }
        // Create device profile for recipient if they don't have one
        await sql`
          INSERT INTO device_profiles (device_id_hash, trust_score, total_submissions, rewards_balance)
          VALUES (${recipientUserHash}, 50, 0, 0)
          ON CONFLICT (device_id_hash) DO NOTHING
        `;
      }

      // 3. Debit sender
      await sql`
        UPDATE device_profiles
        SET rewards_balance = rewards_balance - ${amount}
        WHERE device_id_hash = ${senderHash}
      `;

      // 4. Credit recipient
      await sql`
        UPDATE device_profiles
        SET rewards_balance = rewards_balance + ${amount}
        WHERE device_id_hash = ${recipientUserHash}
      `;

      // 5. Write ledger entries
      await sql`
        INSERT INTO reward_ledger (user_hash, amount, type, description)
        VALUES (${senderHash}, ${-amount}, 'gift_sent', ${giftMessage ? `Gift sent: ${giftMessage}` : 'Gift sent to another user'})
      `;
      await sql`
        INSERT INTO reward_ledger (user_hash, amount, type, description)
        VALUES (${recipientUserHash}, ${amount}, 'gift_received', ${giftMessage ? `Gift received: ${giftMessage}` : 'Gift received from another user'})
      `;

      await sql`COMMIT`;

      return Response.json({
        success: true,
        message: `Sent ${amount} points as a gift`,
        amount,
        recipientUserHash,
      });
    } catch (txErr) {
      await sql`ROLLBACK`;
      throw txErr;
    }
  } catch (err) {
    return Response.json(
      { message: "Failed to send gift", error: String(err) },
      { status: 500 }
    );
  }
}
