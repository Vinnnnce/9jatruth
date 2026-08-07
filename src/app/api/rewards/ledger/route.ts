import { ensureDbInitialized } from "@/lib/db";
import { getRewardLedger } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const userHash = await getUserId(request);
  const ledger = await getRewardLedger(userHash);
  return Response.json(ledger);
}
