import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const bodySchema = z.object({
  giftId: z.string().min(1).max(60),
  points: z.coerce.number().int().min(1).max(10_000).default(1),
});

/**
 * POST /api/truths/[id]/gift — Send a gift to a post's author using
 * accumulated reward points. Points are debited from the sender's balance
 * and credited to the author's balance, with ledger entries on both sides.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized — Please sign in to send a gift" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid gift payload", errors: parsed.error.flatten() }, { status: 400 });
  }
  const { giftId, points } = parsed.data;

  const senderHash = await getUserId(request);
  const sql = getDb();

  // Look up the post + author.
  const truth = (await sql`SELECT user_hash FROM micro_truths WHERE id = ${truthId} AND deleted_at IS NULL LIMIT 1`) as unknown as any[];
  if (!truth.length) return Response.json({ message: "Truth not found" }, { status: 404 });
  const recipientHash = truth[0].user_hash;
  if (recipientHash === senderHash) {
    return Response.json({ message: "You cannot gift your own post" }, { status: 400 });
  }

  // Check sender balance.
  const bal = (await sql`SELECT rewards_balance::int AS b FROM device_profiles WHERE device_id_hash = ${senderHash} LIMIT 1`) as unknown as any[];
  const balance = Number(bal[0]?.b ?? 0);
  if (balance < points) {
    return Response.json({ message: "Not enough points", balance, required: points }, { status: 400 });
  }

  // Debit sender, credit recipient.
  await sql`UPDATE device_profiles SET rewards_balance = rewards_balance - ${points} WHERE device_id_hash = ${senderHash}`;
  await sql`UPDATE device_profiles SET rewards_balance = COALESCE(rewards_balance, 0) + ${points} WHERE device_id_hash = ${recipientHash}`;
  // Ensure a device_profiles row exists for the recipient (in case they don't have one yet).
  await sql`
    INSERT INTO device_profiles (device_id_hash, trust_score, total_submissions, rewards_balance)
    VALUES (${recipientHash}, 50, 0, ${points})
    ON CONFLICT (device_id_hash) DO NOTHING
  `;

  // Ledger entries.
  await sql`INSERT INTO reward_ledger (user_hash, amount, type, description) VALUES (${senderHash}, ${-points}, 'gift_sent', ${`Gift sent to post #${truthId} (${giftId})`})`;
  await sql`INSERT INTO reward_ledger (user_hash, amount, type, description) VALUES (${recipientHash}, ${points}, 'gift_received', ${`Gift received on post #${truthId} (${giftId})`})`;

  // Record the gift.
  await sql`INSERT INTO truth_gifts (truth_id, sender_hash, recipient_hash, gift_id, points) VALUES (${truthId}, ${senderHash}, ${recipientHash}, ${giftId}, ${points})`;

  const giftCount = (await sql`SELECT COUNT(*)::int AS c FROM truth_gifts WHERE truth_id = ${truthId}`) as unknown as any[];
  const newBal = (await sql`SELECT rewards_balance::int AS b FROM device_profiles WHERE device_id_hash = ${senderHash} LIMIT 1`) as unknown as any[];

  return Response.json({
    gifted: true,
    giftCount: Number(giftCount[0]?.c ?? 0),
    balance: Number(newBal[0]?.b ?? 0),
  });
}
